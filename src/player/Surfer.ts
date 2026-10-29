/**
 * Der Surfer: Bewegung auf dem Wasser, Wellen erwischen und reiten, Sprung, Tricks, Sturz.
 * Das Verhalten pro Zustand steckt in SurferStates.ts (Zustandsautomat).
 *
 * Richtungskonvention: heading = Drehung um die Hochachse, vorwärts = (sin h, cos h).
 */
import * as THREE from 'three';
import { CONFIG } from '../config/gameConfig';
import { StateMachine } from '../core/StateMachine';
import type { GameEventBus, LaunchSource, SurferStateId } from '../core/events';
import { clamp, clamp01, damp } from '../core/math';
import type { Registry } from '../core/Registry';
import type { PoseDef, TrickDef, TrickQuality } from '../data/types';
import type { InputManager } from '../input/InputManager';
import type { World } from '../world/World';
import type { Wave, WaveLocal } from '../world/WaveField';
import type { Wreck } from '../world/Wrecks';
import type { PlayerStats } from './Progression';
import type { CharacterRig } from './rig/CharacterRig';
import { SurferAnimator } from './SurferAnimator';
import { registerSurferStates } from './SurferStates';
import { disposeObject } from '../fx/dispose';
import { enableShadows } from '../fx/toon';

/** Infos für die Wellen-Timing-Anzeige im HUD. */
export interface WaveHint {
  waveId: number | null;
  /** Abstand des Kamms hinter dem Spieler (m); ≤ 0 = Kamm erreicht */
  distance: number;
  /** Höhe der Welle (m) */
  height: number;
  inWindow: boolean;
  /** Fährt der Spieler ungefähr in Wellenrichtung? */
  aligned: boolean;
  /** Fenster-Grenzen (m) für die Anzeige */
  windowMin: number;
  windowMax: number;
}

/** Hinweis für den Wellen-Durchstoß (Welle von vorn). */
export interface PunchHint {
  /** Welle kommt von vorn (angekündigt) */
  visible: boolean;
  /** Jetzt springen = Durchstoß */
  inWindow: boolean;
  /** Abstand zum Kamm (m) */
  distance: number;
}

export interface ActiveTrick {
  def: TrickDef;
  quality: TrickQuality;
  accuracy: number;
  hitDone: boolean;
}

export class Surfer {
  // --- Physik-Zustand ---
  x = 0;
  z = 0;
  y = 0;
  vy = 0;
  heading = 0;
  speed = 0;
  /** Tatsächliche Geschwindigkeit in Weltkoordinaten (inkl. Welle) */
  vx = 0;
  vz = 0;
  private pushVx = 0;
  private pushVz = 0;
  boundaryStrength = 0;
  /** Erlaubtes Tempo über dem Höchsttempo (Turbo, Geysir, Delfine …); baut sich ab */
  overdrive = 0;
  /** Wrack, auf dessen Deck (Rampe) der Surfer gerade fährt */
  deckWreck: Wreck | null = null;
  private bonkCooldown = 0;

  // Welle
  rideWaveId: number | null = null;
  rideTime = 0;
  rideHeight = 0;
  readonly waveHint: WaveHint = {
    waveId: null,
    distance: Infinity,
    height: 0,
    inWindow: false,
    aligned: false,
    windowMin: CONFIG.catchWave.windowMin,
    windowMax: CONFIG.catchWave.windowMax,
  };

  readonly punchHint: PunchHint = { visible: false, inWindow: false, distance: Infinity };
  private punchWave: { wave: Wave; height: number } | null = null;

  // Luft
  airVx = 0;
  airVz = 0;
  airtime = 0;
  airElapsed = 0;
  drawGameTime = 0;
  drawingDone = false;
  trick: ActiveTrick | null = null;
  trickProgress = 0;
  private trickExtraVx = 0;
  /** Flugrichtung vor dem Trick (nach einem Trick in der Luft wiederhergestellt) */
  private preTrickVx = 0;
  private preTrickVz = 0;
  /** Tricks im aktuellen Sprung (Trick-Kombo) */
  trickChain = 0;
  /** Dauer des laufenden Tricks (Spielsekunden; beim Kopfsprung bis zur Ankunft) */
  trickDuration = 1;
  /** Kopfsprung auf einen Boss: danach in diese Richtung abprallen */
  bossBounce: { awayX: number; awayZ: number } | null = null;
  private trickExtraVz = 0;
  /** Schwerkraft in der Luft (bei Tricks mit Scheitelhöhe angepasst) */
  airGravity: number = CONFIG.player.gravity;

  /** Nach dem Aufstehen kurz nicht springen (s) */
  standUpLock = 0;

  // Eingabe (für Animation)
  inputSteer = 0;
  inputPaddle = 0;

  readonly fsm: StateMachine<Surfer, SurferStateId>;
  animator: SurferAnimator;
  rig: CharacterRig;
  private board: THREE.Object3D;

  // --- Darstellung ---
  readonly root = new THREE.Group();
  private readonly tilt = new THREE.Group();
  private readonly pivot = new THREE.Group();
  private readonly inner = new THREE.Group();
  private readonly boardHolder = new THREE.Group();
  private tiltPitch = 0;
  private tiltRoll = 0;
  private lean = 0;
  private readonly normal = { x: 0, y: 1, z: 0 };
  private readonly loc: WaveLocal = { s: 0, l: 0, dirX: 0, dirZ: 0 };
  private readonly tmpEuler = new THREE.Euler();
  private readonly tmpVec = new THREE.Vector3();

  constructor(
    readonly bus: GameEventBus,
    readonly input: InputManager,
    public stats: PlayerStats,
    readonly world: World,
    rig: CharacterRig,
    board: THREE.Object3D,
    private readonly poses: Registry<PoseDef>,
  ) {
    this.rig = rig;
    this.board = board;
    this.root.add(this.tilt);
    this.tilt.add(this.pivot);
    this.pivot.position.y = 0.9;
    this.pivot.add(this.inner);
    this.inner.position.y = -0.9;
    this.inner.add(this.boardHolder, rig.object);
    this.boardHolder.add(board);
    rig.object.position.y = 0.05;
    enableShadows(this.root, true, false);

    this.fsm = new StateMachine<Surfer, SurferStateId>(this, (from, to) => this.bus.emit('surferStateChanged', { from, to }));
    registerSurferStates(this.fsm);
    this.animator = new SurferAnimator(rig, poses);
  }

  /** Tauscht Figur und Brett aus (Shop-Vorschau, neuer Skin/neues Board). Gibt die alten Objekte frei. */
  setVisuals(rig: CharacterRig, board: THREE.Object3D): void {
    this.inner.remove(this.rig.object);
    this.boardHolder.remove(this.board);
    disposeObject(this.rig.object);
    disposeObject(this.board);
    this.rig = rig;
    this.board = board;
    rig.object.position.y = 0.05;
    this.inner.add(rig.object);
    this.boardHolder.add(board);
    enableShadows(this.root, true, false);
    this.animator = new SurferAnimator(rig, this.poses);
  }

  get forwardX(): number {
    return Math.sin(this.heading);
  }

  get forwardZ(): number {
    return Math.cos(this.heading);
  }

  get state(): SurferStateId | null {
    return this.fsm.current;
  }

  get isAirborne(): boolean {
    return this.fsm.is('Airborne', 'Drawing', 'TrickPerforming');
  }

  get waterHeight(): number {
    return this.world.heightAt(this.x, this.z);
  }

  /** Setzt den Surfer zurück (Homescreen). */
  reset(x: number, z: number, heading: number): void {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.overdrive = 0;
    this.vx = this.vz = this.vy = 0;
    this.pushVx = this.pushVz = 0;
    this.rideWaveId = null;
    this.deckWreck = null;
    this.bossBounce = null;
    this.trick = null;
    this.y = this.waterHeight;
    this.fsm.start('Lying');
  }

  /** Spielstart: Kontrolle übernehmen. */
  startPlaying(): void {
    this.fsm.start('Paddling');
  }

  update(dt: number): void {
    this.inputSteer = this.input.state.steer;
    this.inputPaddle = this.input.state.paddle;
    this.fsm.update(dt);
    this.animator.update(dt, this);
    this.updateVisual(dt);
  }

  // -------------------------------------------------------------------------
  // Bewegung auf dem Wasser
  // -------------------------------------------------------------------------

  /** mode: 'idle' (Homescreen), 'paddle' (liegend), 'stand' (stehend), 'coast' (Landung/Sturz) */
  groundMotion(dt: number, mode: 'idle' | 'paddle' | 'stand' | 'coast'): void {
    const inp = this.input.state;
    const st = this.stats;
    const maxSpeed = st.get('maxSpeed');
    const P = CONFIG.player;

    if (mode !== 'idle') {
      let turn = st.get('turnRate') * (1 - P.turnSpeedFalloff * clamp01(this.speed / maxSpeed));
      if (mode === 'coast') turn *= 0.4;
      this.heading -= inp.steer * turn * dt;
    }

    const riding = this.rideWaveId !== null;
    if (mode === 'paddle') {
      const paddleSpeed = st.get('paddleSpeed');
      if (inp.paddle > 0 && this.speed < paddleSpeed) {
        this.speed = Math.min(paddleSpeed, this.speed + st.get('paddleAccel') * inp.paddle * dt);
      } else if (this.speed > paddleSpeed) {
        this.speed -= st.get('speedDecay') * dt;
      } else if (inp.paddle <= 0) {
        this.speed -= P.waterDrag * dt;
      }
    } else if (mode === 'stand') {
      const C = CONFIG.catchWave;
      if (riding) {
        if (this.speed < C.rideSpeedCap) this.speed = Math.min(C.rideSpeedCap, this.speed + C.rideAccel * dt);
      } else {
        const cruise = st.get('cruiseSpeed');
        if (inp.paddle > 0 && this.speed < cruise) this.speed += st.get('pumpAccel') * inp.paddle * dt;
        else this.speed -= st.get('speedDecay') * dt;
      }
      // Carven kostet etwas Tempo
      this.speed -= Math.abs(inp.steer) * 0.35 * dt;
    } else {
      this.speed -= (mode === 'idle' ? 2 : P.waterDrag) * dt;
    }
    if (inp.brake > 0 && mode !== 'idle') this.speed -= st.get('brakeDecel') * inp.brake * dt;
    this.overdrive = Math.max(0, this.overdrive - P.overdriveDecay * dt);
    this.speed = clamp(this.speed, 0, maxSpeed + this.overdrive);

    // Weltgeschwindigkeit (beim Reiten schiebt die Welle mit)
    let vx = this.forwardX * this.speed;
    let vz = this.forwardZ * this.speed;
    const wave = riding ? this.currentWave() : undefined;
    if (wave) {
      // Die Welle schiebt Richtung Insel; quer zur Welle (= um die Insel herum) fährt man frei
      const C = CONFIG.catchWave;
      const loc = this.world.waves.field.local(wave, this.x, this.z, this.loc);
      const along = vx * loc.dirX + vz * loc.dirZ;
      const latX = vx - loc.dirX * along;
      const latZ = vz - loc.dirZ * along;
      const push = wave.speed * C.carry + along * C.forwardFactor + C.faceSlide;
      vx = latX + loc.dirX * push;
      vz = latZ + loc.dirZ * push;
    }
    this.vx = vx;
    this.vz = vz;
    this.applyBoundary(dt);
    this.x += (this.vx + this.pushVx) * dt;
    this.z += (this.vz + this.pushVz) * dt;
    this.y = this.waterHeight;
    if (mode !== 'idle') this.applyWrecks(dt);
  }

  // -------------------------------------------------------------------------
  // Schiffswracks: Deck als Rampe, Rumpf als Hindernis
  // -------------------------------------------------------------------------

  private applyWrecks(dt: number): void {
    const wrecks = this.world.wrecks;
    const W = CONFIG.wrecks;
    this.bonkCooldown = Math.max(0, this.bonkCooldown - dt);
    const water = this.y;

    if (this.deckWreck) {
      const w = this.deckWreck;
      const loc = wrecks.local(w, this.x, this.z);
      if (loc.u > w.length) {
        // Über den Bug hinaus → abheben!
        this.deckWreck = null;
        if (!this.fsm.is('Wipeout')) {
          this.y = w.topHeight;
          this.launch({ vy: W.launchBase + this.speed * W.launchSpeedFactor, source: 'ramp', power: 1 });
        }
        return;
      }
      const deck = wrecks.deckHeight(w, loc.u);
      if (loc.u < 0 || Math.abs(loc.v) > w.width / 2 || deck < water - 0.3) {
        // Hinten oder seitlich vom Deck runter
        this.deckWreck = null;
        if (deck > water + 0.8 && !this.fsm.is('Wipeout')) {
          this.y = deck;
          this.launch({ vy: 1.5, source: 'drop', power: 0.3 });
        }
        return;
      }
      this.y = Math.max(water, deck);
      // Bergauf etwas langsamer, bergab schneller
      const along = this.forwardX * w.dirX + this.forwardZ * w.dirZ;
      this.speed = Math.max(0, this.speed - along * w.slope * W.slopeDrag * dt);
      return;
    }

    const hit = wrecks.probe(this.x, this.z);
    if (!hit) return;
    const deck = wrecks.deckHeight(hit.wreck, hit.local.u);
    if (deck <= water + W.stepUp) {
      // Flach genug → aufs Deck
      if (deck > water - 0.3) {
        this.deckWreck = hit.wreck;
        this.endRide();
        this.y = Math.max(water, deck);
      }
      return;
    }
    // Gegen den Rumpf: an die nächste Kante zurückschieben und hart bremsen
    const w = hit.wreck;
    const { u, v } = hit.local;
    const side = w.width / 2 + 0.6 - Math.abs(v);
    const front = w.length + 0.6 - u;
    let nu = u;
    let nv = v;
    if (side < front) nv = Math.sign(v || 1) * (w.width / 2 + 0.6);
    else nu = w.length + 0.6;
    this.x = w.x + w.dirX * nu + w.dirZ * nv;
    this.z = w.z + w.dirZ * nu - w.dirX * nv;
    this.speed *= W.bonkSpeedFactor;
    if (this.bonkCooldown <= 0) {
      this.bonkCooldown = 0.6;
      this.bus.emit('wreckBonk', { position: { x: this.x, z: this.z } });
    }
  }

  /**
   * Abheben ohne Sprungtaste (Rampe, Geysir, Durchstoß). vx/vz = Flugrichtung und -tempo
   * (Standard: aktuelle Fahrt). Die Airtime berücksichtigt die Starthöhe.
   */
  launch(o: { vy: number; vx?: number; vz?: number; heading?: number; source: LaunchSource; power?: number }): void {
    const P = CONFIG.player;
    this.endRide();
    this.deckWreck = null;
    if (o.heading !== undefined) this.heading = o.heading;
    // Sprungkraft (Board/Skills) wirkt bei eigenen Absprüngen, nicht beim Geysir-Wurf
    this.vy = o.vy * (o.source === 'ramp' || o.source === 'punch' ? this.stats.get('jumpPower') : 1);
    this.airGravity = P.gravity;
    this.airElapsed = 0;
    this.airVx = o.vx ?? this.forwardX * this.speed;
    this.airVz = o.vz ?? this.forwardZ * this.speed;
    const h0 = Math.max(0, this.y - this.waterHeight);
    this.airtime = (this.vy + Math.sqrt(this.vy * this.vy + 2 * P.gravity * h0)) / P.gravity;
    this.drawingDone = false;
    this.trickChain = 0;
    this.trickExtraVx = this.trickExtraVz = 0;
    this.drawGameTime = this.airtime * CONFIG.trick.drawPortion;
    this.bus.emit('launched', { source: o.source, airtime: this.airtime, position: { x: this.x, z: this.z }, power: o.power ?? 1 });
    if (!this.isAirborne) this.fsm.transition('Airborne');
  }

  private applyBoundary(dt: number): void {
    const push = this.world.boundaryPush(this.x, this.z);
    this.boundaryStrength = push.strength;
    this.pushVx += push.ax * dt;
    this.pushVz += push.az * dt;
    const decay = Math.exp(-1.5 * dt);
    this.pushVx *= decay;
    this.pushVz *= decay;
  }

  /**
   * Sucht eine Welle, die von vorn auf den Surfer zurollt (er fährt nach außen, gegen die
   * Wellenrichtung). Liegt der Kamm im Fenster, wird ein Sprung zum Durchstoß.
   */
  updatePunchHint(): void {
    const C = CONFIG.punch;
    const field = this.world.waves.field;
    const hint = this.punchHint;
    hint.visible = false;
    hint.inWindow = false;
    hint.distance = Infinity;
    this.punchWave = null;
    if (this.rideWaveId !== null || this.deckWreck || !this.fsm.is('Standing')) return;
    const fade = field.islandFade(this.x, this.z);
    for (const w of field.waves) {
      const loc = field.local(w, this.x, this.z, this.loc);
      if (loc.s < C.windowMin || loc.s > C.announce || loc.s >= hint.distance) continue;
      if (this.forwardX * loc.dirX + this.forwardZ * loc.dirZ > C.maxDot) continue;
      const h = field.crestHeight(w, loc.l) * fade;
      if (h < C.minHeight) continue;
      hint.visible = true;
      hint.distance = loc.s;
      hint.inWindow = loc.s <= C.windowMax;
      this.punchWave = hint.inWindow ? { wave: w, height: h } : null;
    }
  }

  /** Sprung durch eine Welle von vorn: höher, mit Schub nach außen. Gibt false zurück, wenn keine Welle im Fenster. */
  tryPunchThrough(): boolean {
    const pw = this.punchWave;
    if (!pw) return false;
    const P = CONFIG.player;
    const C = CONFIG.punch;
    this.overdrive = Math.max(this.overdrive, C.boost);
    this.speed = Math.min(this.stats.get('maxSpeed') + this.overdrive, this.speed + C.boost);
    this.launch({ vy: P.jumpBase + P.jumpSpeedFactor * this.speed * 0.6 + C.heightBonus * pw.height, source: 'punch', power: 0.8 + pw.height * 0.3 });
    this.punchWave = null;
    return true;
  }

  /** Tempo-Schub, der kurz über das Höchsttempo gehen darf (Turbo, Delfine, Durchstoß …). */
  boost(amount: number): void {
    this.overdrive = Math.max(this.overdrive, amount);
    this.speed = Math.min(this.stats.get('maxSpeed') + this.overdrive, Math.max(this.speed, CONFIG.player.standSpeed) + amount);
    if (this.fsm.is('Paddling')) this.fsm.transition('Standing');
  }

  currentWave(): Wave | undefined {
    if (this.rideWaveId === null) return undefined;
    return this.world.waves.getWave(this.rideWaveId);
  }

  // -------------------------------------------------------------------------
  // Wellen erwischen und reiten
  // -------------------------------------------------------------------------

  /** Prüft das Zeitfenster und erwischt ggf. eine Welle. Gibt true zurück, wenn gerade erwischt. */
  updateWaves(dt: number, canCatch: boolean): boolean {
    const field = this.world.waves.field;
    const C = CONFIG.catchWave;
    const hint = this.waveHint;

    if (this.rideWaveId !== null) {
      this.updateRide(dt);
      hint.waveId = null;
      hint.inWindow = false;
      hint.distance = Infinity;
      return false;
    }

    const windowMax = C.windowMax * this.stats.get('catchWindow');
    hint.windowMax = windowMax;
    hint.windowMin = C.windowMin;
    let best: Wave | null = null;
    let bestS = Infinity;
    const fade = field.islandFade(this.x, this.z);
    let bestHeight = 0;
    let bestDirX = 0;
    let bestDirZ = 0;
    for (const w of field.waves) {
      const loc = field.local(w, this.x, this.z, this.loc);
      if (loc.s < C.windowMin || loc.s > CONFIG.hud.waveLookahead) continue;
      // Höhe der Welle genau an der Stelle, an der sie den Spieler erreicht
      const h = field.crestHeight(w, loc.l) * fade;
      if (h < 0.3) continue;
      if (loc.s < bestS) {
        bestS = loc.s;
        best = w;
        bestHeight = h;
        bestDirX = loc.dirX;
        bestDirZ = loc.dirZ;
      }
    }
    if (!best) {
      hint.waveId = null;
      hint.inWindow = false;
      hint.distance = Infinity;
      return false;
    }
    const height = bestHeight;
    const aligned = this.forwardX * bestDirX + this.forwardZ * bestDirZ >= Math.cos((C.maxAngle * Math.PI) / 180);
    hint.waveId = best.id;
    hint.distance = bestS;
    hint.height = height;
    hint.aligned = aligned;
    hint.inWindow = bestS >= C.windowMin && bestS <= windowMax;

    if (canCatch && hint.inWindow && aligned && height >= C.minHeight && this.input.state.paddle >= 0.5) {
      this.catchWave(best, height);
      return true;
    }
    return false;
  }

  private catchWave(w: Wave, height: number): void {
    const boost = this.stats.get('waveBoost') * height;
    this.speed = clamp(Math.max(this.speed + boost, CONFIG.catchWave.minRideSpeed), 0, this.stats.get('maxSpeed'));
    this.rideWaveId = w.id;
    this.rideTime = 0;
    this.rideHeight = height;
    this.bus.emit('waveCaught', { waveId: w.id, height, boost });
  }

  private updateRide(dt: number): void {
    const w = this.currentWave();
    const field = this.world.waves.field;
    if (!w) {
      this.endRide();
      return;
    }
    const C = CONFIG.catchWave;
    const loc = field.local(w, this.x, this.z, this.loc);
    const height = field.crestHeight(w, loc.l) * field.islandFade(this.x, this.z);
    if (loc.s < C.rideMin || loc.s > C.rideMax || height < 0.45) {
      this.endRide();
      return;
    }
    this.rideTime += dt;
    this.rideHeight = height;
  }

  endRide(): void {
    if (this.rideWaveId === null) return;
    this.bus.emit('waveRideEnded', { waveId: this.rideWaveId, duration: this.rideTime, height: this.rideHeight });
    this.rideWaveId = null;
    this.rideTime = 0;
  }

  // -------------------------------------------------------------------------
  // Sprung, Luft, Tricks
  // -------------------------------------------------------------------------

  doJump(): void {
    const P = CONFIG.player;
    const waveBonus = this.rideWaveId !== null ? P.jumpWaveBonus * this.rideHeight : 0;
    this.vy = (P.jumpBase + P.jumpSpeedFactor * this.speed + waveBonus) * this.stats.get('jumpPower');
    this.airtime = (2 * this.vy) / P.gravity;
    this.airGravity = P.gravity;
    this.airElapsed = 0;
    this.airVx = this.vx + this.pushVx;
    this.airVz = this.vz + this.pushVz;
    this.drawingDone = false;
    this.trickChain = 0;
    this.trickExtraVx = this.trickExtraVz = 0;
    // Wie viel Spielzeit steht zum Zeichnen zur Verfügung?
    this.drawGameTime = this.airtime * CONFIG.trick.drawPortion;
    this.bus.emit('jump', {
      speed: this.speed,
      airtime: this.airtime,
      onWave: this.rideWaveId !== null,
      position: { x: this.x, z: this.z },
    });
  }

  /** Verbleibende Flugzeit bis zum Wasser (Spielsekunden). */
  get remainingAirtime(): number {
    const g = this.airGravity;
    const h = Math.max(0, this.y - this.waterHeight);
    return (this.vy + Math.sqrt(Math.max(0, this.vy * this.vy + 2 * g * h))) / g;
  }

  /** Nach einem Trick in der Luft: Flug fortsetzen, Zeichenfenster darf erneut aufgehen. */
  continueAfterTrick(): void {
    this.airVx = this.preTrickVx;
    this.airVz = this.preTrickVz;
    this.trickExtraVx = this.trickExtraVz = 0;
    this.drawingDone = false;
    this.drawGameTime = this.remainingAirtime * CONFIG.trick.drawPortion;
  }

  /** Bewegung in der Luft. Gibt true zurück, sobald der Surfer wieder auf dem Wasser ist. */
  airMotion(dt: number): boolean {
    const P = CONFIG.player;
    this.airElapsed += dt;
    this.heading -= this.input.state.steer * this.stats.get('turnRate') * P.airTurnFactor * dt;
    this.x += (this.airVx + this.trickExtraVx) * dt;
    this.z += (this.airVz + this.trickExtraVz) * dt;
    this.y += this.vy * dt;
    this.vy -= this.airGravity * dt;
    // Wellen laufen weiter: Ritt prüfen
    if (this.rideWaveId !== null) this.updateRide(dt);
    const water = this.waterHeight;
    // Landen auf einem Wrackdeck ist auch möglich
    const deck = this.world.wrecks.surfaceAt(this.x, this.z);
    const ground = Math.max(water, deck);
    if (this.y <= ground && this.vy < 0) {
      if (deck > water) {
        const hit = this.world.wrecks.probe(this.x, this.z);
        // Nur von oben aufs Deck (nicht durch den Rumpf von unten)
        if (hit && this.y > deck - 1.2) this.deckWreck = hit.wreck;
        else if (this.y > water) return false;
      }
      this.y = this.deckWreck ? deck : water;
      return true;
    }
    return false;
  }

  /**
   * Startet einen Trick. Der Sprung wird so angepasst, dass die Landung genau
   * am Ende der Trick-Animation erfolgt. `target` = Zielpunkt für Zielsuche (z. B. Monsterkopf).
   */
  startTrick(def: TrickDef, quality: TrickQuality, accuracy: number, target: { x: number; z: number } | null): boolean {
    if (!this.fsm.is('Airborne', 'Drawing')) return false;
    const P = CONFIG.player;
    const T = def.duration;
    const h0 = Math.max(0, this.y - this.waterHeight);
    const travel = def.travel;
    this.preTrickVx = this.airVx;
    this.preTrickVz = this.airVz;
    // Großer Sprung: Flugbahn bleibt, nach dem Trick geht noch einer (Kombo).
    // Sonst Flugbahn so wählen, dass die Landung genau am Trick-Ende liegt (optional mit Mindest-Scheitel).
    const comboRoom = this.remainingAirtime >= T + CONFIG.trick.comboMinAir + CONFIG.player.minAirtimeForTrick;
    if (!comboRoom) {
      this.airGravity = P.gravity;
      if (target && travel?.apex) this.airGravity = solveGravityForApex(h0, travel.apex, T, P.gravity);
      this.vy = Math.max(1, (0.5 * this.airGravity * T * T - h0) / T);
    }
    this.trickExtraVx = this.trickExtraVz = 0;
    if (travel) {
      if (target && travel.homingTag) {
        const dx = target.x - this.x;
        const dz = target.z - this.z;
        const dist = Math.hypot(dx, dz) || 1;
        const total = Math.min(travel.maxDistance ?? 20, dist + (travel.overshoot ?? 0));
        this.airVx = (dx / dist) * (total / T);
        this.airVz = (dz / dist) * (total / T);
        this.heading = Math.atan2(dx, dz);
      } else {
        this.trickExtraVx = this.forwardX * (travel.distance / T);
        this.trickExtraVz = this.forwardZ * (travel.distance / T);
      }
    }
    this.trick = { def, quality, accuracy, hitDone: false };
    this.trickProgress = 0;
    this.trickDuration = T;
    this.trickChain++;
    return this.fsm.transition('TrickPerforming');
  }

  /**
   * Trick in der Nähe eines Bosses: Flugbahn genau auf seinen Kopf (Treffer bei der Ankunft),
   * danach prallt der Surfer weit weg ab (bounceOffBoss) und surft von dort neu an.
   */
  startBossTrick(def: TrickDef, quality: TrickQuality, accuracy: number, head: { x: number; y: number; z: number }): boolean {
    if (!this.fsm.is('Airborne', 'Drawing')) return false;
    const g = CONFIG.player.gravity;
    const dx = head.x - this.x;
    const dz = head.z - this.z;
    const dist = Math.hypot(dx, dz) || 1;
    const T = Math.max(def.duration, Math.min(1.8, dist / 22));
    this.airGravity = g;
    this.vy = (head.y - this.y + 0.5 * g * T * T) / T;
    this.airVx = dx / T;
    this.airVz = dz / T;
    this.trickExtraVx = this.trickExtraVz = 0;
    this.heading = Math.atan2(dx, dz);
    this.bossBounce = { awayX: -dx / dist, awayZ: -dz / dist };
    this.trick = { def, quality, accuracy, hitDone: false };
    this.trickProgress = 0;
    this.trickDuration = T;
    this.trickChain++;
    return this.fsm.transition('TrickPerforming');
  }

  /** Vom Boss-Kopf abprallen: hoch und weit weg, kein neues Zeichenfenster in diesem Sprung. */
  bounceOffBoss(): void {
    const b = this.bossBounce;
    if (!b) return;
    const B = CONFIG.boss;
    this.bossBounce = null;
    this.vy = B.bounceUp;
    this.airGravity = CONFIG.player.gravity;
    this.airVx = b.awayX * B.bounceSpeed;
    this.airVz = b.awayZ * B.bounceSpeed;
    this.trickExtraVx = this.trickExtraVz = 0;
    this.heading = Math.atan2(b.awayX, b.awayZ);
    this.drawingDone = true;
    this.overdrive = Math.max(this.overdrive, 4);
    this.speed = Math.max(this.speed, B.bounceSpeed * 0.8);
    this.bus.emit('launched', { source: 'bounce', airtime: this.remainingAirtime, position: { x: this.x, z: this.z }, power: 1.2 });
  }

  /** Rückstoß (z. B. gegen einen großen Gegner gefahren): Richtung (nx, nz) normiert. */
  knockback(nx: number, nz: number, strength: number): void {
    this.pushVx += nx * strength;
    this.pushVz += nz * strength;
    this.speed *= 0.5;
  }

  /** Sturz (z. B. von einem Monster getroffen). */
  wipeout(): void {
    if (this.fsm.is('Wipeout', 'Lying')) return;
    this.endRide();
    this.trick = null;
    this.bossBounce = null;
    this.speed *= CONFIG.player.wipeoutSpeedFactor;
    this.vy = 0;
    this.y = this.waterHeight;
    this.fsm.transition('Wipeout');
  }

  // -------------------------------------------------------------------------
  // Darstellung
  // -------------------------------------------------------------------------

  private updateVisual(dt: number): void {
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.y = this.heading;

    // Brett an die Wasseroberfläche anlegen (nur auf dem Wasser)
    let targetPitch = 0;
    let targetRoll = 0;
    if (this.deckWreck) {
      // Auf der Rampe: Brett folgt der Deckneigung
      const w = this.deckWreck;
      targetPitch = Math.atan(-w.slope * (this.forwardX * w.dirX + this.forwardZ * w.dirZ));
    } else if (!this.isAirborne) {
      const n = this.world.waves.field.normalAt(this.x, this.z, this.normal, 0.6);
      const c = Math.cos(-this.heading);
      const s = Math.sin(-this.heading);
      const lx = n.x * c + n.z * s;
      const lz = -n.x * s + n.z * c;
      targetPitch = Math.atan2(lz, n.y);
      targetRoll = -Math.atan2(lx, n.y);
    } else if (!this.trick) {
      targetPitch = clamp(-this.vy * 0.03, -0.35, 0.35);
    }
    this.tiltPitch = damp(this.tiltPitch, targetPitch, 10, dt);
    this.tiltRoll = damp(this.tiltRoll, targetRoll, 10, dt);
    const standing = this.fsm.is('Standing');
    const targetLean = standing ? this.inputSteer * ((CONFIG.player.maxLean * Math.PI) / 180) * clamp01(this.speed / 10) : 0;
    this.lean = damp(this.lean, targetLean, 6, dt);
    this.tilt.rotation.set(this.tiltPitch, 0, this.tiltRoll + this.lean, 'ZXY');

    // Trick: Drehung um den Körperschwerpunkt + Brett-Keys
    if (this.trick && this.fsm.is('TrickPerforming')) {
      const anim = this.trick.def.animation;
      SurferAnimator.trickSpin(anim, this.trickProgress, this.tmpEuler);
      this.pivot.rotation.copy(this.tmpEuler);
      SurferAnimator.trickBoard(anim, this.trickProgress, this.tmpVec, this.tmpEuler);
      this.boardHolder.position.copy(this.tmpVec);
      this.boardHolder.rotation.copy(this.tmpEuler);
    } else {
      this.pivot.rotation.set(0, 0, 0);
      this.boardHolder.position.set(0, 0, 0);
      this.boardHolder.rotation.set(0, 0, 0);
    }

    // Sturz: Brett treibt etwas weg
    if (this.fsm.is('Wipeout')) {
      const t = Math.min(1, this.fsm.timeInState / 0.5);
      this.boardHolder.position.set(0.6 * t, -0.05, -0.8 * t);
      this.boardHolder.rotation.set(0, 0.6 * t, 0.15 * t);
      this.rig.object.position.set(0, 0.05 - 0.55 * t, 0);
    } else {
      this.rig.object.position.set(0, 0.05, 0);
    }
  }

  /** Weltposition des Körperschwerpunkts (für Effekte). */
  centerPosition(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.x, this.y + 0.9, this.z);
  }
}

/** Sucht die Schwerkraft, bei der eine Bahn von h0 nach `duration` landet und dabei `apex` erreicht. */
export function solveGravityForApex(h0: number, apex: number, duration: number, minGravity: number): number {
  const apexFor = (g: number) => {
    const vy = (0.5 * g * duration * duration - h0) / duration;
    return vy > 0 ? h0 + (vy * vy) / (2 * g) : h0;
  };
  if (apexFor(minGravity) >= apex) return minGravity;
  let lo = minGravity;
  let hi = 400;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (apexFor(mid) < apex) lo = mid;
    else hi = mid;
  }
  return hi;
}
