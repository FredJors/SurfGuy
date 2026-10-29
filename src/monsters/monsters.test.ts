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

describe('Kein Dauertreffer', () => {
  it('zwischen zwei Treffern liegt mindestens die Schonfrist', () => {
    const { content, monsters, surfer, run, events } = setup();
    const def = content.monsters.get('kraken');
    surfer.input.gameplayEnabled = true;
    surfer.input.addSource({ read: () => ({ paddle: 1 }) });
    const k = monsters.spawn(def, 1, surfer.x, surfer.z - 9)!;
    k.setPhase('active');
    const camera = new THREE.PerspectiveCamera();
    const hitTimes: number[] = [];
    let t = 0;
    for (let i = 0; i < 60 * 20; i++) {
      t += 1 / 60;
      surfer.input.update();
      surfer.update(1 / 60);
      camera.position.set(surfer.x - surfer.forwardX * 8.5, 4, surfer.z - surfer.forwardZ * 8.5);
      if (run.invulnerable > 0) run.invulnerable -= 1 / 60;
      monsters.update(1 / 60, surfer, run, surfer.stats, camera);
      const hits = events.filter((x) => x.type === 'playerHit').length;
      if (hits > hitTimes.length) hitTimes.push(t);
      if (run.hearts <= 0) break;
    }
    expect(hitTimes.length).toBeGreaterThan(0);
    for (let i = 1; i < hitTimes.length; i++) {
      expect(hitTimes[i]! - hitTimes[i - 1]!).toBeGreaterThanOrEqual(def.attack.graceAfterHit);
    }
  });

  it('wer nach einem Treffer wegpaddelt, entkommt', () => {
    const { content, monsters, surfer, run, events } = setup();
    const def = content.monsters.get('kraken');
    surfer.input.gameplayEnabled = true;
    surfer.input.addSource({ read: () => ({ paddle: 1 }) });
    const k = monsters.spawn(def, 1, surfer.x, surfer.z - 9)!;
    k.setPhase('active');
    const camera = new THREE.PerspectiveCamera();
    let turned = false;
    for (let i = 0; i < 60 * 30; i++) {
      surfer.input.update();
      // Nach dem ersten Treffer: vom Kraken weg drehen
      if (!turned && events.some((x) => x.type === 'playerHit')) {
        surfer.heading = Math.atan2(surfer.x - k.x, surfer.z - k.z);
        turned = true;
      }
      surfer.update(1 / 60);
      camera.position.set(surfer.x - surfer.forwardX * 8.5, 4, surfer.z - surfer.forwardZ * 8.5);
      if (run.invulnerable > 0) run.invulnerable -= 1 / 60;
      monsters.update(1 / 60, surfer, run, surfer.stats, camera);
    }
    expect(turned).toBe(true);
    expect(events.filter((x) => x.type === 'playerHit').length).toBeLessThanOrEqual(2);
    expect(run.hearts).toBeGreaterThan(0);
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

describe('Kamera-Freiraum', () => {
  it('ein Monster genau auf der Sichtlinie weicht nur ein Stück zur Seite aus', () => {
    const { content, monsters, surfer, run } = setup();
    const k = monsters.spawn(content.monsters.get('kraken'), 1, surfer.x, surfer.z + 4)!;
    k.setPhase('active');
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(surfer.x, 4, surfer.z + 8.5); // Monster liegt exakt zwischen Kamera und Spieler
    for (let i = 0; i < 60; i++) monsters.update(1 / 60, surfer, run, surfer.stats, camera);
    expect(Math.abs(k.x - surfer.x)).toBeLessThan(10);
    expect(Math.abs(k.x - surfer.x)).toBeGreaterThan(3);
  });
});

describe('Riffhai', () => {
  it('kreist, zielt (Streifen) und rammt einen stehenden Spieler', () => {
    const { content, monsters, surfer, run, events } = setup();
    const k = monsters.spawn(content.monsters.get('shark'), 1, surfer.x + 10, surfer.z - 15)!;
    k.setPhase('active');
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(surfer.x, 4, surfer.z + 8.5);
    for (let i = 0; i < 60 * 10 && run.hearts === 3; i++) monsters.update(1 / 60, surfer, run, surfer.stats, camera);
    expect(events.some((x) => x.type === 'playerHit')).toBe(true);
    expect(run.hearts).toBe(2);
  });

  it('wer hoch genug springt, wird nicht gerammt', () => {
    const { content, monsters, surfer, run } = setup();
    const k = monsters.spawn(content.monsters.get('shark'), 1, surfer.x + 10, surfer.z - 15)!;
    k.setPhase('active');
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(surfer.x, 4, surfer.z + 8.5);
    // Surfer „schwebt“ dauerhaft über der Ausweichhöhe
    surfer.fsm.start('Airborne');
    surfer.y = surfer.waterHeight + 3;
    for (let i = 0; i < 60 * 10; i++) monsters.update(1 / 60, surfer, run, surfer.stats, camera);
    expect(run.hearts).toBe(3);
  });

  it('Board-Schlag trifft doppelt, besiegt gibt Belohnung', () => {
    const { content, monsters, surfer, events } = setup();
    const k = monsters.spawn(content.monsters.get('shark'), 1, surfer.x, surfer.z - 6)!;
    k.setPhase('active');
    const slam = content.tricks.get('board_slam');
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(surfer.x, 4, surfer.z + 8.5);
    monsters.update(1 / 60, surfer, createRunState(1, 3), surfer.stats, camera);
    // Hai liegt vor dem Surfer (Blickrichtung -Z)
    monsters.applyTrickHit(slam, 1, surfer.x, 0, surfer.z, surfer.forwardX, surfer.forwardZ);
    const hit = events.find((x) => x.type === 'monsterHit')!.e as { damage: number; weakness: boolean };
    expect(hit.damage).toBe(slam.damage * 2);
    expect(hit.weakness).toBe(true);
    monsters.applyTrickHit(slam, 1, surfer.x, 0, surfer.z, surfer.forwardX, surfer.forwardZ);
    expect(events.some((x) => x.type === 'monsterDefeated')).toBe(false);
    for (let i = 0; i < 3 && !events.some((x) => x.type === 'monsterDefeated'); i++) {
      monsters.update(1 / 60, surfer, createRunState(1, 3), surfer.stats, camera);
      monsters.applyTrickHit(slam, 1, surfer.x, 0, surfer.z, surfer.forwardX, surfer.forwardZ);
      monsters.update(1 / 60, surfer, createRunState(1, 3), surfer.stats, camera);
    }
    expect(events.some((x) => x.type === 'monsterDefeated')).toBe(true);
  });
});

describe('Riesenqualle', () => {
  it('Stromstoß trifft nur innerhalb des Rings', () => {
    const near = setup();
    const j1 = near.monsters.spawn(near.content.monsters.get('jelly'), 1, near.surfer.x, near.surfer.z - 5)!;
    j1.setPhase('active');
    const cam = new THREE.PerspectiveCamera();
    cam.position.set(near.surfer.x, 4, near.surfer.z + 8.5);
    for (let i = 0; i < 60 * 6 && near.run.hearts === 3; i++) near.monsters.update(1 / 60, near.surfer, near.run, near.surfer.stats, cam);
    expect(near.run.hearts).toBe(2);

    const far = setup();
    const def = far.content.monsters.get('jelly');
    const j2 = far.monsters.spawn(def, 1, far.surfer.x, far.surfer.z - 30)!;
    j2.setPhase('active');
    // Qualle festhalten, damit sie nicht heranschwebt
    for (let i = 0; i < 60 * 6; i++) {
      j2.x = far.surfer.x;
      j2.z = far.surfer.z - 30;
      far.monsters.update(1 / 60, far.surfer, far.run, far.surfer.stats, cam);
    }
    expect(far.run.hearts).toBe(3);
  });

  it('Salto trifft doppelt, Board-Wirbel nur halb', () => {
    const { content, monsters, surfer, events } = setup();
    const j = monsters.spawn(content.monsters.get('jelly'), 1, surfer.x, surfer.z - 5)!;
    j.setPhase('active');
    const cam = new THREE.PerspectiveCamera();
    monsters.update(1 / 60, surfer, createRunState(1, 3), surfer.stats, cam);
    const salto = content.tricks.get('salto');
    const spin = content.tricks.get('board_spin');
    monsters.applyTrickHit(salto, 1, surfer.x, 0, surfer.z, surfer.forwardX, surfer.forwardZ);
    monsters.applyTrickHit(spin, 1, surfer.x, 0, surfer.z, surfer.forwardX, surfer.forwardZ);
    const hits = events.filter((x) => x.type === 'monsterHit').map((x) => (x.e as { damage: number }).damage);
    expect(hits).toEqual([salto.damage * 2, Math.round(spin.damage * 0.5)]);
  });
});

describe('Zonen-Verteilung', () => {
  it('Hai im offenen Meer häufiger, Qualle nur näher an der Insel', () => {
    const { content, monsters, surfer } = setup();
    const count = (zoneId: string) => {
      const c: Record<string, number> = {};
      for (let i = 0; i < 200; i++) {
        const m = monsters.spawnInZone(content.zones.get(zoneId), surfer)!;
        c[m.def.id] = (c[m.def.id] ?? 0) + 1;
      }
      monsters.clear();
      return c;
    };
    const outer = count('outer');
    expect(outer.jelly ?? 0).toBe(0);
    expect(outer.shark!).toBeGreaterThan(outer.kraken!);
    const inner = count('inner');
    expect(inner.jelly!).toBeGreaterThan(0);
    expect(inner.kraken!).toBeGreaterThan(0);
  });
});

describe('Monster-Stufen nach Fortschritt', () => {
  it('es kommt immer die Stufe nach der höchsten besiegten (höchstens die letzte)', async () => {
    const { nextMonsterTier } = await import('../player/Progression');
    const { content, monsters, surfer } = setup();
    const save = createDefaultSave();
    monsters.progress = {
      nextTier: (def) => nextMonsterTier(def, save),
      unfinished: (def) => (save.bestiary[def.id]?.highestTierDefeated ?? 0) < def.tiers.length,
    };
    const zone = content.zones.get('inner');
    const tiersSeen = (id: string) => {
      const out = new Set<number>();
      for (let i = 0; i < 80; i++) {
        const m = monsters.spawnInZone(zone, surfer);
        if (m?.def.id === id) out.add(m.tier.tier);
        m?.dispose();
      }
      monsters.clear();
      return [...out];
    };
    expect(tiersSeen('kraken')).toEqual([1]);
    save.bestiary.kraken = { seen: 1, defeated: 1, highestTierDefeated: 1, defeatedByTier: { 1: 1 } };
    expect(tiersSeen('kraken')).toEqual([2]);
    save.bestiary.kraken.highestTierDefeated = 3;
    expect(tiersSeen('kraken')).toEqual([3]);
  });

  it('noch nicht fertige Arten kommen öfter', () => {
    const { content, monsters, surfer } = setup();
    const save = createDefaultSave();
    for (const m of content.monsters.all()) if (m.id !== 'shark') save.bestiary[m.id] = { seen: 1, defeated: 3, highestTierDefeated: m.tiers.length, defeatedByTier: {} };
    monsters.progress = { nextTier: () => 1, unfinished: (def) => (save.bestiary[def.id]?.highestTierDefeated ?? 0) < def.tiers.length };
    const zone = content.zones.get('middle');
    let shark = 0;
    for (let i = 0; i < 300; i++) {
      const m = monsters.spawnInZone(zone, surfer);
      if (m?.def.id === 'shark') shark++;
      m?.dispose();
    }
    // Ohne Bevorzugung läge der Hai-Anteil in der mittleren Zone bei etwa einem Drittel
    expect(shark / 300).toBeGreaterThan(0.45);
  });
});
