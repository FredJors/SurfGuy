import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config/gameConfig';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { createDefaultSave } from '../core/SaveGame';
import { createRegistries } from '../data';
import type { AchievementDef } from '../data/types';
import {
  GoalTracker,
  achievementState,
  bonusAvailable,
  claimAchievement,
  claimBonus,
  claimMission,
  claimableCount,
  dayKey,
  ensureDailyMissions,
  rollDailyMissions,
} from './Goals';

describe('Tagesaufgaben', () => {
  it('drei verschiedene Aufgaben (leicht, mittel, schwer), am selben Tag immer dieselben', () => {
    const content = createRegistries();
    const a = rollDailyMissions(content, '2026-10-30', 1);
    const b = rollDailyMissions(content, '2026-10-30', 1);
    expect(a).toEqual(b);
    expect(a.map((m) => m.difficulty)).toEqual([0, 1, 2]);
    expect(new Set(a.map((m) => m.id)).size).toBe(3);
    // an anderen Tagen kommen andere Aufgaben vor
    const many = new Set<string>();
    for (let d = 1; d <= 28; d++) for (const m of rollDailyMissions(content, `2026-11-${String(d).padStart(2, '0')}`, 1)) many.add(m.id);
    expect(many.size).toBeGreaterThan(10);
  });

  it('im Feuermeer nie Aufgaben mit Monstern aus Kapitel 1 (und umgekehrt)', () => {
    const content = createRegistries();
    for (let d = 1; d <= 28; d++) {
      for (const chapter of [1, 2]) {
        for (const m of rollDailyMissions(content, `2026-12-${String(d).padStart(2, '0')}`, chapter)) {
          const def = content.missions.get(m.id);
          expect(def.chapter === undefined || def.chapter === chapter).toBe(true);
        }
      }
    }
  });

  it('neuer Tag = neue Aufgaben; nach dem Kapitelwechsel werden unpassende ersetzt', () => {
    const content = createRegistries();
    const save = createDefaultSave();
    expect(ensureDailyMissions(content, save, new Date(2026, 9, 30))).toBe(true);
    expect(save.missions.day).toBe('2026-10-30');
    expect(ensureDailyMissions(content, save, new Date(2026, 9, 30, 18))).toBe(false);
    // Kraken-Aufgabe erzwingen, dann Kapitel 2
    save.missions.list[0] = { id: 'kraken', difficulty: 0, goal: 1, progress: 0, claimed: false };
    save.progress.chapter = 2;
    expect(ensureDailyMissions(content, save, new Date(2026, 9, 30, 19))).toBe(true);
    expect(save.missions.list[0]!.id).not.toBe('kraken');
    expect(save.missions.list[0]!.difficulty).toBe(0);
    expect(ensureDailyMissions(content, save, new Date(2026, 9, 31))).toBe(true);
    expect(save.missions.day).toBe(dayKey(new Date(2026, 9, 31)));
  });

  it('Fortschritt aus Ereignissen: Summe mit Filter und Bestwert pro Run; Meldung genau einmal', () => {
    const content = createRegistries();
    const save = createDefaultSave();
    save.missions = {
      day: '2026-10-30',
      bonusClaimed: false,
      list: [
        { id: 'kraken', difficulty: 0, goal: 2, progress: 0, claimed: false },
        { id: 'score', difficulty: 1, goal: 6000, progress: 0, claimed: false },
        { id: 'tricks', difficulty: 2, goal: 3, progress: 0, claimed: false },
      ],
    };
    const bus = new EventBus<GameEvents>();
    const done: string[] = [];
    new GoalTracker(bus, content, () => save, { missionCompleted: (e) => done.push(e.id), achievementReached: () => {} });
    const defeat = (monsterId: string) => bus.emit('monsterDefeated', { instanceId: 1, monsterId, tier: 1, rewards: { pearls: 1, xp: 1, points: 1 }, position: { x: 0, z: 0 } });
    bus.emit('runStarted', { seed: 1 });
    defeat('shark');
    defeat('kraken');
    expect(save.missions.list[0]!.progress).toBe(1);
    defeat('kraken');
    defeat('kraken');
    expect(done.filter((d) => d === 'kraken').length).toBe(1);
    // Bestwert: nur der beste Run zählt
    bus.emit('scoreAdded', { points: 4000, reason: '', total: 4000, multiplier: 1 });
    bus.emit('runStarted', { seed: 2 });
    bus.emit('scoreAdded', { points: 3000, reason: '', total: 3000, multiplier: 1 });
    expect(save.missions.list[1]!.progress).toBe(4000);
    bus.emit('scoreAdded', { points: 3500, reason: '', total: 6500, multiplier: 1 });
    expect(done).toContain('score');
    for (let i = 0; i < 3; i++) bus.emit('trickLanded', { trickId: 'salto', quality: 'good', hits: 0, chain: 1 });
    expect(done).toContain('tricks');
    expect(save.stats.tricksLanded).toBe(3);
  });

  it('Belohnungen abholen, dann Bonus-Truhe', () => {
    const save = createDefaultSave();
    save.missions = {
      day: '2026-10-30',
      bonusClaimed: false,
      list: [
        { id: 'pearls', difficulty: 0, goal: 10, progress: 10, claimed: false },
        { id: 'monsters', difficulty: 1, goal: 3, progress: 3, claimed: false },
        { id: 'tricks', difficulty: 2, goal: 5, progress: 2, claimed: false },
      ],
    };
    const r = claimMission(save, 0)!;
    expect(r).toEqual(CONFIG.goals.missionRewards[0]);
    expect(save.pearls).toBe(r.pearls);
    expect(claimMission(save, 0)).toBeNull();
    expect(claimMission(save, 2)).toBeNull(); // noch nicht fertig
    claimMission(save, 1);
    expect(bonusAvailable(save)).toBe(false);
    save.missions.list[2]!.progress = 5;
    claimMission(save, 2);
    expect(bonusAvailable(save)).toBe(true);
    expect(claimBonus(save)).toBe(CONFIG.goals.bonusChests);
    expect(claimBonus(save)).toBe(0);
  });
});

describe('Erfolge', () => {
  it('Stufen werden erreicht, gemeldet und der Reihe nach abgeholt', () => {
    const content = createRegistries();
    const save = createDefaultSave();
    const bus = new EventBus<GameEvents>();
    const reached: [string, number][] = [];
    new GoalTracker(bus, content, () => save, { missionCompleted: () => {}, achievementReached: (d, t) => reached.push([d.id, t]) });
    const ramp = content.achievements.get('ramp_hero') as AchievementDef;
    for (let i = 0; i < 10; i++) bus.emit('launched', { source: 'ramp', airtime: 1, position: { x: 0, z: 0 }, power: 1 });
    expect(save.stats.rampJumps).toBe(10);
    expect(reached).toContainEqual(['ramp_hero', 0]);
    expect(achievementState(save, ramp)).toMatchObject({ reached: 1, claimed: 0, next: 75 });
    expect(claimableCount(content, save)).toBeGreaterThanOrEqual(1);
    const r = claimAchievement(save, ramp)!;
    expect(r).toEqual(CONFIG.goals.achievementRewards[0]);
    expect(claimAchievement(save, ramp)).toBeNull();
    // Story-Erfolg: eine Stufe, Gold-Belohnung
    save.progress.bossDefeated = true;
    const crab = content.achievements.get('reef_guardian');
    expect(achievementState(save, crab).reached).toBe(1);
    expect(claimAchievement(save, crab)).toEqual(CONFIG.goals.achievementRewards[2]);
  });

  it('Luftakrobat und Kombo-König merken sich Bestwerte', () => {
    const content = createRegistries();
    const save = createDefaultSave();
    const bus = new EventBus<GameEvents>();
    new GoalTracker(bus, content, () => save, { missionCompleted: () => {}, achievementReached: () => {} });
    bus.emit('landed', { airtime: 3.14, position: { x: 0, z: 0 }, speed: 10 });
    bus.emit('landed', { airtime: 1.2, position: { x: 0, z: 0 }, speed: 10 });
    bus.emit('trickLanded', { trickId: 'salto', quality: 'perfect', hits: 1, chain: 3 });
    expect(save.stats.bestAirtime).toBeCloseTo(3.1);
    expect(save.stats.maxAirCombo).toBe(3);
    expect(save.stats.perfectTricks).toBe(1);
  });
});
