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
import { Crab } from './Crab';
import { MonsterSystem } from './MonsterSystem';

const noEffects = { splash() {}, hitSparks() {}, bubbles() {}, sparkle() {}, particles: { emit() {} } } as unknown as Effects;

function setup() {
  const bus = new EventBus<GameEvents>();
  const assets = new AssetLoader();
  const world = new World(bus, assets);
  const content = createRegistries();
  const stats = createPlayerStats(content, createDefaultSave());
  const surfer = new Surfer(bus, new InputManager(), stats, world, new JointRig(assets.create('surfer')), assets.create('board'), content.poses);
  // Spieler vor dem Riff, Krabbe auf der Sandbank zwischen ihm und der Insel
  surfer.reset(0, CONFIG.boss.sandbankDistance + 40, Math.PI);
  surfer.startPlaying();
  const monsters = new MonsterSystem(bus, content, assets, world, noEffects);
  monsters.start(new Rng(7));
  const run = createRunState(1, 99);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(surfer.x, 4, surfer.z + 8.5);
  const events: { type: string; e: unknown }[] = [];
  for (const t of ['monsterDefeated', 'playerHit', 'bossEvent', 'monsterHit'] as const) bus.on(t, (e) => events.push({ type: t, e }));
  const def = content.monsters.get('giant_crab');
  const step = (seconds: number, each?: () => void) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      each?.();
      monsters.update(1 / 60, surfer, run, stats, camera);
      if (run.invulnerable > 0) run.invulnerable -= 1 / 60;
    }
  };
  const spawnCrab = () => {
    const crab = monsters.spawn(def, 1, 0, CONFIG.boss.sandbankDistance) as Crab;
    step(def.warningTime + 2.5);
    return crab;
  };
  const kinds = () => events.filter((x) => x.type === 'bossEvent').map((x) => (x.e as { kind: string }).kind);
  return { content, world, monsters, surfer, run, events, step, spawnCrab, kinds, def };
}

describe('Endgegner: Wächter der Insel (Riesenkrabbe)', () => {
  it('erwacht mit Vorwarnung und wird dann angreifbar', () => {
    const { monsters, def, step, kinds } = setup();
    const crab = monsters.spawn(def, 1, 0, CONFIG.boss.sandbankDistance) as Crab;
    expect(crab.isTargetable).toBe(false);
    expect(monsters.boss).toBe(crab);
    step(def.warningTime + 0.1);
    expect(kinds()).toContain('awaken');
    step(2.5);
    expect(crab.phase).toBe('active');
  });

  it('wirft Felsbrocken – wer stehen bleibt, wird getroffen', () => {
    const { spawnCrab, step, events, kinds } = setup();
    spawnCrab();
    step(12);
    expect(kinds()).toContain('throw');
    expect(kinds()).toContain('impact');
    expect(events.some((x) => x.type === 'playerHit' && (x.e as { source: string }).source === 'giant_crab')).toBe(true);
  });

  it('hoch genug in der Luft verfehlen die Felsbrocken', () => {
    const { spawnCrab, step, events, surfer, kinds } = setup();
    spawnCrab();
    surfer.fsm.start('Airborne');
    step(12, () => (surfer.y = 6));
    expect(kinds().filter((k) => k === 'impact').length).toBeGreaterThan(1);
    expect(events.some((x) => x.type === 'playerHit')).toBe(false);
  });

  it('nur Tricks tun ihr weh; ab halber Kraft wird sie wütend und stampft Ringwellen', () => {
    const { content, spawnCrab, monsters, surfer, step, kinds, events } = setup();
    const crab = spawnCrab();
    const slam = content.tricks.get('board_slam');
    // Richtung Krabbe schauen und Tricks landen, bis sie halb besiegt ist
    surfer.heading = Math.atan2(crab.x - surfer.x, crab.z - surfer.z);
    surfer.x = crab.x;
    surfer.z = crab.z + 14;
    let n = 0;
    while (crab.hp > crab.maxHp * 0.5 && n++ < 100) monsters.applyTrickHit(slam, 1, surfer.x, 0, surfer.z, surfer.forwardX, surfer.forwardZ);
    expect(events.some((x) => x.type === 'monsterHit')).toBe(true);
    step(0.2);
    expect(crab.enraged).toBe(true);
    expect(kinds()).toContain('enrage');
    step(10);
    expect(kinds()).toContain('stomp');
  });

  it('Ringwelle: stehen bleiben = Treffer, drüberspringen = kein Treffer', () => {
    const a = setup();
    const crabA = a.spawnCrab();
    crabA.hp = crabA.maxHp * 0.4;
    // Außerhalb der Wurfweite, aber in Reichweite der Ringwelle → nur die Welle kann treffen
    const far = (a.def.behaviorParams!.throwRange! + a.def.behaviorParams!.ringRange!) / 2;
    a.surfer.x = crabA.x;
    a.surfer.z = crabA.z + far;
    a.step(14);
    const ringHits = a.events.filter((x) => x.type === 'playerHit').length;
    expect(a.kinds()).toContain('stomp');
    expect(ringHits).toBeGreaterThan(0);

    const b = setup();
    const crabB = b.spawnCrab();
    crabB.hp = crabB.maxHp * 0.4;
    b.surfer.x = crabB.x;
    b.surfer.z = crabB.z + far;
    b.surfer.fsm.start('Airborne');
    b.step(14, () => (b.surfer.y = 4));
    expect(b.kinds()).toContain('stomp');
    expect(b.events.filter((x) => x.type === 'playerHit').length).toBe(0);
  });

  it('Sieg durch Tricks: Belohnung, Siegesmeldung, Krabbe verschwindet', () => {
    const { content, spawnCrab, monsters, surfer, step, events, kinds } = setup();
    const crab = spawnCrab();
    const salto = content.tricks.get('salto');
    surfer.x = crab.x;
    surfer.z = crab.z + 14;
    surfer.heading = Math.PI;
    let n = 0;
    while (!crab.isDefeated && n++ < 200) monsters.applyTrickHit(salto, 1.5, surfer.x, 0, surfer.z, surfer.forwardX, surfer.forwardZ);
    expect(crab.isDefeated).toBe(true);
    step(5);
    expect(kinds()).toContain('defeated');
    const def = events.find((x) => x.type === 'monsterDefeated');
    expect((def!.e as { monsterId: string }).monsterId).toBe('giant_crab');
    expect(monsters.boss).toBe(null);
  });

  it('taucht nie zufällig auf', () => {
    const { content, monsters, surfer } = setup();
    for (const zone of content.zones.all()) {
      for (let i = 0; i < 60; i++) {
        const m = monsters.spawnInZone(zone, surfer);
        expect(m?.def.boss).not.toBe(true);
        m?.dispose();
      }
    }
  });
});

describe('Kopfsprung auf die Krabbe', () => {
  it('Trick in der Nähe: Flug auf den Kopf, Treffer, Abprallen und Landung weit weg', () => {
    const { content, spawnCrab, monsters, surfer, world } = setup();
    const crab = spawnCrab();
    // Spieler 25 m vor der Krabbe in der Luft
    surfer.reset(crab.x, crab.z + 25, Math.PI);
    surfer.fsm.start('Standing');
    surfer.launch({ vy: 10, source: 'ramp' });
    const head = crab.bounceTarget(world.heightAt(crab.x, crab.z))!;
    expect(head).not.toBeNull();
    expect(surfer.startBossTrick(content.tricks.get('board_slam'), 'good', 0.9, head)).toBe(true);
    let atHead: { d: number; y: number } | null = null;
    let hits = 0;
    const camera = new THREE.PerspectiveCamera();
    for (let i = 0; i < 60 * 6; i++) {
      const wasPerforming = surfer.fsm.is('TrickPerforming');
      surfer.update(1 / 60);
      world.update(1 / 60, surfer.x, surfer.z, camera);
      if (wasPerforming && surfer.fsm.is('Airborne')) {
        atHead = { d: Math.hypot(surfer.x - crab.x, surfer.z - crab.z), y: surfer.y };
        hits = monsters.applyTrickHit(content.tricks.get('board_slam'), 1, surfer.x, surfer.y, surfer.z, surfer.forwardX, surfer.forwardZ);
      }
      if (surfer.fsm.is('Landing', 'Standing', 'Paddling')) break;
    }
    expect(atHead).not.toBeNull();
    expect(atHead!.d).toBeLessThan(2);
    expect(atHead!.y).toBeGreaterThan(head.y - 1);
    expect(hits).toBeGreaterThan(0);
    // Weit weg gelandet, Blick von der Krabbe weg
    expect(Math.hypot(surfer.x - crab.x, surfer.z - crab.z)).toBeGreaterThan(22);
    expect(surfer.bossBounce).toBeNull();
  });

  it('gegen den Körper fahren stößt zurück statt zu kleben', () => {
    const { spawnCrab, surfer, step } = setup();
    const crab = spawnCrab();
    surfer.reset(crab.x, crab.z + 16, Math.PI);
    surfer.fsm.start('Standing');
    surfer.speed = 14;
    let minD = Infinity;
    for (let i = 0; i < 60 * 2; i++) {
      surfer.update(1 / 60);
      step(1 / 60);
      minD = Math.min(minD, Math.hypot(surfer.x - crab.x, surfer.z - crab.z));
    }
    expect(minD).toBeGreaterThanOrEqual(crab.def.bodyRadius);
    // nach dem Rückstoß deutlich weg vom Körper
    expect(Math.hypot(surfer.x - crab.x, surfer.z - crab.z)).toBeGreaterThan(crab.def.bodyRadius + 2);
  });
});

describe('Riff öffnet sich nach dem Sieg', () => {
  it('vorher drückt das Riff zurück, danach gar nicht mehr', () => {
    const { world } = setup();
    const W = CONFIG.world;
    const inReef = W.boundaryRadius - 5;
    expect(world.boundaryPush(0, inReef).strength).toBeGreaterThan(0.9);
    world.reefOpen = true;
    expect(world.boundaryPush(0, inReef).strength).toBe(0);
    expect(world.boundaryPush(0, W.islandRadius + 2).strength).toBe(0);
  });

  it('am Strand steigt man ab, läuft an Land und paddelt im Wasser weiter', () => {
    const { world, surfer } = setup();
    const R = CONFIG.world.islandRadius;
    world.reefOpen = true;
    // Vor dem Strand, Blick zur Insel, mit Schwung
    surfer.reset(0, R * 1.15, Math.PI);
    surfer.startPlaying();
    surfer.fsm.start('Standing');
    surfer.speed = 12;
    let walked = false;
    for (let i = 0; i < 60 * 12 && !walked; i++) {
      surfer.update(1 / 60);
      world.update(1 / 60, surfer.x, surfer.z, new THREE.PerspectiveCamera());
      walked = surfer.fsm.is('Walking');
    }
    expect(walked).toBe(true);
    expect(surfer.onLand).toBe(true);
    expect(surfer.y).toBeGreaterThan(world.heightAt(surfer.x, surfer.z) - 0.25);
    // Umdrehen und zurück ins Wasser laufen → wieder paddeln
    surfer.heading = 0;
    surfer.speed = CONFIG.island.walkSpeed;
    let paddling = false;
    for (let i = 0; i < 60 * 20 && !paddling; i++) {
      surfer.input.state.paddle = 1;
      surfer.update(1 / 60);
      paddling = surfer.fsm.is('Paddling');
    }
    expect(paddling).toBe(true);
  });

  it('ohne offenes Riff steigt man nie ab', () => {
    const { world, surfer } = setup();
    world.reefOpen = false;
    surfer.reset(0, CONFIG.world.islandRadius * 0.99, Math.PI);
    surfer.startPlaying();
    surfer.update(1 / 60);
    expect(surfer.fsm.is('Walking')).toBe(false);
  });
});
