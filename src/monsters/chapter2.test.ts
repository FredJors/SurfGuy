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
import type { Clam } from './Clam';
import type { Monster } from './Monster';
import { MonsterSystem } from './MonsterSystem';

const noEffects = { splash() {}, hitSparks() {}, bubbles() {}, sparkle() {}, particles: { emit() {} } } as unknown as Effects;

function setup(chapter = 2) {
  const bus = new EventBus<GameEvents>();
  const assets = new AssetLoader();
  const world = new World(bus, assets);
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
  for (const t of ['monsterHit', 'monsterDefeated', 'playerHit', 'monsterAttack'] as const) bus.on(t, (e) => events.push({ type: t, e }));
  const step = (seconds: number, each?: () => void) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      each?.();
      monsters.update(1 / 60, surfer, run, stats, camera);
    }
  };
  const attacks = () => events.filter((x) => x.type === 'monsterAttack').map((x) => (x.e as { kind: string }).kind);
  return { content, monsters, surfer, run, events, step, attacks, camera };
}

/** Bis zum ersten Treffer am (stehenden) Spieler laufen lassen; gibt die Sekunden zurück. */
function untilHit(t: ReturnType<typeof setup>, maxSeconds: number, each?: () => void): number {
  for (let i = 0; i < maxSeconds * 60; i++) {
    each?.();
    t.monsters.update(1 / 60, t.surfer, t.run, t.surfer.stats, t.camera);
    if (t.run.hearts < 3) return i / 60;
  }
  return Infinity;
}

describe('Kapitel 2: andere Monster', () => {
  it('im Feuermeer kommen nur Seeschlange, Wal und Muschel – vorher nie', () => {
    const ids = (chapter: number) => {
      const { content, monsters, surfer } = setup(chapter);
      const seen = new Set<string>();
      for (const zone of content.zones.all()) {
        for (let i = 0; i < 40; i++) {
          const m = monsters.spawnInZone(zone, surfer);
          if (m) seen.add(m.def.id);
          monsters.clear();
        }
      }
      return [...seen].sort();
    };
    expect(ids(2)).toEqual(['clam', 'serpent', 'whale']);
    expect(ids(1)).toEqual(['jelly', 'kraken', 'shark']);
  }, 30000);
});

describe('Seeschlange', () => {
  it('richtet sich auf, schnellt vor und trifft einen stehenden Spieler', () => {
    const t = setup();
    const m = t.monsters.spawn(t.content.monsters.get('serpent'), 1, t.surfer.x + 14, t.surfer.z - 14)!;
    m.setPhase('active');
    expect(untilHit(t, 15)).toBeLessThan(15);
    expect(t.attacks()).toContain('lunge');
  });

  it('wer hoch genug springt, wird nicht erwischt', () => {
    const t = setup();
    const m = t.monsters.spawn(t.content.monsters.get('serpent'), 1, t.surfer.x + 14, t.surfer.z - 14)!;
    m.setPhase('active');
    t.surfer.fsm.start('Airborne');
    t.surfer.y = t.surfer.waterHeight + 3;
    expect(untilHit(t, 12)).toBe(Infinity);
    expect(t.attacks()).toContain('lunge');
  });

  it('der Board-Wirbel trifft Kopf und Windungen', () => {
    const t = setup();
    const m = t.monsters.spawn(t.content.monsters.get('serpent'), 1, t.surfer.x + 3, t.surfer.z - 3)!;
    m.setPhase('active');
    t.step(1 / 60);
    // Körper dicht an den Spieler legen (Segmente folgen der Spur)
    const hits = t.monsters.applyTrickHit(t.content.tricks.get('board_spin'), 1, m.x, 0, m.z, 0, 1);
    expect(hits).toBeGreaterThanOrEqual(2);
    const tags = t.events.filter((x) => x.type === 'monsterHit').map((x) => (x.e as { partTag: string }).partTag);
    expect(tags).toContain('head');
    expect(tags).toContain('body');
  });
});

describe('Buckelwal', () => {
  it('taucht ab, ist dann nicht zu treffen, und kracht unter dem stehenden Spieler heraus', () => {
    const t = setup();
    const m = t.monsters.spawn(t.content.monsters.get('whale'), 1, t.surfer.x + 20, t.surfer.z)!;
    m.setPhase('active');
    let untargetableSeen = false;
    const time = untilHit(t, 20, () => {
      if (t.attacks().includes('dive') && !t.attacks().includes('breach') && !m.isTargetable) untargetableSeen = true;
    });
    expect(time).toBeLessThan(20);
    expect(untargetableSeen).toBe(true);
    expect(t.attacks()).toEqual(expect.arrayContaining(['dive', 'breach', 'slam']));
  });

  it('wer aus dem Ring fährt, entkommt dem Aufprall', () => {
    const t = setup();
    const m = t.monsters.spawn(t.content.monsters.get('whale'), 1, t.surfer.x + 20, t.surfer.z)!;
    m.setPhase('active');
    let fled = false;
    const time = untilHit(t, 12, () => {
      // Sobald der Schatten fest steht (kurz vor dem Sprung), seitlich wegfahren
      if (!fled && t.attacks().includes('dive') && !t.attacks().includes('breach') && (m as unknown as { modeTime: number }).modeTime > 1.5) {
        fled = true;
        t.surfer.x += 20;
      }
    });
    expect(fled).toBe(true);
    expect(time).toBe(Infinity);
    expect(t.attacks()).toContain('slam');
  });
});

describe('Riesenmuschel', () => {
  const openClam = (t: ReturnType<typeof setup>, m: Monster) => {
    for (let i = 0; i < 60 * 8 && !(m as Clam).isOpen; i++) t.monsters.update(1 / 60, t.surfer, t.run, t.surfer.stats, t.camera);
    return (m as Clam).isOpen;
  };

  it('geschlossen prallen Tricks ab, offen trifft der Board-Schlag doppelt', () => {
    const t = setup();
    const def = t.content.monsters.get('clam');
    const m = t.monsters.spawn(def, 1, t.surfer.x, t.surfer.z - 7)!;
    m.setPhase('active');
    t.step(1 / 60);
    const slam = t.content.tricks.get('board_slam');
    t.run.invulnerable = 99; // nicht angreifen lassen, aber aufklappen darf sie nicht ohne Ziel …
    t.monsters.applyTrickHit(slam, 1, t.surfer.x, 0, t.surfer.z, t.surfer.forwardX, t.surfer.forwardZ);
    const closed = (t.events.find((x) => x.type === 'monsterHit')!.e as { damage: number }).damage;
    expect(closed).toBe(Math.round(slam.damage * 2 * 0.2));
    expect(t.attacks()).toContain('clonk');
    t.run.invulnerable = 0;
    expect(openClam(t, m)).toBe(true);
    t.events.length = 0;
    t.monsters.applyTrickHit(slam, 1, t.surfer.x, 0, t.surfer.z, t.surfer.forwardX, t.surfer.forwardZ);
    const open = (t.events.find((x) => x.type === 'monsterHit')!.e as { damage: number }).damage;
    expect(open).toBe(slam.damage * 2);
  });

  it('spuckt Lava-Perlen, die einen stehenden Spieler treffen', () => {
    const t = setup();
    const m = t.monsters.spawn(t.content.monsters.get('clam'), 1, t.surfer.x, t.surfer.z - 20)!;
    m.setPhase('active');
    expect(untilHit(t, 10)).toBeLessThan(10);
    expect(t.attacks()).toContain('spit');
  });

  it('hüpft heran, wenn der Spieler weit weg ist', () => {
    const t = setup();
    const m = t.monsters.spawn(t.content.monsters.get('clam'), 1, t.surfer.x, t.surfer.z - 50)!;
    m.setPhase('active');
    t.run.invulnerable = 99;
    const d0 = Math.hypot(m.x - t.surfer.x, m.z - t.surfer.z);
    t.step(3);
    expect(Math.hypot(m.x - t.surfer.x, m.z - t.surfer.z)).toBeLessThan(d0 - 8);
  });
});

describe('Neue Tricks aus Kapitel 2', () => {
  it('sind erst ab Kapitel 2 freigeschaltet', async () => {
    const { isUnlocked } = await import('../player/Progression');
    const { content } = setup();
    const save = createDefaultSave();
    for (const id of ['fire_wheel', 'corkscrew', 'dive']) {
      const t = content.tricks.get(id);
      expect(isUnlocked(t.unlock, save, save.unlocked.tricks, id)).toBe(false);
    }
    save.progress.chapter = 2;
    for (const id of ['fire_wheel', 'corkscrew', 'dive']) {
      const t = content.tricks.get(id);
      expect(isUnlocked(t.unlock, save, save.unlocked.tricks, id)).toBe(true);
    }
  });

  it('Korkenzieher trifft den Kopf der Seeschlange doppelt', () => {
    const t = setup();
    const m = t.monsters.spawn(t.content.monsters.get('serpent'), 1, t.surfer.x, t.surfer.z - 8)!;
    m.setPhase('active');
    t.step(1 / 60);
    const trick = t.content.tricks.get('corkscrew');
    t.monsters.applyTrickHit(trick, 1, t.surfer.x, 0, t.surfer.z, t.surfer.forwardX, t.surfer.forwardZ);
    const hit = t.events.find((x) => x.type === 'monsterHit')!.e as { partTag: string; damage: number; weakness: boolean };
    expect(hit.partTag).toBe('head');
    expect(hit.weakness).toBe(true);
    expect(hit.damage).toBe(trick.damage * 2);
  });

  it('Sturzflug trifft den Rücken des Wals doppelt, das Feuerrad die offene Muschel doppelt', () => {
    const t = setup();
    const whale = t.monsters.spawn(t.content.monsters.get('whale'), 1, t.surfer.x, t.surfer.z - 2)!;
    whale.setPhase('active');
    t.step(1 / 60);
    const dive = t.content.tricks.get('dive');
    t.monsters.applyTrickHit(dive, 1, whale.parts[1]!.position.x, 0, whale.parts[1]!.position.z, 0, 1);
    const back = t.events.filter((x) => x.type === 'monsterHit').map((x) => x.e as { partTag: string; damage: number }).find((h) => h.partTag === 'body')!;
    expect(back.damage).toBe(dive.damage * 2);

    const c = setup();
    const clam = c.monsters.spawn(c.content.monsters.get('clam'), 1, c.surfer.x, c.surfer.z - 7)! as Clam;
    clam.setPhase('active');
    for (let i = 0; i < 60 * 8 && !clam.isOpen; i++) c.monsters.update(1 / 60, c.surfer, c.run, c.surfer.stats, c.camera);
    const wheel = c.content.tricks.get('fire_wheel');
    c.monsters.applyTrickHit(wheel, 1, c.surfer.x, 0, c.surfer.z, c.surfer.forwardX, c.surfer.forwardZ);
    const hit = c.events.find((x) => x.type === 'monsterHit')!.e as { damage: number };
    expect(hit.damage).toBe(wheel.damage * 2);
  });
});
