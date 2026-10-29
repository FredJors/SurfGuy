/**
 * Prozedurale Animation des Surfers: wählt je nach Zustand eine Zielpose (aus data/poses.ts),
 * überlagert Bewegungen (Paddeln, Balance, Lehnen) und blendet weich über.
 * Tricks werden komplett aus den Trick-Daten (Posen-Keyframes, Drehungen, Brett-Keys) abgespielt.
 */
import * as THREE from 'three';
import { CONFIG } from '../config/gameConfig';
import { clamp01, easings, smoothstep } from '../core/math';
import type { Registry } from '../core/Registry';
import type { PoseDef, TrickAnimation } from '../data/types';
import type { CharacterRig } from './rig/CharacterRig';
import { Pose } from './rig/Pose';
import type { Surfer } from './Surfer';

const D2R = Math.PI / 180;

export class SurferAnimator {
  private readonly poses = new Map<string, Pose>();
  private readonly current: Pose;
  private readonly target = new Pose();
  private readonly tmpA = new Pose();
  private readonly tmpB = new Pose();
  private paddlePhase = 0;
  private walkPhase = 0;
  private time = 0;
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();

  constructor(
    private readonly rig: CharacterRig,
    poseDefs: Registry<PoseDef>,
  ) {
    for (const def of poseDefs.all()) this.poses.set(def.id, Pose.fromDef(def));
    this.current = new Pose().copy(this.pose('lie'));
    this.current.applyTo(rig);
  }

  private pose(id: string): Pose {
    const p = this.poses.get(id);
    if (!p) throw new Error(`[Animator] unbekannte Pose "${id}"`);
    return p;
  }

  update(dt: number, s: Surfer): void {
    this.time += dt;
    const state = s.fsm.current;
    let rate = 10;
    const steer = s.inputSteer;

    switch (state) {
      case 'Lying':
      case 'Paddling': {
        this.target.copy(this.pose('lie'));
        const paddling = state === 'Paddling' && (s.inputPaddle > 0.05 || Math.abs(steer) > 0.1);
        const strokeRate = paddling ? 1.1 + s.inputPaddle * 0.5 : 0.25;
        this.paddlePhase += dt * strokeRate;
        if (paddling) {
          // Kraulartige Armbewegung: Arme kreisen gegengleich
          for (const [id, offset, side] of [['armL', 0, 1], ['armR', 0.5, -1]] as const) {
            const ph = (this.paddlePhase + offset) % 1;
            const angle = -180 + 360 * ph + (steer * side < 0 ? 25 * Math.abs(steer) : 0);
            this.target.setJointEuler(id, angle, 0, side * (18 + 12 * Math.sin(ph * Math.PI * 2)));
          }
          this.target.setJointEuler('head', -40, Math.sin(this.paddlePhase * Math.PI * 2) * 8, 0);
        } else {
          const bob = Math.sin(this.time * 1.4) * 6;
          this.target.setJointEuler('armL', -160 + bob, 0, 35);
          this.target.setJointEuler('armR', -160 - bob, 0, -35);
          this.target.setJointEuler('legL', 8 + Math.sin(this.time * 1.2) * 8, 0, 8);
          this.target.setJointEuler('legR', 8 - Math.sin(this.time * 1.2) * 8, 0, -8);
        }
        rate = s.fsm.timeInState < 0.5 && state === 'Paddling' ? 6 : 10;
        break;
      }
      case 'Posing': {
        // Lässig stehen, mit einer kleinen „Hang loose“-Geste
        this.target.mix(this.pose('stand'), this.pose('crouch'), 0.1);
        const wave = Math.sin(this.time * 3) * 12;
        this.addJointEuler(this.target, 'armR', -70 + wave, 0, -40);
        this.addJointEuler(this.target, 'forearmR', -40, 0, 0);
        this.addJointEuler(this.target, 'spine', 0, Math.sin(this.time * 0.8) * 6, 0);
        rate = 5;
        break;
      }
      case 'Standing': {
        const speedFrac = clamp01(s.speed / 18);
        this.target.mix(this.pose('stand'), this.pose('crouch'), 0.15 + speedFrac * 0.25 + (s.rideWaveId !== null ? 0.12 : 0));
        // Balance: Arme wippen leicht, Oberkörper lehnt in die Kurve
        const sway = Math.sin(this.time * 2.2) * 5;
        this.addJointEuler(this.target, 'armL', sway, 0, sway * 0.6);
        this.addJointEuler(this.target, 'armR', -sway, 0, sway * 0.6);
        this.addJointEuler(this.target, 'spine', 0, 0, steer * 12);
        // Aufstehen: anfangs langsamer überblenden
        rate = s.fsm.timeInState < CONFIG.player.standUpTime ? 3 / CONFIG.player.standUpTime : 9;
        break;
      }
      case 'Airborne':
      case 'Drawing': {
        const rising = clamp01(s.vy / 4);
        this.target.mix(this.pose('crouch'), this.pose('air'), 0.35 + rising * 0.65);
        rate = 8;
        break;
      }
      case 'TrickPerforming': {
        const trick = s.trick;
        if (trick) this.sampleTrick(trick.def.animation, s.trickProgress, this.target);
        rate = 28;
        break;
      }
      case 'Landing': {
        this.target.copy(this.pose('crouch'));
        rate = 16;
        break;
      }
      case 'Walking': {
        this.target.copy(this.pose('walk'));
        const k = clamp01(s.speed / 3);
        this.walkPhase += dt * (0.4 + s.speed * 0.42);
        const sw = Math.sin(this.walkPhase * Math.PI * 2);
        this.addJointEuler(this.target, 'legL', -sw * 30 * k, 0, 0);
        this.addJointEuler(this.target, 'legR', sw * 30 * k, 0, 0);
        this.addJointEuler(this.target, 'shinL', Math.max(0, sw) * 40 * k, 0, 0);
        this.addJointEuler(this.target, 'shinR', Math.max(0, -sw) * 40 * k, 0, 0);
        this.addJointEuler(this.target, 'armL', sw * 24 * k, 0, 0);
        this.addJointEuler(this.target, 'spine', 0, sw * 4 * k, 0);
        // Im Stehen leicht atmen
        this.addJointEuler(this.target, 'spine', Math.sin(this.time * 1.6) * 2 * (1 - k), 0, 0);
        rate = 12;
        break;
      }
      case 'Wipeout': {
        this.target.copy(this.pose('fall'));
        const flail = Math.sin(this.time * 14) * 25;
        this.addJointEuler(this.target, 'armL', flail, 0, 0);
        this.addJointEuler(this.target, 'armR', -flail, 0, 0);
        rate = 9;
        break;
      }
      default:
        this.target.copy(this.pose('stand'));
    }

    this.current.blendTo(this.target, 1 - Math.exp(-rate * dt));
    this.current.applyTo(this.rig);
  }

  /** Posen-Keyframes eines Tricks zum Zeitpunkt t (0..1) auswerten. */
  sampleTrick(anim: TrickAnimation, t: number, out: Pose): void {
    const keys = anim.poses;
    if (keys.length === 0) return;
    if (t <= keys[0]!.t) {
      out.copy(this.pose(keys[0]!.pose));
      return;
    }
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i]!;
      const b = keys[i + 1]!;
      if (t <= b.t) {
        const local = smoothstep(a.t, b.t, t);
        out.mix(this.tmpA.copy(this.pose(a.pose)), this.tmpB.copy(this.pose(b.pose)), local);
        return;
      }
    }
    out.copy(this.pose(keys[keys.length - 1]!.pose));
  }

  /** Drehung des ganzen Surfers (Salto, Wirbel …) für Fortschritt t. */
  static trickSpin(anim: TrickAnimation, t: number, out: THREE.Euler): THREE.Euler {
    const spin = anim.spin;
    if (!spin) return out.set(0, 0, 0);
    const k = easings[spin.ease ?? 'inOutQuad'](clamp01(t));
    const full = Math.PI * 2 * k;
    return out.set((spin.pitch ?? 0) * full, (spin.yaw ?? 0) * full, (spin.roll ?? 0) * full, 'YXZ');
  }

  /** Brett-Offset/-Drehung aus den Trick-Keys für Fortschritt t. */
  static trickBoard(anim: TrickAnimation, t: number, offset: THREE.Vector3, rot: THREE.Euler): boolean {
    const keys = anim.board;
    if (!keys || keys.length === 0) {
      offset.set(0, 0, 0);
      rot.set(0, 0, 0);
      return false;
    }
    let a = keys[0]!;
    let b = keys[keys.length - 1]!;
    for (let i = 0; i < keys.length - 1; i++) {
      if (t >= keys[i]!.t && t <= keys[i + 1]!.t) {
        a = keys[i]!;
        b = keys[i + 1]!;
        break;
      }
    }
    const k = a === b ? 0 : smoothstep(a.t, b.t, t);
    offset.set(
      a.offset[0] + (b.offset[0] - a.offset[0]) * k,
      a.offset[1] + (b.offset[1] - a.offset[1]) * k,
      a.offset[2] + (b.offset[2] - a.offset[2]) * k,
    );
    rot.set(
      (a.rotation[0] + (b.rotation[0] - a.rotation[0]) * k) * D2R,
      (a.rotation[1] + (b.rotation[1] - a.rotation[1]) * k) * D2R,
      (a.rotation[2] + (b.rotation[2] - a.rotation[2]) * k) * D2R,
    );
    return true;
  }

  private addJointEuler(p: Pose, id: Parameters<Pose['setJointEuler']>[0], x: number, y: number, z: number): void {
    this.e.set(x * D2R, y * D2R, z * D2R);
    this.q.setFromEuler(this.e);
    p.joints[id].multiply(this.q);
  }
}
