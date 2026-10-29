/**
 * Alles, was frei im Meer treibt und eingesammelt wird:
 * - Perlen-Formationen (Linie, Bogen, Ring, Zickzack) vor dem Spieler, teils mit Goldperle
 * - Schatzkisten und Power-ups (data/pickups.ts)
 * - Perlenbögen in der Luft (über Rampen, auf Geysir-Flugbahnen)
 * - herausspritzende Perlen (Kiste, besiegtes Monster), die danach zum Spieler fliegen
 *
 * Perlen in der Nähe fliegen von selbst zum Spieler („Magnet“) – das fühlt sich gut an.
 */
import * as THREE from 'three';
import type { AssetLoader } from '../assets/AssetLoader';
import { CONFIG } from '../config/gameConfig';
import type { GameEventBus } from '../core/events';
import { Rng } from '../core/Rng';
import type { ContentRegistries } from '../data';
import type { PickupDef } from '../data/types';
import { InstancedModel } from '../fx/InstancedModel';
import { addOutline, enableShadows } from '../fx/toon';
import type { WaveField } from './WaveField';

type ItemKind = 'pearl' | 'gold' | 'pickup';

interface Item {
  kind: ItemKind;
  def: PickupDef | null;
  /** Eigenes Modell nur für Kisten/Power-ups; Perlen werden instanziert gezeichnet */
  mesh: THREE.Object3D | null;
  rot: number;
  active: boolean;
  x: number;
  y: number;
  z: number;
  /** Schwimmt auf dem Wasser (sonst feste Höhe, z. B. Bogen in der Luft) */
  floating: boolean;
  vx: number;
  vy: number;
  vz: number;
  /** > 0: fliegt nach einer Ausschüttung frei */
  flight: number;
  homing: boolean;
  homingSpeed: number;
  value: number;
  phase: number;
  age: number;
  /** Besitzer, z. B. 'wreck:3' (zum gezielten Entfernen) */
  tag: string;
}

export interface Collector {
  x: number;
  y: number;
  z: number;
  /** Einsammelradius für Perlen (m) */
  magnet: number;
}

export interface ArcPoint {
  x: number;
  y: number;
  z: number;
}

export class PickupSystem {
  readonly group = new THREE.Group();
  private readonly pools = new Map<string, Item[]>();
  private enabled = false;
  private rng = new Rng(5);
  private formationTimer = 3;
  private specialTimer = 10;
  /** Wird beim Einsammeln einer Kiste/eines Power-ups aufgerufen */
  onPickup: (def: PickupDef, position: THREE.Vector3) => void = () => {};
  private readonly tmp = new THREE.Vector3();
  private readonly pearlModel: InstancedModel;
  private readonly goldModel: InstancedModel;
  private readonly matrix = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly one = new THREE.Vector3(1, 1, 1);
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(
    private readonly bus: GameEventBus,
    private readonly assets: AssetLoader,
    private readonly content: ContentRegistries,
    private readonly field: WaveField,
  ) {
    this.pearlModel = new InstancedModel(assets.create('pearl'), 320, 0.03);
    this.goldModel = new InstancedModel(assets.create('pearl', { gold: true }), 64, 0.03);
    this.group.add(this.pearlModel.group, this.goldModel.group);
  }

  start(rng: Rng): void {
    this.rng = rng;
    this.enabled = true;
    const P = CONFIG.pickups;
    this.formationTimer = 1.5;
    this.specialTimer = rng.range(P.specialInterval[0], P.specialInterval[1]) * 0.6;
  }

  stop(): void {
    this.enabled = false;
    this.clear();
  }

  clear(): void {
    for (const pool of this.pools.values()) for (const it of pool) this.release(it);
  }

  /** Anzahl aktiver Objekte (für Tests/Debug). */
  count(kind?: ItemKind, tag?: string): number {
    let n = 0;
    for (const pool of this.pools.values()) for (const it of pool) if (it.active && (!kind || it.kind === kind) && (tag === undefined || it.tag === tag)) n++;
    return n;
  }

  /** Positionen aktiver Objekte (für Tests/Debug). */
  positions(kind?: ItemKind): { x: number; y: number; z: number }[] {
    const out: { x: number; y: number; z: number }[] = [];
    for (const pool of this.pools.values()) for (const it of pool) if (it.active && (!kind || it.kind === kind)) out.push({ x: it.x, y: it.y, z: it.z });
    return out;
  }

  // -------------------------------------------------------------------------
  // Erzeugen
  // -------------------------------------------------------------------------

  private acquire(kind: ItemKind, def: PickupDef | null = null): Item {
    const key = kind === 'pickup' ? `pickup:${def!.id}` : kind;
    let pool = this.pools.get(key);
    if (!pool) this.pools.set(key, (pool = []));
    let it = pool.find((i) => !i.active);
    if (!it) {
      let mesh: THREE.Object3D | null = null;
      if (kind === 'pickup') {
        mesh = this.assets.create(def!.model, { colors: def!.colors });
        addOutline(mesh, 0.04);
        enableShadows(mesh, true, false);
        this.group.add(mesh);
      }
      it = { kind, def, mesh, rot: 0, active: false, x: 0, y: 0, z: 0, floating: true, vx: 0, vy: 0, vz: 0, flight: 0, homing: false, homingSpeed: 0, value: 1, phase: 0, age: 0, tag: '' };
      pool.push(it);
    }
    it.active = true;
    if (it.mesh) it.mesh.visible = true;
    it.floating = true;
    it.vx = it.vy = it.vz = 0;
    it.flight = 0;
    it.homing = false;
    it.homingSpeed = 0;
    it.value = kind === 'gold' ? CONFIG.pickups.goldValue : 1;
    it.phase = this.rng.range(0, Math.PI * 2);
    it.age = 0;
    it.tag = '';
    return it;
  }

  private release(it: Item): void {
    it.active = false;
    if (it.mesh) it.mesh.visible = false;
  }

  private place(it: Item, x: number, z: number, y?: number): void {
    it.x = x;
    it.z = z;
    if (y === undefined) {
      it.floating = true;
      it.y = this.field.heightAt(x, z) + CONFIG.pickups.hover;
    } else {
      it.floating = false;
      it.y = y;
    }
    it.mesh?.position.set(it.x, it.y, it.z);
  }

  /** Perlen-Formation vor dem Spieler. */
  spawnFormation(px: number, pz: number, heading: number): void {
    const P = CONFIG.pickups;
    const r = this.rng;
    const a = heading + ((r.range(-1, 1) * P.formationAngle) * Math.PI) / 180;
    const d = r.range(P.formationDistance[0], P.formationDistance[1]);
    const cx = px + Math.sin(a) * d;
    const cz = pz + Math.cos(a) * d;
    if (!this.awayFromIsland(cx, cz)) return;
    // Ausrichtung der Formation: grob in Fahrtrichtung
    const dirA = heading + r.range(-0.5, 0.5);
    const fx = Math.sin(dirA);
    const fz = Math.cos(dirA);
    const n = r.int(P.formationSize[0], P.formationSize[1]);
    const shape = r.pick(['line', 'arc', 'ring', 'zigzag'] as const);
    const goldAt = r.chance(P.goldChance) ? (shape === 'ring' ? -1 : n - 1) : -2;
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1);
      let along = (t - 0.5) * n * 3.2;
      let side = 0;
      if (shape === 'arc') side = Math.sin(t * Math.PI) * 6 - 3;
      if (shape === 'zigzag') side = (i % 2 ? 1 : -1) * 2.6;
      if (shape === 'ring') {
        const ang = (i / n) * Math.PI * 2;
        along = Math.cos(ang) * 6;
        side = Math.sin(ang) * 6;
      }
      pts.push([cx + fx * along + fz * side, cz + fz * along - fx * side]);
    }
    pts.forEach(([x, z], i) => this.place(this.acquire(i === goldAt ? 'gold' : 'pearl'), x, z));
    if (goldAt === -1) this.place(this.acquire('gold'), cx, cz);
  }

  /** Kiste oder Power-up vor dem Spieler (gewichtet nach spawnWeight). */
  spawnSpecial(px: number, pz: number, heading: number, def?: PickupDef): Item | null {
    const P = CONFIG.pickups;
    const r = this.rng;
    const chosen = def ?? r.weighted(this.content.pickups.all(), (p) => p.spawnWeight);
    if (!chosen) return null;
    const a = heading + ((r.range(-1, 1) * P.formationAngle * 0.7) * Math.PI) / 180;
    const d = r.range(P.specialDistance[0], P.specialDistance[1]);
    const x = px + Math.sin(a) * d;
    const z = pz + Math.cos(a) * d;
    if (!this.awayFromIsland(x, z)) return null;
    const it = this.acquire('pickup', chosen);
    this.place(it, x, z);
    return it;
  }

  /** Legt ein Objekt an eine feste Stelle (z. B. Tests, Wracks). */
  spawnPickupAt(def: PickupDef, x: number, z: number, tag = ''): void {
    const it = this.acquire('pickup', def);
    it.tag = tag;
    this.place(it, x, z);
  }

  /** Perlenbogen in der Luft (Rampen, Geysire); der Punkt `goldIndex` wird eine Goldperle. */
  spawnArc(points: readonly ArcPoint[], tag: string, goldIndex = -1): void {
    points.forEach((p, i) => {
      const it = this.acquire(i === goldIndex ? 'gold' : 'pearl');
      it.tag = tag;
      this.place(it, p.x, p.z, p.y);
    });
  }

  hasTag(tag: string): boolean {
    return this.count(undefined, tag) > 0;
  }

  removeTag(tag: string): void {
    for (const pool of this.pools.values()) for (const it of pool) if (it.active && it.tag === tag) this.release(it);
  }

  /** Perlen spritzen heraus und fliegen danach zum Spieler (Kiste, Monster, Delfin). */
  burst(x: number, y: number, z: number, pearls: number): void {
    const P = CONFIG.pickups;
    if (pearls <= 0) return;
    const count = Math.min(pearls, P.burstMaxPearls);
    const base = Math.floor(pearls / count);
    let extra = pearls - base * count;
    for (let i = 0; i < count; i++) {
      const it = this.acquire('pearl');
      it.value = base + (extra-- > 0 ? 1 : 0);
      const a = this.rng.range(0, Math.PI * 2);
      const sp = P.burstSpeed * this.rng.range(0.5, 1);
      it.vx = Math.cos(a) * sp;
      it.vz = Math.sin(a) * sp;
      it.vy = this.rng.range(5, 10);
      it.flight = this.rng.range(P.burstTime[0], P.burstTime[1]);
      this.place(it, x, z, y);
    }
  }

  private awayFromIsland(x: number, z: number): boolean {
    return Math.hypot(x - this.field.islandX, z - this.field.islandZ) >= CONFIG.pickups.minIslandDistance;
  }

  // -------------------------------------------------------------------------
  // Aktualisieren & Einsammeln
  // -------------------------------------------------------------------------

  update(dt: number, time: number, player: Collector | null, heading = 0): void {
    const P = CONFIG.pickups;
    if (this.enabled && player) {
      this.formationTimer -= dt;
      if (this.formationTimer <= 0) {
        this.formationTimer = this.rng.range(P.formationInterval[0], P.formationInterval[1]);
        this.spawnFormation(player.x, player.z, heading);
      }
      this.specialTimer -= dt;
      if (this.specialTimer <= 0) {
        this.specialTimer = this.rng.range(P.specialInterval[0], P.specialInterval[1]);
        this.spawnSpecial(player.x, player.z, heading);
      }
    }

    const attract = player ? player.magnet * P.attractFactor : 0;
    this.pearlModel.begin();
    this.goldModel.begin();
    for (const pool of this.pools.values()) {
      for (const it of pool) {
        if (!it.active) continue;
        it.age += dt;
        const isPearl = it.kind !== 'pickup';

        if (it.flight > 0) {
          // Freier Flug nach einer Ausschüttung
          it.flight -= dt;
          it.vy -= CONFIG.player.gravity * dt;
          it.x += it.vx * dt;
          it.y += it.vy * dt;
          it.z += it.vz * dt;
          const floor = this.field.heightAt(it.x, it.z) + 0.3;
          if (it.y < floor) {
            it.y = floor;
            it.vy = Math.abs(it.vy) * 0.4;
          }
          if (it.flight <= 0) it.homing = true;
        } else if (it.homing && player) {
          // Zum Spieler fliegen, immer schneller
          it.homingSpeed = Math.max(it.homingSpeed, P.homingSpeed) + P.homingAccel * dt;
          const dx = player.x - it.x;
          const dy = player.y - it.y;
          const dz = player.z - it.z;
          const d = Math.hypot(dx, dy, dz) || 1;
          const step = Math.min(d, it.homingSpeed * dt);
          it.x += (dx / d) * step;
          it.y += (dy / d) * step;
          it.z += (dz / d) * step;
        } else if (it.floating) {
          it.y = this.field.heightAt(it.x, it.z) + P.hover + Math.sin(time * 3 + it.phase) * (isPearl ? 0.12 : 0.25);
        }

        it.rot += dt * (isPearl ? 2 : 1.2);
        if (it.mesh) {
          it.mesh.position.set(it.x, it.y, it.z);
          it.mesh.rotation.set(0, it.rot, Math.sin(time * 1.7 + it.phase) * 0.12);
        } else {
          this.quat.setFromAxisAngle(this.up, it.rot);
          this.matrix.compose(this.tmp.set(it.x, it.y, it.z), this.quat, this.one);
          (it.kind === 'gold' ? this.goldModel : this.pearlModel).add(this.matrix);
        }

        if (!player) continue;
        const dx = it.x - player.x;
        const dz = it.z - player.z;
        const flat = Math.hypot(dx, dz);
        // Aufräumen: weit weg oder zu alt (nicht, wenn es gerade zum Spieler fliegt)
        if (!it.homing && it.flight <= 0 && it.tag === '' && (flat > P.despawnDistance || it.age > P.maxAge)) {
          this.release(it);
          continue;
        }
        const d = Math.hypot(dx, (it.y - player.y) * 0.7, dz);
        if (isPearl) {
          if (d < (it.homing ? 1.2 : player.magnet)) {
            this.release(it);
            this.tmp.set(it.x, it.y, it.z);
            this.bus.emit('pearlCollected', { value: it.value, position: { x: it.x, y: it.y, z: it.z } });
          } else if (!it.homing && it.flight <= 0 && d < attract) {
            it.homing = true;
          }
        } else if (d < it.def!.radius) {
          this.release(it);
          this.tmp.set(it.x, it.y, it.z);
          this.bus.emit('pickupCollected', { pickupId: it.def!.id, position: { x: it.x, y: it.y, z: it.z } });
          this.onPickup(it.def!, this.tmp);
        }
      }
    }
    this.pearlModel.end();
    this.goldModel.end();
  }
}
