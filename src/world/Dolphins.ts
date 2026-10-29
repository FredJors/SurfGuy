/**
 * Delfin-Schulen: tauchen nahe der Insel auf und schwimmen springend nach außen, aufs offene
 * Meer. Wer sich dranhängt (nah dran, gleiche Richtung), wird im Windschatten mitgezogen,
 * bekommt Tempo über dem Höchsttempo, Perlen und Punkte.
 */
import * as THREE from 'three';
import type { AssetLoader } from '../assets/AssetLoader';
import { CONFIG } from '../config/gameConfig';
import type { GameEventBus } from '../core/events';
import { Rng } from '../core/Rng';
import { addOutline } from '../fx/toon';
import type { PickupSystem } from './PickupSystem';
import type { WaveField } from './WaveField';

/** Was die Delfine vom Spieler brauchen (Surfer erfüllt das). */
export interface DolphinRider {
  x: number;
  z: number;
  speed: number;
  overdrive: number;
  readonly forwardX: number;
  readonly forwardZ: number;
  readonly isAirborne: boolean;
}

interface Dolphin {
  mesh: THREE.Object3D;
  tail: THREE.Object3D | undefined;
  side: number;
  back: number;
  phase: number;
  x: number;
  y: number;
  z: number;
  wasUp: boolean;
}

export interface DolphinSplash {
  splash(pos: THREE.Vector3, strength?: number): void;
}

const LEAP_PERIOD = 1.9;
const LEAP_SHARE = 0.55;

export class DolphinSystem {
  readonly group = new THREE.Group();
  private readonly pool: Dolphin[] = [];
  private active: Dolphin[] = [];
  private enabled = false;
  private rng = new Rng(11);
  private timer = 6;
  private time = 0;
  // Schule
  private x = 0;
  private z = 0;
  private dirX = 0;
  private dirZ = 1;
  private speed = 0;
  private traveled = 0;
  private dive = 0;
  private pearlTimer = 0;
  riding = false;
  private readonly v = new THREE.Vector3();

  constructor(
    private readonly bus: GameEventBus,
    private readonly assets: AssetLoader,
    private readonly field: WaveField,
  ) {}

  get schoolActive(): boolean {
    return this.active.length > 0;
  }

  start(rng: Rng): void {
    this.rng = rng;
    this.enabled = true;
    this.timer = rng.range(4, 8);
  }

  stop(): void {
    this.enabled = false;
    this.clear();
  }

  clear(): void {
    for (const d of this.active) d.mesh.visible = false;
    this.active = [];
    this.setRiding(false);
  }

  /** Schule nahe beim Spieler starten: etwas weiter innen und seitlich, schwimmt nach außen. */
  spawn(px: number, pz: number): void {
    const D = CONFIG.dolphins;
    const r = this.rng;
    this.clear();
    const ix = this.field.islandX;
    const iz = this.field.islandZ;
    const out = Math.hypot(px - ix, pz - iz) || 1;
    this.dirX = (px - ix) / out;
    this.dirZ = (pz - iz) / out;
    const back = r.range(D.spawnBack[0], D.spawnBack[1]);
    const side = r.range(D.spawnSide[0], D.spawnSide[1]) * (r.chance(0.5) ? 1 : -1);
    this.x = px - this.dirX * back + this.dirZ * side;
    this.z = pz - this.dirZ * back - this.dirX * side;
    this.speed = D.speed;
    this.traveled = 0;
    this.dive = 0;
    this.pearlTimer = 0;
    const n = r.int(D.count[0], D.count[1]);
    for (let i = 0; i < n; i++) {
      const d = this.acquire(i);
      // V-Formation
      d.side = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 2.6;
      d.back = Math.ceil(i / 2) * 2.8;
      d.phase = r.range(0, LEAP_PERIOD);
      d.wasUp = false;
      d.mesh.visible = true;
      this.active.push(d);
    }
    this.bus.emit('dolphinsSpotted', { position: { x: this.x, z: this.z } });
  }

  private acquire(i: number): Dolphin {
    let d = this.pool[i];
    if (!d) {
      const mesh = this.assets.create('dolphin');
      addOutline(mesh, 0.035);
      mesh.scale.setScalar(1.45);
      this.group.add(mesh);
      d = { mesh, tail: mesh.getObjectByName('tail') ?? undefined, side: 0, back: 0, phase: 0, x: 0, y: 0, z: 0, wasUp: false };
      this.pool[i] = d;
    }
    return d;
  }

  private setRiding(on: boolean): void {
    if (this.riding === on) return;
    this.riding = on;
    this.bus.emit('dolphinRide', { active: on });
  }

  update(dt: number, rider: DolphinRider | null, maxSpeed: number, pickups: PickupSystem | null, fx?: DolphinSplash): void {
    const D = CONFIG.dolphins;
    this.time += dt;

    if (this.enabled && rider && !this.schoolActive) {
      this.timer -= dt;
      const d = Math.hypot(rider.x - this.field.islandX, rider.z - this.field.islandZ);
      if (this.timer <= 0 && d >= D.minDistance && d <= D.maxDistance) {
        this.timer = this.rng.range(D.interval[0], D.interval[1]);
        this.spawn(rider.x, rider.z);
      }
    }
    if (!this.schoolActive) return;

    // Schule bewegen (beim Mitschwimmen hält sie mit dem Spieler mit)
    const speed = this.riding && rider ? Math.max(this.speed, rider.speed * 0.97) : this.speed;
    this.x += this.dirX * speed * dt;
    this.z += this.dirZ * speed * dt;
    this.traveled += speed * dt;
    const far = rider ? Math.hypot(rider.x - this.x, rider.z - this.z) > D.visibleDistance : true;
    if ((this.traveled > D.travel || far) && this.dive === 0) this.dive = 0.001;
    if (this.dive > 0) {
      this.dive += dt;
      if (this.dive > 1.2) {
        this.clear();
        return;
      }
    }

    // Delfine: springen im Wechsel
    const perpX = this.dirZ;
    const perpZ = -this.dirX;
    const yaw = Math.atan2(this.dirX, this.dirZ);
    let nearest = Infinity;
    let nearestD: Dolphin | null = null;
    for (const d of this.active) {
      d.x = this.x - this.dirX * d.back + perpX * d.side;
      d.z = this.z - this.dirZ * d.back + perpZ * d.side;
      const water = this.field.heightAt(d.x, d.z);
      const k = (((this.time + d.phase) % LEAP_PERIOD) + LEAP_PERIOD) % LEAP_PERIOD / LEAP_PERIOD;
      let pitch = 0;
      if (k < LEAP_SHARE && this.dive === 0) {
        const u = k / LEAP_SHARE;
        d.y = water - 0.4 + Math.sin(Math.PI * u) * 2.6;
        pitch = Math.cos(Math.PI * u) * 0.75;
      } else {
        d.y = water - 0.55 - this.dive * 3 + Math.sin(this.time * 4 + d.phase) * 0.08;
      }
      const up = d.y > water;
      if (up !== d.wasUp && fx && rider && Math.hypot(d.x - rider.x, d.z - rider.z) < 120) fx.splash(this.v.set(d.x, water, d.z), 0.7);
      d.wasUp = up;
      d.mesh.position.set(d.x, d.y, d.z);
      d.mesh.rotation.set(-pitch, yaw, 0, 'YXZ');
      if (d.tail) d.tail.rotation.x = Math.sin(this.time * 9 + d.phase) * 0.35;
      if (rider) {
        const dist = Math.hypot(d.x - rider.x, d.z - rider.z);
        if (dist < nearest) {
          nearest = dist;
          nearestD = d;
        }
      }
    }

    // Windschatten
    if (!rider || this.dive > 0) {
      this.setRiding(false);
      return;
    }
    const aligned = rider.forwardX * this.dirX + rider.forwardZ * this.dirZ > 0.4;
    const ride = !rider.isAirborne && aligned && nearest < D.rideRadius;
    this.setRiding(ride);
    if (!ride || !nearestD) return;
    rider.overdrive = Math.max(rider.overdrive, D.rideBonus);
    const target = Math.min(maxSpeed + rider.overdrive, Math.max(this.speed, rider.speed) + D.rideBonus * 0.6);
    if (rider.speed < target) rider.speed = Math.min(target, rider.speed + 8 * dt);
    // Leichter Zug Richtung Schule (seitlich)
    const off = (rider.x - this.x) * perpX + (rider.z - this.z) * perpZ;
    const pull = Math.max(-1, Math.min(1, off / D.rideRadius)) * D.pull * dt;
    rider.x -= perpX * pull;
    rider.z -= perpZ * pull;
    this.pearlTimer -= dt;
    if (this.pearlTimer <= 0 && pickups) {
      this.pearlTimer = D.pearlInterval;
      pickups.burst(nearestD.x, Math.max(nearestD.y, this.field.heightAt(nearestD.x, nearestD.z)) + 1, nearestD.z, 1);
    }
  }
}
