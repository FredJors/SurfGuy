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
import { createPlayerStats, iceSeaComplete, isUnlocked } from '../player/Progression';
import { JointRig } from '../player/rig/CharacterRig';
import { Surfer } from '../player/Surfer';
import { World } from '../world/World';
import { MonsterSystem } from './MonsterSystem';
import type { Titan } from './Titan';

const noEffects = { splash() {}, hitSparks() {}, bubbles() {}, sparkle() {}, particles: { emit() {} } } as unknown as Effects;

function setup() {
  const bus = new EventBus<GameEvents>();
  const assets = new AssetLoader();
  const world = new World(bus, assets);
  world.enterCrater('glacier');
  const content = createRegistries();
  const stats = createPlayerStats(content, createDefaultSave());
  const surfer = new Surfer(bus, new InputManager(), stats, world, new JointRig(assets.create('surfer')), assets.create('board'), content.poses);
  const c = world.glacier;
  surfer.reset(c.centerX, c.centerZ + 40, Math.PI);
  surfer.startPlaying();
  const monsters = new MonsterSystem(bus, content, assets, world, noEffects);
  monsters.start(new Rng(5));
  monsters.spawning = false;
  const run = createRunState(1, 99);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(surfer.x, 4, surfer.z + 8.5);
  const events: { type: string; e: unknown }[] = [];
  for (const t of ['monsterDefeated', 'playerHit', 'bossEvent'] as const) bus.on(t, (e) => events.push({ type: t, e }));
  const def = content.monsters.get('frost_colossus');
  const step = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      if (surfer.fsm.is('Wipeout')) surfer.fsm.start('Standing');
      monsters.update(1 / 60, surfer, run, stats, camera);
      if (run.invulnerable > 0) run.invulnerable -= 1 / 60;
    }
  };
  const spawn = () => {
    const t = monsters.spawn(def, 1, c.centerX, c.centerZ) as Titan;
    step(def.warningTime + 0.5);
    return t;
  };
  const kinds = () => events.filter((x) => x.type === 'bossEvent').map((x) => (x.e as { kind: string }).kind);
  const hits = () => events.filter((x) => x.type === 'playerHit').length;
  return { content, world, monsters, run, events, step, spawn, kinds, hits };
}

describe('Gletscherlagune', () => {
  it('liegt abseits von Insel und Kratersee, Wände drücken zurück, Eisberg-Rampen liegen im See', () => {
    const { world } = setup();
    const c = world.glacier;
    expect(world.arena).toBe(c);
    expect(world.inCrater).toBe(true);
    expect(Math.hypot(c.centerX - world.crater.centerX, c.centerZ - world.crater.centerZ)).toBeGreaterThan(2000);
    expect(world.boundaryPush(c.centerX, c.centerZ + 40).strength).toBe(0);
    expect(world.boundaryPush(c.centerX, c.centerZ + CONFIG.glacier.arenaRadius).strength).toBeGreaterThan(0.9);
    expect(world.ramps).toBe(c.ramps);
    expect(c.ramps.wrecks.length).toBe(CONFIG.glacier.rampCount);
    for (const g of world.geysers.geysers) {
      expect((c.centerX - g.x) * g.outX + (c.centerZ - g.z) * g.outZ).toBeGreaterThan(0);
    }
    world.exitCrater();
    expect(world.geysers).toBe(world.islandGeysers);
  });
});

describe('Frostkoloss', () => {
  it('kämpft wie der Titan in drei Phasen, aber mit Eis (Frostwelle, Schneesturm)', () => {
    const { spawn, step, kinds, hits, run } = setup();
    const t = spawn();
    expect(kinds()).toContain('awaken');
    expect(t.def.chapter).toBe(3);
    step(14);
    expect(hits()).toBeGreaterThan(0);
    expect(t.jumpThreatLabel()).toBe('Frostwelle!');
    t.hp = t.maxHp * 0.55;
    run.invulnerable = 0;
    step(10);
    expect(t.stage).toBe(2);
    t.hp = t.maxHp * 0.25;
    run.invulnerable = 0;
    step(6);
    expect(t.stage).toBe(3);
    expect(kinds()).toContain('beam');
    expect(t.jumpThreatLabel()).toMatch(/Schneesturm|Frostwelle/);
  });

  it('lässt sich nicht einfrieren; Feuer-Rad trifft doppelt, Frost-Tricks kaum', () => {
    const { spawn, content } = setup();
    const t = spawn();
    expect(t.freeze(3)).toBe(false);
    const w = content.monsters.get('frost_colossus').weaknesses;
    const mul = (id: string) => w.find((x) => x.trick === id)?.multiplier ?? 1;
    expect(mul('fire_wheel')).toBeGreaterThan(1.5);
    expect(mul('frost_nova')).toBeLessThan(1);
  });

  it('besiegt: Sieg-Ereignis mit Belohnung, danach versinkt er', () => {
    const { spawn, step, kinds, events, monsters } = setup();
    const t = spawn();
    t.hp = 0;
    step(1);
    expect(kinds()).toContain('defeated');
    expect(events.some((x) => x.type === 'monsterDefeated' && (x.e as { monsterId: string }).monsterId === 'frost_colossus')).toBe(true);
    step(6);
    expect(monsters.boss).toBeNull();
  });
});

describe('Weg zum Frostkoloss', () => {
  it('Eismeer gilt als bezwungen, wenn alle Kreaturen von Kapitel 3 auf jeder Stufe besiegt sind', () => {
    const content = createRegistries();
    const save = createDefaultSave();
    expect(iceSeaComplete(content, save)).toBe(false);
    for (const m of content.monsters.all()) {
      if ((m.chapter ?? 1) === 3 && !m.boss) save.bestiary[m.id] = { seen: 1, defeated: 3, highestTierDefeated: m.tiers.length, defeatedByTier: {} };
    }
    expect(iceSeaComplete(content, save)).toBe(true);
  });

  it('Polarlicht-Brett gibt es für den Sieg über den Frostkoloss', () => {
    const content = createRegistries();
    const save = createDefaultSave();
    const board = content.boards.get('aurora');
    expect(isUnlocked(board.unlock, save, save.unlocked.boards, board.id)).toBe(false);
    save.bestiary.frost_colossus = { seen: 1, defeated: 1, highestTierDefeated: 1, defeatedByTier: { 1: 1 } };
    expect(isUnlocked(board.unlock, save, save.unlocked.boards, board.id)).toBe(true);
  });
});
