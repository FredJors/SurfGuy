/**
 * Perlen schweben auf den Wellenkämmen und werden durch Darüberfahren eingesammelt.
 */
import * as THREE from 'three';
import type { AssetLoader } from '../assets/AssetLoader';
import { CONFIG } from '../config/gameConfig';
import type { GameEventBus } from '../core/events';
import type { Rng } from '../core/Rng';
import { addOutline } from '../fx/toon';
import type { WaveSystem } from './WaveSystem';

interface Pearl {
  mesh: THREE.Object3D;
  waveId: number;
  lateral: number;
  phase: number;
  active: boolean;
}

export class PearlSystem {
  readonly group = new THREE.Group();
  private readonly pool: Pearl[] = [];
  private enabled = false;
  private readonly off: () => void;

  constructor(
    private readonly bus: GameEventBus,
    private readonly assets: AssetLoader,
    private readonly waves: WaveSystem,
    private rng: Rng,
  ) {
    this.off = bus.on('waveSpawned', (e) => this.onWaveSpawned(e.waveId));
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
    for (const p of this.pool) {
      p.active = false;
      p.mesh.visible = false;
    }
  }

  private acquire(): Pearl {
    let p = this.pool.find((q) => !q.active);
    if (!p) {
      const mesh = this.assets.create('pearl');
      addOutline(mesh, 0.03);
      this.group.add(mesh);
      p = { mesh, waveId: 0, lateral: 0, phase: 0, active: false };
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
      p.lateral = center + (i - (count - 1) / 2) * gap;
      p.phase = this.rng.range(0, Math.PI * 2);
      p.mesh.visible = false;
    }
  }

  /** Bewegt Perlen mit ihrer Welle und sammelt ein, was der Surfer berührt. */
  update(dt: number, time: number, sx: number, sy: number, sz: number, magnet: number): void {
    const field = this.waves.field;
    for (const p of this.pool) {
      if (!p.active) continue;
      const w = this.waves.getWave(p.waveId);
      if (!w) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      const off = CONFIG.pearls.crestOffset;
      const x = w.crestX + w.dirX * off - w.dirZ * p.lateral;
      const z = w.crestZ + w.dirZ * off + w.dirX * p.lateral;
      const amp = field.currentAmplitude(w);
      // Erst sichtbar, wenn die Welle hoch genug ist
      p.mesh.visible = amp > 0.6;
      const y = field.heightAt(x, z) + CONFIG.pearls.hover + Math.sin(time * 3 + p.phase) * 0.12;
      p.mesh.position.set(x, y, z);
      p.mesh.rotation.y += dt * 2;
      if (!p.mesh.visible) continue;
      const d = Math.hypot(x - sx, (y - sy) * 0.7, z - sz);
      if (d < magnet) {
        p.active = false;
        p.mesh.visible = false;
        this.bus.emit('pearlCollected', { value: CONFIG.pearls.value, position: { x, y, z } });
      }
    }
  }

  dispose(): void {
    this.off();
  }
}
