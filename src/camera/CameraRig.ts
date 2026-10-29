/**
 * Kamera: Homescreen (seitlich/schräg), weiche Fahrt ins Spiel, dann fester Abstand hinter
 * und über dem Surfer. Dreht sich weich mit. Bei hohem Tempo wird das Sichtfeld etwas weiter,
 * große Momente (Abheben, Kiste, Monster besiegt) geben einen kurzen Kick.
 */
import * as THREE from 'three';
import { CONFIG } from '../config/gameConfig';
import { damp, dampAngle, easings } from '../core/math';

export type CameraMode = 'home' | 'showcase' | 'transition' | 'follow';

export interface CameraTarget {
  x: number;
  z: number;
  /** Wasserhöhe am Surfer (nicht Sprunghöhe – damit die Kamera ruhig bleibt) */
  waterY: number;
  heading: number;
  /** Richtung zur Insel (für den Homescreen) */
  islandX: number;
  islandZ: number;
  /** Höhe des Surfers über dem Wasser (große Sprünge) */
  airHeight?: number;
  /** Tempo relativ zum Höchsttempo (0 … >1) */
  speedK?: number;
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  mode: CameraMode = 'home';
  private yaw = 0;
  private smoothY = 0;
  private transitionT = 0;
  private homeAngle = 0;
  private readonly fromPos = new THREE.Vector3();
  private readonly fromLook = new THREE.Vector3();
  private readonly pos = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private onTransitionDone: (() => void) | null = null;
  private showcaseAngle = 0;
  /** Weicher Wechsel zwischen ruhenden Modi (Homescreen ↔ Shop) */
  private blendT = 1;
  private readonly blendFromPos = new THREE.Vector3();
  private readonly blendFromLook = new THREE.Vector3();
  private kickFov = 0;
  private shake = 0;
  /** Zwischensequenz: feste Einstellung, weich angefahren */
  private cine: { fromPos: THREE.Vector3; fromLook: THREE.Vector3; pos: THREE.Vector3; look: THREE.Vector3; t: number; dur: number } | null = null;
  private transitionDur: number = CONFIG.camera.transitionDuration;
  private speedFov = 0;
  private airLift = 0;

  constructor(aspect: number) {
    const R = CONFIG.render;
    this.camera = new THREE.PerspectiveCamera(R.fov, aspect, R.near, R.far);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  setHome(target: CameraTarget): void {
    this.mode = 'home';
    this.homeAngle = 0;
    this.smoothY = target.waterY;
    this.yaw = target.heading;
    this.computeHome(target, this.pos, this.look);
    this.apply();
  }

  /** Wechselt weich zwischen Homescreen-Ansicht und Shop-Vorschau. */
  setShowcase(on: boolean, target: CameraTarget): void {
    const next: CameraMode = on ? 'showcase' : 'home';
    if (this.mode === next) return;
    this.blendFromPos.copy(this.camera.position);
    this.blendFromLook.copy(this.look);
    this.blendT = 0;
    if (on) this.showcaseAngle = target.heading + Math.PI * 0.62;
    this.mode = next;
  }

  /** Startet die Fahrt vom Homescreen hinter den Surfer. */
  /** Zwischensequenz: weich zu einer festen Kameraposition fahren. */
  setCinematic(pos: THREE.Vector3, look: THREE.Vector3, duration: number): void {
    this.cine = {
      fromPos: this.camera.position.clone(),
      fromLook: this.look.clone(),
      pos: pos.clone(),
      look: look.clone(),
      t: 0,
      dur: Math.max(0.01, duration),
    };
  }

  /** Zwischensequenz beenden: weich zurück hinter den Surfer. */
  clearCinematic(duration = 1.2): void {
    if (!this.cine) return;
    this.cine = null;
    this.mode = 'transition';
    this.transitionT = 0;
    this.transitionDur = duration;
    this.fromPos.copy(this.camera.position);
    this.fromLook.copy(this.look);
    this.onTransitionDone = null;
  }

  get inCinematic(): boolean {
    return this.cine !== null;
  }

  startTransition(onDone: () => void): void {
    this.mode = 'transition';
    this.transitionT = 0;
    this.transitionDur = CONFIG.camera.transitionDuration;
    this.fromPos.copy(this.camera.position);
    this.fromLook.copy(this.look);
    this.onTransitionDone = onDone;
  }

  /** Sofort in die Spielansicht (z. B. „Nochmal“). */
  snapFollow(target: CameraTarget): void {
    this.mode = 'follow';
    this.yaw = target.heading;
    this.smoothY = target.waterY;
    this.computeFollow(target, this.pos, this.look);
    this.apply();
  }

  /** `realDt` = echte Zeit, damit die Kamera auch in Zeitlupe ruhig bleibt. */
  update(realDt: number, target: CameraTarget): void {
    const C = CONFIG.camera;
    const lift = this.mode === 'follow' ? Math.max(0, (target.airHeight ?? 0) - C.airFollowFrom) * C.airFollowFactor : 0;
    this.airLift = damp(this.airLift, lift, lift > this.airLift ? C.airFollowRate : C.heightFollowRate, realDt);
    this.smoothY = damp(this.smoothY, target.waterY, C.heightFollowRate, realDt);
    this.speedFov = damp(this.speedFov, this.mode === 'follow' ? Math.min(1.3, target.speedK ?? 0) * C.speedFov : 0, 2, realDt);
    this.kickFov *= Math.exp(-C.kickDecay * realDt);
    this.shake *= Math.exp(-C.kickDecay * 1.5 * realDt);
    if (this.cine) {
      const c = this.cine;
      c.t = Math.min(c.dur, c.t + realDt);
      const k = easings.inOutCubic(c.t / c.dur);
      this.pos.lerpVectors(c.fromPos, c.pos, k);
      this.look.lerpVectors(c.fromLook, c.look, k);
      this.apply();
      return;
    }
    this.yaw = dampAngle(this.yaw, target.heading, C.yawFollowRate, realDt);

    if (this.mode === 'home' || this.mode === 'showcase') {
      if (this.mode === 'home') {
        this.homeAngle += realDt * C.home.orbitSpeed;
        this.computeHome(target, this.pos, this.look);
      } else {
        this.showcaseAngle += realDt * C.showcase.orbitSpeed;
        this.computeShowcase(target, this.pos, this.look);
      }
      if (this.blendT < 1) {
        this.blendT = Math.min(1, this.blendT + realDt / C.blendTime);
        const k = easings.inOutCubic(this.blendT);
        this.pos.lerpVectors(this.blendFromPos, this.pos, k);
        this.look.lerpVectors(this.blendFromLook, this.look, k);
      }
    } else if (this.mode === 'transition') {
      this.transitionT = Math.min(1, this.transitionT + realDt / this.transitionDur);
      const k = easings.inOutCubic(this.transitionT);
      const followPos = new THREE.Vector3();
      const followLook = new THREE.Vector3();
      this.computeFollow(target, followPos, followLook);
      // Bogen statt gerader Linie: leicht nach oben ausholen
      this.pos.lerpVectors(this.fromPos, followPos, k);
      this.pos.y += Math.sin(k * Math.PI) * 1.2;
      this.look.lerpVectors(this.fromLook, followLook, k);
      if (this.transitionT >= 1) {
        this.mode = 'follow';
        const cb = this.onTransitionDone;
        this.onTransitionDone = null;
        cb?.();
      }
    } else {
      this.computeFollow(target, this.pos, this.look);
    }
    this.apply();
  }

  private computeFollow(t: CameraTarget, pos: THREE.Vector3, look: THREE.Vector3): void {
    const C = CONFIG.camera;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const back = C.distance + this.airLift * 0.35;
    pos.set(t.x - fx * back, this.smoothY + this.airLift + C.height, t.z - fz * back);
    look.set(t.x + fx * C.lookAhead, this.smoothY + this.airLift * 1.05 + C.lookHeight, t.z + fz * C.lookAhead);
  }

  private computeShowcase(t: CameraTarget, pos: THREE.Vector3, look: THREE.Vector3): void {
    const S = CONFIG.camera.showcase;
    const a = this.showcaseAngle;
    pos.set(t.x + Math.sin(a) * S.distance, this.smoothY + S.height, t.z + Math.cos(a) * S.distance);
    look.set(t.x, this.smoothY + S.lookUp, t.z);
    // Versatz so berechnen, dass der Surfer bei screenX im Bild steht – unabhängig vom Seitenverhältnis
    const tanHalfH = Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect;
    const angle = Math.atan((0.5 - S.screenX) * 2 * tanHalfH);
    shiftSideways(pos, look, -S.distance * Math.tan(angle));
  }

  private computeHome(t: CameraTarget, pos: THREE.Vector3, look: THREE.Vector3): void {
    const H = CONFIG.camera.home;
    let dx = t.islandX - t.x;
    let dz = t.islandZ - t.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    // Kamera seitlich-hinten, Insel im Hintergrund; langsames Pendeln
    const sway = Math.sin(this.homeAngle * 2) * 0.6;
    const px = -dz;
    const pz = dx;
    pos.set(
      t.x - dx * (H.back + sway) + px * H.side,
      this.smoothY + H.up,
      t.z - dz * (H.back + sway) + pz * H.side,
    );
    look.set(t.x + dx * H.lookAheadToIsland, this.smoothY + H.lookUp, t.z + dz * H.lookAheadToIsland);
    // Bildausschnitt verschieben, damit der Surfer rechts neben dem Menü liegt
    shiftSideways(pos, look, H.screenShift);
  }

  /** Kurzer Kick: Sichtfeld weiter (°) und Wackeln (m). */
  kick(fov: number, shake = 0): void {
    this.kickFov = Math.max(this.kickFov, fov);
    this.shake = Math.max(this.shake, shake);
  }

  private apply(): void {
    this.camera.position.copy(this.pos);
    if (this.shake > 0.01) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.camera.position.z += (Math.random() - 0.5) * this.shake;
    }
    this.camera.lookAt(this.look);
    const fov = CONFIG.render.fov + this.speedFov + this.kickFov;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}

/** Verschiebt den Blickpunkt seitlich (+ = Motiv wandert nach rechts im Bild). */
function shiftSideways(pos: THREE.Vector3, look: THREE.Vector3, amount: number): void {
  const fx = look.x - pos.x;
  const fz = look.z - pos.z;
  const fl = Math.hypot(fx, fz) || 1;
  look.x += (fz / fl) * amount;
  look.z -= (fx / fl) * amount;
}
