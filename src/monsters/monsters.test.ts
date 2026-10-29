import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AssetLoader } from '../assets/AssetLoader';
import { CONFIG } from '../config/gameConfig';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { Rng } from '../core/Rng';
import { createRunState } from '../core/RunState';
import { createDefaultSave } from '../core/SaveGame';
import { createRegistries } from '../data';
import type { Effects } from '../fx/Effects';
import { InputManager } from '../input/InputManager';
import { createPlayerStats } from '../player/Progression';
import { JointRig } from '../player/rig/CharacterRig';
import { Surfer } from '../player/Surfer';
import { World } from '../world/World';
import type { Kraken } from './Kraken';
import { MonsterSystem } from './MonsterSystem';

const noEffects = { splash() {}, hitSparks() {}, bubbles() {}, sparkle() {}, particles: { emit() {} } } as unknown as Effects;

function setup() {
  const bus = new EventBus<GameEvents>();
  const assets = new AssetLoader();
  const world = new World(bus, assets);
  const content = createRegistries();
  const stats = createPlayerStats(content, createDefaultSave());
  const input = new InputManager();
  const surfer = new Surfer(bus, input, stats, world, new JointRig(assets.create('surfer')), assets.create('board'), content.poses);
  surfer.reset(0, CONFIG.world.startDistance, Math.PI);
  surfer.startPlaying();
  const monsters = new MonsterSystem(bus, content, assets, world, noEffects);
  monsters.start(new Rng(1));
  const run = createRunState(1, 3);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(surfer.x, 4, surfer.z + 8.5);
  const events: { type: string; e: unknown }[] = [];
  for (const t of ['monsterHit', 'monsterDefeated', 'playerHit', 'monsterPartDestroyed', 'monsterSpawned'] as const) bus.on(t, (e) => events.push({ type: t, e }));
  const step = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) monsters.update(1 / 60, surfer, run, stats, camera);
  };
  return { content, monsters, surfer, run, events, step };
}

describe('Kraken', () => {
  it('taucht mit Vorwarnung auf und wird dann angreifbar', () => {
    const { content, monsters, surfer, events, step } = setup();
    const k = monsters.spawn(content.monsters.get('kraken'), 1, surfer.x, surfer.z - 20)!;
    expect(k.phase).toBe('warning');
    expect(k.isTargetable).toBe(false);
    step(content.monsters.get('kraken').warningTime + 1);
    expect(k.isTargetable).toBe(true);
    expect(events.some((x) => x.type === 'monsterSpawned')).toBe(true);
  });

  it('Board-Wirbel trifft Tentakel rundherum doppelt, Salto den Kopf doppelt', () => {
    const { content, monsters, surfer, events, step } = setup();
    const def = content.monsters.get('kraken');
    const k = monsters.spawn(def, 1, surfer.x, surfer.z - 6)! as Kraken;
    k.setPhase('active');
    step(0.5);
    const spin = content.tricks.get('board_spin');
    const hits = monsters.applyTrickHit(spin, 1, surfer.x, 0, surfer.z, surfer.forwardX, surfer.forwardZ);
    expect(hits).toBeGreaterThanOrEqual(3);
    const tentacleHits = events.filter((x) => x.type === 'monsterHit' && (x.e as { partTag: string }).partTag === 'tentacle');
    expect(tentacleHits.length).toBeGreaterThanOrEqual(3);
    for (const h of tentacleHits) expect((h.e as { damage: number; weakness: boolean }).damage).toBe(spin.damage * 2);

    events.length = 0;
    const salto = content.tricks.get('salto');
    monsters.applyTrickHit(salto, 1, surfer.x, 0, surfer.z, surfer.forwardX, surfer.forwardZ);
    const head = events.find((x) => x.type === 'monsterHit');
    expect((head?.e as { partTag: string }).partTag).toBe('head');
    expect((head?.e as { damage: number }).damage).toBe(salto.damage * 2);
  });

  it('wird besiegt und gibt Belohnungen', () => {
    const { content, monsters, surfer, events, step } = setup();
    const k = monsters.spawn(content.monsters.get('kraken'), 1, surfer.x, surfer.z - 6)!;
    k.setPhase('active');
    step(0.3);
    const salto = content.tricks.get('salto');
    for (let i = 0; i < 5 && k.phase === 'active'; i++) {
      monsters.applyTrickHit(salto, 1.5, surfer.x, 0, surfer.z, surfer.forwardX, surfer.forwardZ);
      step(0.1);
    }
    const defeated = events.find((x) => x.type === 'monsterDefeated');
    expect(defeated).toBeDefined();
    expect((defeated!.e as { rewards: { pearls: number } }).rewards.pearls).toBeGreaterThan(0);
    step(3);
    expect(monsters.monsters.length).toBe(0);
  });

  it('greift an: stehender Spieler verliert ein Herz und ist danach kurz unverwundbar', () => {
    const { content, monsters, surfer, run, events, step } = setup();
    const k = monsters.spawn(content.monsters.get('kraken'), 1, surfer.x, surfer.z - 9)!;
    k.setPhase('active');
    step(8);
    const hits = events.filter((x) => x.type === 'playerHit').length;
    expect(hits).toBeGreaterThanOrEqual(1);
    expect(run.hearts).toBe(3 - hits);
    expect(hits).toBeLessThanOrEqual(3);
  });
});

describe('Spawner', () => {
  it('zieht Monster nach Zonen-Gewichtung und Stufe nach Zone', () => {
    const { content, monsters, surfer } = setup();
    const inner = content.zones.get('inner');
    const tiers = new Set<number>();
    for (let i = 0; i < 30; i++) {
      const m = monsters.spawnInZone(inner, surfer)!;
      expect(m.def.zoneWeights[inner.id]).toBeGreaterThan(0);
      tiers.add(m.tier.tier);
    }
    expect(tiers.has(3)).toBe(true);
    const outer = content.zones.get('outer');
    for (let i = 0; i < 20; i++) expect(monsters.spawnInZone(outer, surfer)!.tier.tier).toBe(1);
  });

  it('Zonen werden nach Entfernung zur Insel bestimmt', () => {
    const { monsters } = setup();
    expect(monsters.zoneAt(0, 300).id).toBe('inner');
    expect(monsters.zoneAt(0, 500).id).toBe('middle');
    expect(monsters.zoneAt(0, 900).id).toBe('outer');
  });
});
