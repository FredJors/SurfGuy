/**
 * Kamera: Homescreen (seitlich/schräg), weiche Fahrt ins Spiel, dann fester Abstand hinter
 * und über dem Surfer. Dreht sich weich mit – kein Zoom, kein Wackeln.
 */
import * as THREE from 'three';
import { CONFIG } from '../config/gameConfig';
import { damp, dampAngle, easings } from '../core/math';

export type CameraMode = 'home' | 'transition' | 'follow';

export interface CameraTarget {
  x: number;
  z: number;
  /** Wasserhöhe am Surfer (nicht Sprunghöhe – damit die Kamera ruhig bleibt) */
  waterY: number;
  heading: number;
  /** Richtung zur Insel (für den Homescreen) */
  islandX: number;
  islandZ: number;
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

  /** Startet die Fahrt vom Homescreen hinter den Surfer. */
  startTransition(onDone: () => void): void {
    this.mode = 'transition';
    this.transitionT = 0;
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
    this.smoothY = damp(this.smoothY, target.waterY, C.heightFollowRate, realDt);
    this.yaw = dampAngle(this.yaw, target.heading, C.yawFollowRate, realDt);

    if (this.mode === 'home') {
      this.homeAngle += realDt * C.home.orbitSpeed;
      this.computeHome(target, this.pos, this.look);
    } else if (this.mode === 'transition') {
      this.transitionT = Math.min(1, this.transitionT + realDt / C.transitionDuration);
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
    pos.set(t.x - fx * C.distance, this.smoothY + C.height, t.z - fz * C.distance);
    look.set(t.x + fx * C.lookAhead, this.smoothY + C.lookHeight, t.z + fz * C.lookAhead);
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
    const fx = look.x - pos.x;
    const fz = look.z - pos.z;
    const fl = Math.hypot(fx, fz) || 1;
    look.x += (fz / fl) * H.screenShift;
    look.z -= (fx / fl) * H.screenShift;
  }

  private apply(): void {
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
