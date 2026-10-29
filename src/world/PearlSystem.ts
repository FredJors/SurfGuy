/**
 * Perlen schweben auf den Wellenkämmen und werden durch Darüberfahren eingesammelt.
 * Gezeichnet werden alle Perlen zusammen (Instancing) – wenige Draw-Calls.
 */
import * as THREE from 'three';
import type { AssetLoader } from '../assets/AssetLoader';
import { CONFIG } from '../config/gameConfig';
import type { GameEventBus } from '../core/events';
import type { Rng } from '../core/Rng';
import { InstancedModel } from '../fx/InstancedModel';
import type { WaveSystem } from './WaveSystem';

interface Pearl {
  waveId: number;
  /** Winkel-Versatz zur Wellenmitte (rad) – Perlen wandern mit der Welle */
  angleOffset: number;
  phase: number;
  active: boolean;
}

export class PearlSystem {
  readonly group = new THREE.Group();
  private readonly pool: Pearl[] = [];
  private enabled = false;
  private readonly off: () => void;
  private readonly model: InstancedModel;
  private rot = 0;
  private readonly matrix = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly pos = new THREE.Vector3();
  private readonly one = new THREE.Vector3(1, 1, 1);
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(
    private readonly bus: GameEventBus,
    assets: AssetLoader,
    private readonly waves: WaveSystem,
    private rng: Rng,
  ) {
    this.off = bus.on('waveSpawned', (e) => this.onWaveSpawned(e.waveId));
    this.model = new InstancedModel(assets.create('pearl'), 160, 0.03);
    this.group.add(this.model.group);
  }

  start(rng: Rng): void {
    this.rng = rng;
    this.enabled = true;
  }

  stop(): void {
    this.enabled = false;
    this.clear();
  }

  clear(): void {
    for (const p of this.pool) p.active = false;
  }

  private acquire(): Pearl {
    let p = this.pool.find((q) => !q.active);
    if (!p) {
      p = { waveId: 0, angleOffset: 0, phase: 0, active: false };
      this.pool.push(p);
    }
    return p;
  }

  private onWaveSpawned(waveId: number): void {
    if (!this.enabled) return;
    const wave = this.waves.getWave(waveId);
    if (!wave) return;
    const [n0, n1] = CONFIG.pearls.perWave;
    const count = this.rng.int(n0, n1);
    // Perlen in einer Reihe entlang des Kamms – belohnt seitliches Reiten
    const center = this.rng.range(-wave.halfLength * 0.35, wave.halfLength * 0.35);
    const gap = this.rng.range(5, 8);
    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      p.active = true;
      p.waveId = waveId;
      p.angleOffset = (center + (i - (count - 1) / 2) * gap) / wave.radius;
      p.phase = this.rng.range(0, Math.PI * 2);
    }
  }

  /** Bewegt Perlen mit ihrer Welle und sammelt ein, was der Surfer berührt. */
  update(dt: number, time: number, sx: number, sy: number, sz: number, magnet: number): void {
    const field = this.waves.field;
    this.rot += dt * 2;
    this.quat.setFromAxisAngle(this.up, this.rot);
    this.model.begin();
    for (const p of this.pool) {
      if (!p.active) continue;
      const w = this.waves.getWave(p.waveId);
      if (!w) {
        p.active = false;
        continue;
      }
      // Auf der Wellenfront kurz vor dem Kamm (Richtung Insel)
      const angle = w.angle + p.angleOffset;
      const r = w.radius - CONFIG.pearls.crestOffset;
      const x = field.islandX + Math.cos(angle) * r;
      const z = field.islandZ + Math.sin(angle) * r;
      // Nur sichtbar, wo die Welle an dieser Stelle hoch genug ist
      const near = Math.abs(x - sx) < 220 && Math.abs(z - sz) < 220;
      const visible = near && field.crestHeight(w, p.angleOffset * w.radius) * field.islandFade(x, z) > 0.6;
      if (!visible) continue;
      const y = field.heightAt(x, z) + CONFIG.pearls.hover + Math.sin(time * 3 + p.phase) * 0.12;
      const d = Math.hypot(x - sx, (y - sy) * 0.7, z - sz);
      if (d < magnet) {
        p.active = false;
        this.bus.emit('pearlCollected', { value: CONFIG.pearls.value, position: { x, y, z } });
        continue;
      }
      this.model.add(this.matrix.compose(this.pos.set(x, y, z), this.quat, this.one));
    }
    this.model.end();
  }

  dispose(): void {
    this.off();
  }
}
