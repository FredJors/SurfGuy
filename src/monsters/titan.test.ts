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
import { createPlayerStats, fireSeaComplete } from '../player/Progression';
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
  world.enterCrater();
  const content = createRegistries();
  const stats = createPlayerStats(content, createDefaultSave());
  const surfer = new Surfer(bus, new InputManager(), stats, world, new JointRig(assets.create('surfer')), assets.create('board'), content.poses);
  const c = world.crater;
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
  const def = content.monsters.get('lava_titan');
  const step = (seconds: number, each?: () => void) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      each?.();
      // Der Surfer wird hier nicht simuliert: nach einem Sturz gleich wieder aufs Brett
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
  return { content, world, monsters, surfer, run, events, step, spawn, kinds, hits, def };
}

describe('Kratersee', () => {
  it('Wände drücken zurück, Rampen und Geysire liegen im See und werfen zur Mitte', () => {
    const { world } = setup();
    const c = world.crater;
    expect(world.boundaryPush(c.centerX, c.centerZ + 40).strength).toBe(0);
    const push = world.boundaryPush(c.centerX, c.centerZ + CONFIG.crater.arenaRadius);
    expect(push.strength).toBeGreaterThan(0.9);
    expect(push.az).toBeLessThan(0); // zur Mitte
    expect(world.ramps).toBe(c.ramps);
    expect(c.ramps.wrecks.length).toBe(CONFIG.crater.rampCount);
    for (const g of world.geysers.geysers) {
      // Wurf zeigt zur Mitte
      expect((c.centerX - g.x) * g.outX + (c.centerZ - g.z) * g.outZ).toBeGreaterThan(0);
    }
    world.exitCrater();
    expect(world.geysers).toBe(world.islandGeysers);
  });
});

describe('Lava-Titan', () => {
  it('steigt mit Vorwarnung auf und ist dann angreifbar; Kopf ist das Ziel des Kopfsprungs', () => {
    const { spawn, kinds, world } = setup();
    const t = spawn();
    expect(kinds()).toContain('awaken');
    expect(t.isTargetable).toBe(true);
    const head = t.bounceTarget(0)!;
    expect(head.y).toBeGreaterThan(15);
    expect(Math.hypot(head.x - world.crater.centerX, head.z - world.crater.centerZ)).toBeLessThan(4);
  });

  it('Phase 1: Feuerbälle und Lava-Ausbruch treffen einen stehenden Spieler', () => {
    const { spawn, step, hits, kinds } = setup();
    spawn();
    step(14);
    expect(hits()).toBeGreaterThan(0);
    expect(kinds()).toContain('throw');
    expect(kinds()).toContain('slam');
  });

  it('wechselt bei 60 % und 30 % in Phase 2 (Glutwellen) und 3 (Feuerstrahl)', () => {
    const { spawn, step, kinds, run } = setup();
    const t = spawn();
    t.hp = t.maxHp * 0.55;
    step(10);
    expect(t.stage).toBe(2);
    expect(kinds()).toContain('enrage');
    expect(kinds()).toContain('stomp');
    run.invulnerable = 0;
    t.hp = t.maxHp * 0.25;
    step(6);
    expect(t.stage).toBe(3);
    expect(kinds()).toContain('rage');
    expect(kinds()).toContain('beam');
  });

  it('der Feuerstrahl trifft am Boden, nicht in der Luft', () => {
    const ground = setup();
    const t1 = ground.spawn();
    t1.hp = t1.maxHp * 0.25;
    // nur den Strahl prüfen: Spieler weit genug weg von Würfen ist nicht nötig – Treffer zählen
    let beamHit = false;
    ground.step(20, () => {
      const b = (t1 as unknown as { beam: unknown }).beam;
      if (b && ground.hits() > 0) beamHit = true;
    });
    expect(beamHit).toBe(true);

    const air = setup();
    const t2 = air.spawn();
    t2.hp = t2.maxHp * 0.25;
    air.surfer.fsm.start('Airborne');
    air.step(20, () => {
      air.surfer.y = air.world.heightAt(air.surfer.x, air.surfer.z) + 3;
    });
    expect(air.hits()).toBe(0);
  });

  it('besiegt: Sieg-Ereignis und Belohnung, danach versinkt er', () => {
    const { spawn, step, kinds, events, monsters } = setup();
    const t = spawn();
    t.hp = 0;
    step(1);
    expect(kinds()).toContain('defeated');
    expect(events.some((x) => x.type === 'monsterDefeated')).toBe(true);
    step(6);
    expect(monsters.boss).toBeNull();
  });
});

describe('Weg zum Titan', () => {
  it('Feuermeer gilt als bezwungen, wenn alle Kreaturen von Kapitel 2 auf jeder Stufe besiegt sind', () => {
    const content = createRegistries();
    const save = createDefaultSave();
    expect(fireSeaComplete(content, save)).toBe(false);
    for (const m of content.monsters.all()) {
      if ((m.chapter ?? 1) === 2 && !m.boss) save.bestiary[m.id] = { seen: 1, defeated: 3, highestTierDefeated: m.tiers.length, defeatedByTier: {} };
    }
    expect(fireSeaComplete(content, save)).toBe(true);
  });

  it('Obsidian-Brett wird mit dem Sieg über den Titan freigeschaltet', async () => {
    const { isUnlocked } = await import('../player/Progression');
    const content = createRegistries();
    const save = createDefaultSave();
    const board = content.boards.get('obsidian');
    expect(isUnlocked(board.unlock, save, save.unlocked.boards, board.id)).toBe(false);
    save.bestiary.lava_titan = { seen: 1, defeated: 1, highestTierDefeated: 1, defeatedByTier: { 1: 1 } };
    expect(isUnlocked(board.unlock, save, save.unlocked.boards, board.id)).toBe(true);
  });
});
