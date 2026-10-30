/**
 * Schiffswracks als Rampen: Halb versunkene Schiffe liegen schräg im Wasser – das Heck unter
 * Wasser, der Bug in der Luft. Wer übers Heck aufs Deck fährt, saust die Rampe hoch und hebt
 * am Bug ab (Surfer.ts). Seitlich gegen den Rumpf zu fahren bremst hart.
 *
 * Über jeder Rampe hängt ein Perlenbogen, den man nur im Flug erwischt.
 * Feste Verteilung (gleicher Zufalls-Seed) – die Wracks liegen in jedem Run an derselben Stelle.
 */
import * as THREE from 'three';
import type { AssetLoader } from '../assets/AssetLoader';
import { CONFIG } from '../config/gameConfig';
import { Rng } from '../core/Rng';
import { mergeStatic } from '../fx/merge';
import { addOutline, enableShadows } from '../fx/toon';
import type { ArcPoint, PickupSystem } from './PickupSystem';

export interface Wreck {
  readonly id: number;
  /** Heck-Kante des Decks (Rampenanfang) */
  readonly x: number;
  readonly z: number;
  /** Richtung Heck → Bug (waagrecht, Länge 1) */
  readonly dirX: number;
  readonly dirZ: number;
  /** Waagrechte Länge der Rampe (m) */
  readonly length: number;
  readonly width: number;
  /** Deckhöhe am Heck (unter Wasser) und am Bug */
  readonly baseHeight: number;
  readonly topHeight: number;
  /** Steigung (Höhe pro Meter) */
  readonly slope: number;
  readonly object: THREE.Object3D;
  /** Perlenbogen: liegt gerade aus / wartet auf Neuauflage */
  arcSpawned: boolean;
  arcCooldown: number;
}

export interface WreckLocal {
  /** Entlang der Rampe (0 = Heck, length = Bug) */
  u: number;
  /** Quer (+ = rechts) */
  v: number;
}

/** Wo die Rampen liegen (Standard: Ring um die Insel). */
export interface RampLayout {
  center?: readonly [number, number];
  ringMin?: number;
  ringMax?: number;
  minSpacing?: number;
  /** Bug zeigt zur Mitte (z. B. Krater: Sprung Richtung Titan) statt meist nach außen */
  towardCenter?: boolean;
}

export class WreckSystem {
  readonly group = new THREE.Group();
  readonly wrecks: Wreck[] = [];

  /**
   * @param modelId Modell der Rampen ('wreck' = Schiffswrack, 'debris' = Vulkan-Trümmer)
   * @param count Anzahl (Standard: CONFIG.wrecks.count)
   * @param layout Lage (Standard: Ring um die Insel aus CONFIG.wrecks)
   */
  constructor(
    assets: AssetLoader | null,
    seed = 4242,
    private readonly modelId = 'wreck',
    count: number = CONFIG.wrecks.count,
    layout: RampLayout = {},
  ) {
    const W = {
      ...CONFIG.wrecks,
      count,
      ringMin: layout.ringMin ?? CONFIG.wrecks.ringMin,
      ringMax: layout.ringMax ?? CONFIG.wrecks.ringMax,
      minSpacing: layout.minSpacing ?? CONFIG.wrecks.minSpacing,
    };
    const rng = new Rng(seed);
    const [ix, iz] = layout.center ?? CONFIG.world.islandPosition;
    const b = (CONFIG.world.startBearing * Math.PI) / 180;
    const startX = ix - Math.sin(b) * CONFIG.world.startDistance;
    const startZ = iz + Math.cos(b) * CONFIG.world.startDistance;

    for (let attempt = 0; attempt < W.count * 40 && this.wrecks.length < W.count; attempt++) {
      // Gleichmäßig über die Ringfläche verteilt
      const r = Math.sqrt(rng.range(W.ringMin * W.ringMin, W.ringMax * W.ringMax));
      const a = rng.range(0, Math.PI * 2);
      const cx = ix + Math.cos(a) * r;
      const cz = iz + Math.sin(a) * r;
      if (Math.hypot(cx - startX, cz - startZ) < W.startClearance) continue;
      if (this.wrecks.some((w) => Math.hypot(w.x - cx, w.z - cz) < W.minSpacing)) continue;

      const outward = Math.atan2(cx - ix, cz - iz);
      const heading = layout.towardCenter
        ? outward + Math.PI + rng.range(-0.25, 0.25)
        : rng.chance(W.outwardShare)
          ? outward + rng.range(-0.7, 0.7)
          : rng.range(0, Math.PI * 2);
      const length = rng.range(W.length[0], W.length[1]);
      const width = rng.range(W.width[0], W.width[1]);
      const top = rng.range(W.topHeight[0], W.topHeight[1]);
      const dirX = Math.sin(heading);
      const dirZ = Math.cos(heading);
      // Mittelpunkt (cx, cz) → Heck-Kante
      const x = cx - dirX * length * 0.5;
      const z = cz - dirZ * length * 0.5;
      const slope = (top - W.baseHeight) / length;
      const object = assets ? this.buildModel(assets, length, width, slope, this.wrecks.length + 1) : new THREE.Group();
      object.position.set(x, W.baseHeight, z);
      object.rotation.set(-Math.atan(slope), heading, 0, 'YXZ');
      object.visible = false;
      this.group.add(object);
      this.wrecks.push({ id: this.wrecks.length + 1, x, z, dirX, dirZ, length, width, baseHeight: W.baseHeight, topHeight: top, slope, object, arcSpawned: false, arcCooldown: 0 });
    }
  }

  private buildModel(assets: AssetLoader, length: number, width: number, slope: number, seed: number): THREE.Object3D {
    // Modell-Deck ist schräg → etwas länger als die waagrechte Rampe
    const model = assets.create(this.modelId, { length: length * Math.sqrt(1 + slope * slope), width, seed });
    addOutline(model, 0.06);
    const merged = mergeStatic(model);
    enableShadows(merged, true, true);
    return merged;
  }

  /** Lokale Koordinaten eines Punkts relativ zu einem Wrack. */
  local(w: Wreck, x: number, z: number): WreckLocal {
    const dx = x - w.x;
    const dz = z - w.z;
    return { u: dx * w.dirX + dz * w.dirZ, v: dx * w.dirZ - dz * w.dirX };
  }

  /** Deckhöhe an Position u (m über dem Meeresspiegel). */
  deckHeight(w: Wreck, u: number): number {
    return w.baseHeight + w.slope * Math.min(w.length, Math.max(0, u));
  }

  /** Wrack, dessen Grundfläche den Punkt enthält (oder null). */
  probe(x: number, z: number, margin = 0): { wreck: Wreck; local: WreckLocal } | null {
    for (const w of this.wrecks) {
      // Schneller Vorab-Test über den Umkreis
      const mx = w.x + w.dirX * w.length * 0.5;
      const mz = w.z + w.dirZ * w.length * 0.5;
      if (Math.abs(x - mx) > w.length || Math.abs(z - mz) > w.length) continue;
      const loc = this.local(w, x, z);
      if (loc.u >= -margin && loc.u <= w.length + margin && Math.abs(loc.v) <= w.width / 2 + margin) return { wreck: w, local: loc };
    }
    return null;
  }

  /** Deckhöhe am Punkt, falls über einem Deck (sonst -Infinity). */
  surfaceAt(x: number, z: number): number {
    const hit = this.probe(x, z);
    return hit ? this.deckHeight(hit.wreck, hit.local.u) : -Infinity;
  }

  /** Nächstes Wrack (für Hinweise). */
  nearest(x: number, z: number): { wreck: Wreck; distance: number } | null {
    let best: Wreck | null = null;
    let bestD = Infinity;
    for (const w of this.wrecks) {
      const d = Math.hypot(w.x + w.dirX * w.length * 0.5 - x, w.z + w.dirZ * w.length * 0.5 - z);
      if (d < bestD) {
        bestD = d;
        best = w;
      }
    }
    return best ? { wreck: best, distance: bestD } : null;
  }

  /** Vorhergesagte Flugbahn beim Abheben am Bug mit Tempo `speed` (für den Perlenbogen). */
  arcPoints(w: Wreck, speed: number, count: number): ArcPoint[] {
    const W = CONFIG.wrecks;
    const g = CONFIG.player.gravity;
    const vy = W.launchBase + speed * W.launchSpeedFactor;
    const x0 = w.x + w.dirX * w.length;
    const z0 = w.z + w.dirZ * w.length;
    const y0 = w.topHeight + 0.9; // Körpermitte über dem Brett
    const flight = (vy + Math.sqrt(vy * vy + 2 * g * w.topHeight)) / g;
    const pts: ArcPoint[] = [];
    for (let i = 0; i < count; i++) {
      const t = flight * (0.08 + (0.8 * i) / Math.max(1, count - 1));
      pts.push({ x: x0 + w.dirX * speed * t, y: y0 + vy * t - 0.5 * g * t * t, z: z0 + w.dirZ * speed * t });
    }
    return pts;
  }

  /** Sichtbarkeit nach Entfernung + Perlenbögen in der Nähe des Spielers auslegen. */
  update(dt: number, px: number, pz: number, pickups: PickupSystem | null): void {
    const W = CONFIG.wrecks;
    for (const w of this.wrecks) {
      const d = Math.hypot(w.x - px, w.z - pz);
      w.object.visible = d < W.visibleDistance;
      if (!pickups) continue;
      const tag = `${this.modelId}:${w.id}`;
      if (w.arcSpawned) {
        if (d > 280) {
          pickups.removeTag(tag);
          w.arcSpawned = false;
        } else if (!pickups.hasTag(tag)) {
          // Eingesammelt → nach einer Pause neu auslegen
          w.arcSpawned = false;
          w.arcCooldown = W.arcCooldown;
        }
      } else {
        w.arcCooldown = Math.max(0, w.arcCooldown - dt);
        if (w.arcCooldown <= 0 && d < 220) {
          const pts = this.arcPoints(w, W.arcSpeed, W.arcPearls);
          pickups.spawnArc(pts, tag, Math.floor(pts.length / 2));
          w.arcSpawned = true;
        }
      }
    }
  }

  /** Perlenbögen entfernen (Run-Ende). */
  reset(pickups: PickupSystem): void {
    for (const w of this.wrecks) {
      pickups.removeTag(`${this.modelId}:${w.id}`);
      w.arcSpawned = false;
      w.arcCooldown = 0;
    }
  }
}
