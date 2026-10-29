import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config/gameConfig';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { Rng } from '../core/Rng';
import { patternAt } from './WaveField';
import { WaveSystem } from './WaveSystem';

function system(seed = 3) {
  const bus = new EventBus<GameEvents>();
  const ws = new WaveSystem(bus, new Rng(seed));
  return { bus, ws, f: ws.field };
}

describe('Wellen um die Insel', () => {
  it('jede Welle ist ein Kreisbogen, der nach innen rollt', () => {
    const { ws, f } = system();
    const w = ws.spawnWave({ angle: 0, startRadius: 700, amplitude: 2, halfLength: 200, speed: 12, setId: 1, indexInSet: 0, isLast: true })!;
    f.advance(10); // voll ausgebildet, 120 m gelaufen
    expect(w.radius).toBeCloseTo(580, 0);
    // Gleiche Höhe auf dem Kamm in verschiedenen Winkeln (Muster herausgerechnet)
    for (const a of [-0.1, 0, 0.1]) {
      const x = f.islandX + Math.cos(w.angle + a) * w.radius;
      const z = f.islandZ + Math.sin(w.angle + a) * w.radius;
      const loc = f.local(w, x, z);
      expect(loc.s).toBeCloseTo(0, 3);
      expect(f.waveHeightAt(w, x, z)).toBeCloseTo(f.crestHeight(w, loc.l), 3);
      // Laufrichtung zeigt zur Insel
      expect(loc.dirX * Math.cos(w.angle + a) + loc.dirZ * Math.sin(w.angle + a)).toBeCloseTo(-1, 3);
    }
    // Neben dem Bogen (gegenüberliegende Seite der Insel) keine Höhe
    expect(f.waveHeightAt(w, f.islandX - w.radius, f.islandZ)).toBe(0);
  });

  it('die Höhe schwankt entlang des Kamms und die Spitzen wandern', () => {
    const { ws, f } = system();
    const w = ws.spawnWave({ angle: 0, startRadius: 700, amplitude: 2, halfLength: 200, speed: 12, setId: 1, indexInSet: 0, isLast: true })!;
    f.advance(8);
    const heights = Array.from({ length: 21 }, (_, i) => patternAt(w, -100 + i * 10));
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.2);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(0.25);
    const before = patternAt(w, 0);
    f.advance(2);
    expect(patternAt(w, 0)).not.toBeCloseTo(before, 3);
  });

  it('Wellen rollen unregelmäßig an – auch rund um die Insel', () => {
    const { ws, bus, f } = system(11);
    const spawned: number[] = [];
    let t = 0;
    bus.on('waveSpawned', () => spawned.push(t));
    ws.start(new Rng(11));
    const angles = new Set<number>();
    const lengths: number[] = [];
    for (let i = 0; i < 60 * 180; i++) {
      t += 1 / 60;
      ws.update(1 / 60, 0, CONFIG.world.startDistance);
      for (const w of f.waves) {
        angles.add(Math.round(w.angle * 2));
        lengths.push(w.halfLength);
      }
    }
    expect(spawned.length).toBeGreaterThan(25);
    const gaps = spawned.slice(1).map((v, i) => v - spawned[i]!).filter((g) => g > 0.5);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(2); // unregelmäßig
    expect(angles.size).toBeGreaterThan(5); // nicht nur in einer Richtung
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeGreaterThan(60); // kurze und lange Wellen
  });
});
