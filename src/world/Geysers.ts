/**
 * Vulkan-Geysire rund um die Insel (gleich außerhalb des Riffs). Ablauf: Ruhe → Blubbern
 * (Warnung, Glut leuchtet) → Ausbruch. Wer beim Ausbruch drüber ist, wird hoch und weit
 * nach außen geschleudert – raus aufs offene Meer, mit Zeit für einen Trick und einem
 * Perlenbogen entlang der Flugbahn.
 */
import * as THREE from 'three';
import { CONFIG } from '../config/gameConfig';
import type { GameEventBus } from '../core/events';
import { clamp01, smoothstep } from '../core/math';
import { Rng } from '../core/Rng';
import { createGlow } from '../fx/Effects';
import { mergeStatic } from '../fx/merge';
import { addOutline, toonMaterial } from '../fx/toon';
import type { ArcPoint } from './PickupSystem';
import type { WaveField } from './WaveField';

export type GeyserPhase = 'idle' | 'warn' | 'erupt';

export interface Geyser {
  readonly id: number;
  readonly x: number;
  readonly z: number;
  /** Wurfrichtung (von der Insel weg) */
  readonly outX: number;
  readonly outZ: number;
  phase: GeyserPhase;
  t: number;
  duration: number;
  readonly root: THREE.Group;
  readonly column: THREE.Mesh;
  readonly crown: THREE.Object3D;
  readonly glow: THREE.Mesh;
}

/** Was der Geysir vom Spieler wissen muss (Surfer erfüllt das). */
export interface GeyserRider {
  x: number;
  z: number;
  readonly isAirborne: boolean;
}

/** Effekte (optional, z. B. in Tests nicht vorhanden). */
export interface GeyserEffects {
  bubbles(pos: THREE.Vector3, count?: number, radius?: number): void;
  splash(pos: THREE.Vector3, strength?: number): void;
}

export class GeyserSystem {
  readonly group = new THREE.Group();
  readonly geysers: Geyser[] = [];
  private readonly rng = new Rng(808);
  private readonly v = new THREE.Vector3();
  private time = 0;

  constructor(
    private readonly bus: GameEventBus,
    private readonly field: WaveField,
  ) {
    const G = CONFIG.geysers;
    const [ix, iz] = CONFIG.world.islandPosition;
    const rockMat = toonMaterial('#4b3b4f');
    const columnMat = toonMaterial('#e8fbff', { emissive: '#7fe3ff', emissiveIntensity: 0.35 });
    const rockGeo = new THREE.IcosahedronGeometry(1, 0);
    const columnGeo = new THREE.CylinderGeometry(1.2, 2.2, 1, 14, 1, true);
    columnGeo.translate(0, 0.5, 0);
    const crownGeo = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < G.count; i++) {
      const a = (i / G.count) * Math.PI * 2 + this.rng.range(-0.15, 0.15);
      const r = this.rng.range(G.ringMin, G.ringMax);
      const x = ix + Math.cos(a) * r;
      const z = iz + Math.sin(a) * r;
      const root = new THREE.Group();
      root.position.set(x, 0, z);
      // Felsring um die Öffnung
      const rocks = new THREE.Group();
      for (let k = 0; k < 9; k++) {
        const ra = (k / 9) * Math.PI * 2 + this.rng.range(-0.2, 0.2);
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set(Math.cos(ra) * (G.radius + 0.8), this.rng.range(-0.6, 0.1), Math.sin(ra) * (G.radius + 0.8));
        rock.scale.set(this.rng.range(1, 1.8), this.rng.range(0.8, 1.6), this.rng.range(1, 1.8));
        rock.rotation.set(this.rng.range(0, 3), this.rng.range(0, 3), 0);
        rocks.add(rock);
      }
      addOutline(rocks, 0.06);
      root.add(mergeStatic(rocks));
      const glow = createGlow(G.radius * 3, '#ff8a3d');
      glow.position.y = 0.08;
      root.add(glow);
      const column = new THREE.Mesh(columnGeo, columnMat);
      column.visible = false;
      root.add(column);
      const crown = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const puff = new THREE.Mesh(crownGeo, columnMat);
        puff.position.set(Math.cos(k * 1.7) * 1.4, k * 0.3, Math.sin(k * 1.7) * 1.4);
        puff.scale.setScalar(1.6 + (k % 2) * 0.5);
        crown.add(puff);
      }
      addOutline(crown, 0.08);
      crown.visible = false;
      root.add(crown);
      this.group.add(root);
      const out = Math.hypot(x - ix, z - iz) || 1;
      this.geysers.push({
        id: i + 1,
        x,
        z,
        outX: (x - ix) / out,
        outZ: (z - iz) / out,
        phase: 'idle',
        t: 0,
        duration: this.rng.range(0, G.idle[1]),
        root,
        column,
        crown,
        glow,
      });
    }
  }

  /** Nächster Geysir (für den HUD-Hinweis). */
  nearest(x: number, z: number): { geyser: Geyser; distance: number } | null {
    let best: Geyser | null = null;
    let bestD = Infinity;
    for (const g of this.geysers) {
      const d = Math.hypot(g.x - x, g.z - z);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    return best ? { geyser: best, distance: bestD } : null;
  }

  /** Flugbahn (Körpermitte) beim Wurf aus einem Geysir – für den Perlenbogen. */
  arcPoints(g: Geyser, count: number): ArcPoint[] {
    const G = CONFIG.geysers;
    const grav = CONFIG.player.gravity;
    const flight = (2 * G.launchVy) / grav;
    const pts: ArcPoint[] = [];
    for (let i = 0; i < count; i++) {
      const t = flight * (0.12 + (0.76 * i) / Math.max(1, count - 1));
      pts.push({ x: g.x + g.outX * G.launchOut * t, y: 0.9 + G.launchVy * t - 0.5 * grav * t * t, z: g.z + g.outZ * G.launchOut * t });
    }
    return pts;
  }

  /**
   * Ablauf aller Geysire. Gibt den Geysir zurück, der den Spieler gerade erfasst (oder null).
   * Den Wurf selbst löst der Aufrufer aus (Surfer.launch).
   */
  update(dt: number, rider: GeyserRider | null, effects?: GeyserEffects): Geyser | null {
    const G = CONFIG.geysers;
    this.time += dt;
    let caught: Geyser | null = null;
    for (const g of this.geysers) {
      g.t += dt;
      if (g.t >= g.duration) {
        g.t = 0;
        if (g.phase === 'idle') {
          g.phase = 'warn';
          g.duration = G.warn;
        } else if (g.phase === 'warn') {
          g.phase = 'erupt';
          g.duration = G.erupt;
          this.bus.emit('geyserErupted', { position: { x: g.x, z: g.z } });
        } else {
          g.phase = 'idle';
          g.duration = this.rng.range(G.idle[0], G.idle[1]);
        }
      }

      const dist = rider ? Math.hypot(rider.x - g.x, rider.z - g.z) : Infinity;
      const near = dist < G.visibleDistance;
      g.root.visible = near;
      if (!near) continue;
      const water = this.field.heightAt(g.x, g.z);
      g.root.position.y = water;

      // Darstellung
      const glowMat = g.glow.material as THREE.MeshBasicMaterial;
      if (g.phase === 'idle') {
        g.column.visible = g.crown.visible = false;
        glowMat.opacity = 0.35 + Math.sin(this.time * 2 + g.id) * 0.1;
        g.glow.scale.setScalar(0.8);
      } else if (g.phase === 'warn') {
        const k = clamp01(g.t / G.warn);
        glowMat.opacity = 0.6 + 0.4 * Math.sin(this.time * 18);
        g.glow.scale.setScalar(0.8 + k * 0.5);
        g.column.visible = true;
        g.crown.visible = false;
        g.column.scale.set(0.6, 0.4 + k * 1.2 + Math.sin(this.time * 30) * 0.2, 0.6);
        if (effects && dist < 150 && Math.random() < dt * 20) effects.bubbles(this.v.set(g.x, water, g.z), 3, G.radius * 0.7);
      } else {
        const k = g.t / G.erupt;
        const rise = smoothstep(0, 0.15, k) * (1 - smoothstep(0.75, 1, k));
        const height = Math.max(0.5, G.columnHeight * rise);
        g.column.visible = g.crown.visible = true;
        const wobble = 1 + Math.sin(this.time * 25) * 0.06;
        g.column.scale.set(wobble, height, wobble);
        g.crown.position.y = height;
        g.crown.scale.setScalar(0.6 + rise * 0.6);
        g.crown.rotation.y += dt * 3;
        glowMat.opacity = 1;
        g.glow.scale.setScalar(1.4);
        if (effects && dist < 220 && Math.random() < dt * 14) effects.splash(this.v.set(g.x, water + height * 0.95, g.z), 1.6);
        if (rider && !rider.isAirborne && dist < G.radius && rise > 0.3) caught = g;
      }
    }
    return caught;
  }
}
