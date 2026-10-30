import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config/gameConfig';
import { Rng } from '../core/Rng';
import { MemoryStorage, SaveStore, createDefaultSave } from '../core/SaveGame';
import { createRegistries } from '../data';
import {
  ABILITY_SLOTS,
  applyChestReward,
  bossAvailable,
  buyItem,
  canUnlockSkill,
  conditionMet,
  createPlayerStats,
  describeCondition,
  equipDesign,
  equipItem,
  equippedAbilities,
  isUnlocked,
  itemStatus,
  skillState,
  toggleAbility,
  bestiaryProgress,
  chapterSelectable,
  reachChapter,
  selectChapter,
  monsterZones,
  rollChest,
  unlockSkill,
  unlockedActiveAbilities,
} from './Progression';

describe('Progression: Werte', () => {
  it('Board-Werte wirken als Modifikatoren', () => {
    const content = createRegistries();
    const save = createDefaultSave();
    save.equipped.board = 'speedster';
    const stats = createPlayerStats(content, save);
    expect(stats.get('maxSpeed')).toBeCloseTo(CONFIG.playerBase.maxSpeed * 1.15);
    expect(stats.get('turnRate')).toBeCloseTo(CONFIG.playerBase.turnRate * 0.9);
  });

  it('Skills und passive Fähigkeiten verändern Werte', () => {
    const content = createRegistries();
    const save = createDefaultSave();
    save.unlocked.skills = ['paddle_1', 'heart_1'];
    const stats = createPlayerStats(content, save);
    expect(stats.get('paddleSpeed')).toBeCloseTo(CONFIG.playerBase.paddleSpeed * 1.1);
    expect(stats.get('maxHearts')).toBe(CONFIG.playerBase.maxHearts + 1);
  });

  it('Freischaltbedingungen und lesbare Texte', () => {
    const content = createRegistries();
    const save = createDefaultSave();
    expect(isUnlocked({ type: 'default' }, save)).toBe(true);
    expect(isUnlocked({ type: 'bestiary', monsterId: 'kraken', tier: 1 }, save)).toBe(false);
    save.bestiary.kraken = { seen: 1, defeated: 1, highestTierDefeated: 1, defeatedByTier: { 1: 1 } };
    expect(isUnlocked({ type: 'bestiary', monsterId: 'kraken', tier: 1 }, save)).toBe(true);
    // XP-Bedingungen zählen die Gesamt-Erfahrung, nicht die (ausgebbare) aktuelle
    save.xp = 0;
    save.stats.totalXp = 5000;
    expect(conditionMet({ type: 'xp', amount: 3000 }, save)).toBe(true);
    expect(describeCondition({ type: 'bestiary', monsterId: 'kraken', tier: 2 }, content)).toBe('Kraken Stufe 2 besiegen');
  });
});

describe('Shop', () => {
  it('kaufen kostet Perlen, ausrüsten nur im Besitz', () => {
    const content = createRegistries();
    const save = createDefaultSave();
    expect(equipItem('board', 'speedster', save, content)).toBe(false);
    expect(buyItem('board', 'speedster', save, content)).toBe(false); // zu wenig Perlen
    save.pearls = 1000;
    expect(itemStatus('board', content.boards.get('speedster'), save, content).canBuy).toBe(true);
    expect(buyItem('board', 'speedster', save, content)).toBe(true);
    expect(save.pearls).toBe(1000 - content.boards.get('speedster').price);
    expect(buyItem('board', 'speedster', save, content)).toBe(false); // schon im Besitz
    expect(equipItem('board', 'speedster', save, content)).toBe(true);
    expect(save.equipped.board).toBe('speedster');
    expect(itemStatus('board', content.boards.get('speedster'), save, content).equipped).toBe(true);
  });

  it('gesperrte Gegenstände brauchen erst die Bedingung', () => {
    const content = createRegistries();
    const save = createDefaultSave();
    save.pearls = 5000;
    const st = itemStatus('board', content.boards.get('kraken_slayer'), save, content);
    expect(st.canBuy).toBe(false);
    expect(st.lockedReason).toContain('Kraken');
    save.bestiary.kraken = { seen: 3, defeated: 3, highestTierDefeated: 2, defeatedByTier: { 1: 2, 2: 1 } };
    expect(buyItem('board', 'kraken_slayer', save, content)).toBe(true);
  });

  it('Skins funktionieren genauso', () => {
    const content = createRegistries();
    const save = createDefaultSave();
    save.pearls = 200;
    expect(buyItem('skin', 'tourist', save, content)).toBe(true);
    expect(equipItem('skin', 'tourist', save, content)).toBe(true);
    expect(save.equipped.skin).toBe('tourist');
  });
});

describe('Skillbaum', () => {
  it('prüft Voraussetzungen und Kosten und zieht sie ab', () => {
    const content = createRegistries();
    const save = createDefaultSave();
    save.xp = 1000;
    expect(skillState(content, save, 'wave_1')).toBe('locked');
    expect(canUnlockSkill(content, save, 'paddle_1')).toBe(true);
    expect(unlockSkill(content, save, 'paddle_1')).toBe(true);
    expect(save.xp).toBe(1000 - content.skills.get('paddle_1').cost.xp!);
    expect(skillState(content, save, 'paddle_1')).toBe('owned');
    expect(skillState(content, save, 'wave_1')).toBe('available');
    save.xp = 0;
    expect(skillState(content, save, 'wave_1')).toBe('unaffordable');
    expect(unlockSkill(content, save, 'wave_1')).toBe(false);
  });

  it('aktive Fähigkeit wird freigeschaltet und automatisch ausgerüstet (max. 2 Plätze)', () => {
    const content = createRegistries();
    const save = createDefaultSave();
    save.xp = 99999;
    save.pearls = 99999;
    for (const id of ['paddle_1', 'wave_1', 'dash', 'ride_1', 'wave_call', 'magnet_1', 'shield']) expect(unlockSkill(content, save, id)).toBe(true);
    expect(unlockedActiveAbilities(content, save).map((a) => a.id).sort()).toEqual(['bubble_shield', 'tidal_dash', 'wave_call']);
    expect(save.equipped.abilities).toHaveLength(ABILITY_SLOTS);
    expect(equippedAbilities(content, save).map((a) => a.id)).toEqual(['tidal_dash', 'wave_call']);
    // Tauschen: Schild ausrüsten ersetzt den ältesten Platz
    expect(toggleAbility(content, save, 'bubble_shield')).toBe(true);
    expect(save.equipped.abilities).toEqual(['wave_call', 'bubble_shield']);
    expect(toggleAbility(content, save, 'wave_call')).toBe(true);
    expect(save.equipped.abilities).toEqual(['bubble_shield']);
    // Nicht freigeschaltete Fähigkeiten lassen sich nicht ausrüsten
    expect(toggleAbility(content, createDefaultSave(), 'tidal_dash')).toBe(false);
  });
});

describe('Bestiarium', () => {
  it('Siegel-Fortschritt zählt besiegte Stufen aller Monsterarten von Kapitel 1 (ohne Boss)', () => {
    const content = createRegistries();
    const save = createDefaultSave();
    const total = content.monsters
      .all()
      .filter((m) => !m.boss && (m.chapter ?? 1) === 1)
      .reduce((n, m) => n + m.tiers.length, 0);
    expect(bestiaryProgress(content, save)).toEqual({ done: 0, total });
    save.bestiary.kraken = { seen: 3, defeated: 2, highestTierDefeated: 2, defeatedByTier: { 1: 1, 2: 1 } };
    save.bestiary.shark = { seen: 1, defeated: 1, highestTierDefeated: 1, defeatedByTier: { 1: 1 } };
    expect(bestiaryProgress(content, save).done).toBe(3);
    expect(bossAvailable(content, save)).toBe(false);
    for (const m of content.monsters.all()) if (!m.boss) save.bestiary[m.id] = { seen: 1, defeated: 1, highestTierDefeated: m.tiers.length, defeatedByTier: {} };
    expect(bestiaryProgress(content, save)).toEqual({ done: total, total });
    // Alle Siegel gebrochen → der Wächter darf erscheinen; nach dem Sieg nicht mehr
    expect(bossAvailable(content, save)).toBe(true);
    save.progress.bossDefeated = true;
    expect(bossAvailable(content, save)).toBe(false);
  });

  it('Vorkommen nach Zonen', () => {
    const content = createRegistries();
    expect(monsterZones(content, 'jelly')).not.toContain('Offenes Meer');
    expect(monsterZones(content, 'shark')[0]).toBe('Offenes Meer');
  });
});

describe('Spielstand-Migration v1 → v4', () => {
  it('übernimmt alte Spielstände', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'surfguy.save',
      JSON.stringify({
        version: 1,
        pearls: 42,
        xp: 300,
        highscore: 1234,
        unlocked: { boards: ['classic', 'speedster'], skins: ['default'], skills: ['paddle_1'], tricks: [] },
        equipped: { board: 'speedster', skin: 'default' },
        bestiary: { kraken: { seen: 2, defeated: 1, highestTierDefeated: 1, defeatedByTier: { 1: 1 } } },
        stats: { runs: 5, totalPearls: 80, totalMonstersDefeated: 1, bestCombo: 3 },
        settings: { quality: 'auto' },
      }),
    );
    const save = new SaveStore(storage).load();
    expect(save.version).toBe(7);
    expect(save.progress.activeChapter).toBe(1);
    expect(save.progress.glacierOpen).toBe(false);
    expect(save.progress.colossusDefeated).toBe(false);
    expect(save.missions.list).toEqual([]);
    expect(save.stats.tricksLanded).toBe(0);
    expect(save.progress.volcanoOpen).toBe(false);
    expect(save.progress.titanDefeated).toBe(false);
    expect(save.pearls).toBe(42);
    expect(save.progress.chapter).toBe(1);
    expect(save.progress.metKeoni).toBe(false);
    expect(save.unlocked.boardDesigns).toEqual([]);
    expect(save.equipped.boardDesign).toBe('');
    expect(save.progress.bossDefeated).toBe(false);
    expect(save.stats.chestsOpened).toBe(0);
    expect(save.equipped.board).toBe('speedster');
    expect(save.equipped.abilities).toEqual([]);
    expect(save.stats.totalXp).toBe(300);
    expect(save.bestiary.kraken?.highestTierDefeated).toBe(1);
  });
});

describe('Truhen', () => {
  it('Inhalte sind gültig und jede Seltenheit kommt vor', () => {
    const content = createRegistries();
    const rarities = new Set(content.chestRewards.all().map((r) => r.rarity));
    expect([...rarities].sort()).toEqual(['common', 'epic', 'legendary', 'rare']);
  });

  it('gewichtetes Ziehen: Häufiges oft, Legendäres selten', () => {
    const content = createRegistries();
    const rng = new Rng(42);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 5000; i++) {
      const r = rollChest(content, rng);
      counts[r.rarity] = (counts[r.rarity] ?? 0) + 1;
    }
    expect(counts.common!).toBeGreaterThan(counts.rare!);
    expect(counts.rare!).toBeGreaterThan(counts.epic!);
    expect(counts.epic!).toBeGreaterThan(counts.legendary!);
    expect(counts.legendary!).toBeGreaterThan(0);
  });

  it('Perlen, XP und Designs landen im Spielstand; doppelte Designs werden zu Perlen', () => {
    const content = createRegistries();
    const save = createDefaultSave();
    applyChestReward(save, content.chestRewards.get('pearls_m'));
    expect(save.pearls).toBe(80);
    applyChestReward(save, content.chestRewards.get('xp_m'));
    expect(save.xp).toBe(150);
    expect(save.stats.totalXp).toBe(150);
    const first = applyChestReward(save, content.chestRewards.get('design_neon'));
    expect(first.design).toBe('neon');
    expect(save.unlocked.boardDesigns).toEqual(['neon']);
    const dup = applyChestReward(save, content.chestRewards.get('design_neon'));
    expect(dup.duplicate).toBe(true);
    expect(dup.pearls).toBeGreaterThan(0);
    expect(save.stats.chestsOpened).toBe(4);
    // Ausrüsten nur, wenn vorhanden
    expect(equipDesign(save, 'galaxy')).toBe(false);
    expect(equipDesign(save, 'neon')).toBe(true);
    expect(save.equipped.boardDesign).toBe('neon');
    expect(equipDesign(save, '')).toBe(true);
  });
});

describe('Kapitelwahl', () => {
  it('erst ab Kapitel 2 wählbar, nur erreichte Kapitel, neues Kapitel wird aktiv', () => {
    const save = createDefaultSave();
    expect(chapterSelectable(save)).toBe(false);
    expect(selectChapter(save, 2)).toBe(false);
    reachChapter(save, 2);
    expect(save.progress.chapter).toBe(2);
    expect(save.progress.activeChapter).toBe(2);
    expect(chapterSelectable(save)).toBe(true);
    expect(selectChapter(save, 1)).toBe(true);
    expect(save.progress.activeChapter).toBe(1);
    expect(selectChapter(save, 1)).toBe(false); // schon aktiv
    expect(selectChapter(save, 3)).toBe(false); // noch nicht erreicht
    reachChapter(save, 3);
    expect(save.progress.activeChapter).toBe(3);
    // erneutes „Erreichen“ eines alten Kapitels senkt den Fortschritt nicht
    reachChapter(save, 2);
    expect(save.progress.chapter).toBe(3);
  });

  it('Spielstand v6 → v7: aktives Kapitel = erreichtes Kapitel', () => {
    const storage = new MemoryStorage();
    const old = createDefaultSave() as unknown as Record<string, unknown>;
    old.version = 6;
    old.progress = { bossDefeated: true, metKeoni: true, chapter: 2, volcanoOpen: true, titanDefeated: false };
    storage.setItem('surfguy.save', JSON.stringify(old));
    const save = new SaveStore(storage).load();
    expect(save.version).toBe(7);
    expect(save.progress.activeChapter).toBe(2);
    expect(save.progress.glacierOpen).toBe(false);
  });
});
