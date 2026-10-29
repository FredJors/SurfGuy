import { describe, expect, it } from 'vitest';
import { AssetLoader } from '../assets/AssetLoader';
import { CONFIG } from '../config/gameConfig';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { Rng } from '../core/Rng';
import { createRunState } from '../core/RunState';
import { createDefaultSave } from '../core/SaveGame';
import { ScoreSystem } from '../core/ScoreSystem';
import { createRegistries, validateContent } from '../data';
import { MONSTER_BEHAVIORS } from '../monsters/behaviors';
import { createPlayerStats } from '../player/Progression';
import { PickupSystem, type Collector } from './PickupSystem';
import { WaveSystem } from './WaveSystem';

function setup() {
  const bus = new EventBus<GameEvents>();
  const content = createRegistries();
  const waves = new WaveSystem(bus, new Rng(1));
  const pickups = new PickupSystem(bus, new AssetLoader(), content, waves.field);
  const stats = createPlayerStats(content, createDefaultSave());
  const score = new ScoreSystem(bus, content, () => stats);
  score.run = createRunState(1, 3);
  const collected: string[] = [];
  bus.on('pickupCollected', (e) => collected.push(e.pickupId));
  pickups.onPickup = (def, pos) => {
    if (def.pearls) pickups.burst(pos.x, pos.y, pos.z, def.pearls);
  };
  // Spieler weit draußen (die Insel liegt bei 0/0)
  const player: Collector = { x: 0, y: 1, z: 600, magnet: stats.get('pearlMagnet') };
  const step = (seconds: number, move?: (t: number) => void) => {
    for (let t = 0; t < seconds; t += 1 / 60) {
      move?.(t);
      score.update(1 / 60);
      pickups.update(1 / 60, t, player, 0);
    }
  };
  return { bus, content, pickups, score, run: score.run, player, collected, step };
}

describe('Einsammeln', () => {
  it('Inhalte sind gültig', () => {
    expect(validateContent(createRegistries(), Object.keys(MONSTER_BEHAVIORS))).toEqual([]);
  });

  it('Schatzkiste: Perlen spritzen heraus und landen alle beim Spieler', () => {
    const { content, pickups, run, player, collected, step } = setup();
    const chest = content.pickups.get('chest');
    pickups.spawnPickupAt(chest, player.x, player.z + 1);
    step(4);
    expect(collected).toEqual(['chest']);
    expect(run.pearls).toBe(chest.pearls);
    // Kette: alle Perlen kurz hintereinander
    expect(run.bestPearlChain).toBe(chest.pearls);
    expect(pickups.count()).toBe(0);
  });

  it('Perlen-Formationen erscheinen vor dem Spieler und werden beim Durchfahren eingesammelt', () => {
    const { pickups, run, player, step } = setup();
    pickups.start(new Rng(9));
    pickups.spawnFormation(player.x, player.z, 0);
    const n = pickups.count();
    expect(n).toBeGreaterThanOrEqual(CONFIG.pickups.formationSize[0]);
    // Zur nächsten Perle fahren (14 m/s), bis alle eingesammelt sind
    step(12, () => {
      const next = pickups.positions().sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0];
      if (!next) return;
      const dx = next.x - player.x;
      const dz = next.z - player.z;
      const d = Math.hypot(dx, dz) || 1;
      player.x += (dx / d) * Math.min(d, 14 / 60);
      player.z += (dz / d) * Math.min(d, 14 / 60);
    });
    expect(run.pearls).toBeGreaterThanOrEqual(n);
  });

  it('Perlen-Bonus (z. B. +50 %) geht nicht durch Runden verloren', () => {
    const bus = new EventBus<GameEvents>();
    const stats = createPlayerStats(createRegistries(), createDefaultSave());
    stats.addSource({ id: 'test', modifiers: [{ stat: 'pearlGain', op: 'addPct', value: 0.5 }] });
    const score = new ScoreSystem(bus, createRegistries(), () => stats);
    const run = createRunState(2, 3);
    score.run = run;
    for (let i = 0; i < 10; i++) bus.emit('pearlCollected', { value: 1, position: { x: 0, y: 0, z: 0 } });
    expect(run.pearls).toBe(15);
  });

  it('Perlenkette gibt Bonuspunkte an den Meilensteinen und reißt nach einer Pause ab', () => {
    const { bus, run, score } = setup();
    const chains: number[] = [];
    bus.on('pearlChain', (e) => {
      if (e.bonus) chains.push(e.count);
    });
    for (let i = 0; i < 10; i++) bus.emit('pearlCollected', { value: 1, position: { x: 0, y: 0, z: 0 } });
    expect(chains).toEqual([10]);
    score.update(CONFIG.pearls.chainWindow + 0.1);
    expect(run.pearlChain).toBe(0);
  });

  it('weit entfernte Objekte verschwinden, Bögen mit Besitzer bleiben', () => {
    const { pickups, player, step } = setup();
    pickups.spawnFormation(player.x, player.z, 0);
    pickups.spawnArc([{ x: 0, y: 5, z: 1000 }], 'wreck:1');
    player.z -= CONFIG.pickups.despawnDistance + 200;
    step(0.1);
    expect(pickups.count('pearl', '')).toBe(0);
    expect(pickups.hasTag('wreck:1')).toBe(true);
    pickups.removeTag('wreck:1');
    expect(pickups.hasTag('wreck:1')).toBe(false);
  });
});
