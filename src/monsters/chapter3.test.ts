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
import { MonsterSystem } from './MonsterSystem';

const noEffects = { splash() {}, hitSparks() {}, bubbles() {}, sparkle() {}, shockwave() {}, particles: { emit() {} } } as unknown as Effects;

function setup(chapter = 3) {
  const bus = new EventBus<GameEvents>();
  const assets = new AssetLoader();
  const world = new World(bus, assets);
  world.setChapter(chapter);
  const content = createRegistries();
  const stats = createPlayerStats(content, createDefaultSave());
  const surfer = new Surfer(bus, new InputManager(), stats, world, new JointRig(assets.create('surfer')), assets.create('board'), content.poses);
  surfer.reset(0, CONFIG.world.startDistance, Math.PI);
  surfer.startPlaying();
  const monsters = new MonsterSystem(bus, content, assets, world, noEffects);
  monsters.start(new Rng(3));
  monsters.progress = { nextTier: () => 1, unfinished: () => true, chapter: () => chapter };
  const run = createRunState(1, 3);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(surfer.x, 4, surfer.z + 8.5);
  const events: { type: string; e: unknown }[] = [];
  for (const t of ['monsterHit', 'monsterDefeated', 'playerHit', 'monsterAttack', 'monsterFrozen'] as const) bus.on(t, (e) => events.push({ type: t, e }));
  const attacks = () => events.filter((x) => x.type === 'monsterAttack').map((x) => (x.e as { kind: string }).kind);
  return { content, monsters, surfer, run, events, attacks, camera, stats };
}

function untilHit(t: ReturnType<typeof setup>, maxSeconds: number, each?: () => void): number {
  for (let i = 0; i < maxSeconds * 60; i++) {
    each?.();
    t.monsters.update(1 / 60, t.surfer, t.run, t.stats, t.camera);
    if (t.run.hearts < 3) return i / 60;
  }
  return Infinity;
}

function finitePositions(t: ReturnType<typeof setup>): boolean {
  return t.monsters.monsters.every((m) => Number.isFinite(m.x) && Number.isFinite(m.z) && Number.isFinite(m.root.position.y));
}

describe('Kapitel 3: Monster des Eismeers', () => {
  it('im Eismeer kommen nur Eisbär, Seeleopard und Narwal', () => {
    const { content, monsters, surfer } = setup(3);
    const seen = new Set<string>();
    for (const zone of content.zones.all()) {
      for (let i = 0; i < 40; i++) {
        const m = monsters.spawnInZone(zone, surfer);
        if (m) seen.add(m.def.id);
        monsters.clear();
      }
    }
    expect([...seen].sort()).toEqual(['leopard_seal', 'narwhal', 'polar_bear']);
  }, 30000);

  for (const [id, kind, offset] of [
    ['polar_bear', 'slam', [18, -10]],
    ['leopard_seal', 'lunge', [14, -10]],
    ['narwhal', 'charge', [20, -6]],
  ] as const) {
    it(`${id}: Angriff mit Vorwarnung trifft einen stehenden Spieler`, () => {
      const t = setup();
      const m = t.monsters.spawn(t.content.monsters.get(id), 1, t.surfer.x + offset[0], t.surfer.z + offset[1])!;
      m.setPhase('active');
      const time = untilHit(t, 25);
      expect(time).toBeLessThan(25);
      expect(t.attacks()).toContain(kind);
      expect(finitePositions(t)).toBe(true);
    }, 30000);

    it(`${id}: wer hoch genug in der Luft ist, wird nicht erwischt`, () => {
      const t = setup();
      const m = t.monsters.spawn(t.content.monsters.get(id), 1, t.surfer.x + offset[0], t.surfer.z + offset[1])!;
      m.setPhase('active');
      t.surfer.fsm.start('Airborne');
      t.surfer.y = t.surfer.waterHeight + 3;
      expect(untilHit(t, 12, () => (t.surfer.y = t.surfer.waterHeight + 3))).toBe(Infinity);
      expect(t.attacks()).toContain(kind);
    }, 30000);
  }

  it('Stufe 3: Eisbär springt zweimal, Narwal stürmt zweimal', () => {
    for (const [id, kind] of [
      ['polar_bear', 'slam'],
      ['narwhal', 'charge'],
    ] as const) {
      const t = setup();
      const m = t.monsters.spawn(t.content.monsters.get(id), 3, t.surfer.x + 18, t.surfer.z - 10)!;
      m.setPhase('active');
      t.surfer.fsm.start('Airborne');
      for (let i = 0; i < 60 * 14; i++) {
        t.surfer.y = t.surfer.waterHeight + 3;
        t.monsters.update(1 / 60, t.surfer, t.run, t.stats, t.camera);
        if (t.attacks().filter((k) => k === kind).length >= 2) break;
      }
      expect(t.attacks().filter((k) => k === kind).length).toBeGreaterThanOrEqual(2);
    }
  }, 30000);

  it('Frostnova friert ein: Monster stehen still und nehmen mehr Schaden; der Eisbär ist robust (kein Einfrieren)', () => {
    const t = setup();
    const seal = t.monsters.spawn(t.content.monsters.get('leopard_seal'), 1, t.surfer.x + 4, t.surfer.z)!;
    seal.setPhase('active');
    t.monsters.update(1 / 60, t.surfer, t.run, t.stats, t.camera);
    const nova = t.content.tricks.get('frost_nova');
    t.monsters.applyTrickHit(nova, 1, t.surfer.x, 0, t.surfer.z, 0, 1);
    expect(seal.frozen).toBeGreaterThan(2);
    expect(t.events.some((x) => x.type === 'monsterFrozen')).toBe(true);
    const x0 = seal.x;
    for (let i = 0; i < 60; i++) t.monsters.update(1 / 60, t.surfer, t.run, t.stats, t.camera);
    expect(seal.x).toBe(x0);
    // eingefroren: Schlag macht mehr Schaden als normal
    const hp0 = seal.hp;
    t.monsters.applyTrickHit(t.content.tricks.get('board_spin'), 1, seal.x, 0, seal.z, 0, 1);
    const frozenDamage = hp0 - seal.hp;
    expect(frozenDamage).toBeGreaterThanOrEqual(Math.round(t.content.tricks.get('board_spin').damage * 0.6 * CONFIG.trick.frozenDamage) - 1);
    // Auftauen: läuft danach weiter
    for (let i = 0; i < 60 * 3; i++) t.monsters.update(1 / 60, t.surfer, t.run, t.stats, t.camera);
    expect(seal.frozen).toBe(0);
    // Eisbär: Frost nur halber Schaden (Schwäche 0,5)
    const bear = t.monsters.spawn(t.content.monsters.get('polar_bear'), 1, t.surfer.x - 4, t.surfer.z)!;
    bear.setPhase('active');
    t.monsters.update(1 / 60, t.surfer, t.run, t.stats, t.camera);
    const b0 = bear.hp;
    t.monsters.applyTrickHit(nova, 1, bear.x, 0, bear.z, 0, 1);
    expect(b0 - bear.hp).toBeLessThanOrEqual(Math.ceil(nova.damage * 0.5) * 2);
    expect(bear.frozen).toBe(0);
  }, 30000);

  it('alle drei lassen sich besiegen (Belohnung, kein NaN)', () => {
    for (const id of ['polar_bear', 'leopard_seal', 'narwhal']) {
      const t = setup();
      const m = t.monsters.spawn(t.content.monsters.get(id), 1, t.surfer.x + 6, t.surfer.z - 6)!;
      m.setPhase('active');
      let defeated = false;
      for (let i = 0; i < 60 * 30 && !defeated; i++) {
        t.surfer.y = t.surfer.waterHeight + 3;
        t.surfer.fsm.start('Airborne');
        if (i % 30 === 0 && m.isTargetable) {
          for (const p of m.parts) m.takeHit(p, 40, { bus: { emit() {} } as never });
        }
        t.monsters.update(1 / 60, t.surfer, t.run, t.stats, t.camera);
        defeated = t.events.some((x) => x.type === 'monsterDefeated');
      }
      expect(defeated).toBe(true);
      expect(finitePositions(t)).toBe(true);
    }
  }, 30000);
});
