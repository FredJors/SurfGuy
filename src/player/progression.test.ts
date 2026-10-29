import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config/gameConfig';
import { createDefaultSave } from '../core/SaveGame';
import { createRegistries } from '../data';
import { canUnlockSkill, createPlayerStats, isUnlocked } from './Progression';

describe('Progression', () => {
  it('Board-Werte wirken als Modifikatoren', () => {
    const content = createRegistries();
    const save = createDefaultSave();
    save.equipped.board = 'speedster';
    const stats = createPlayerStats(content, save);
    expect(stats.get('maxSpeed')).toBeCloseTo(CONFIG.playerBase.maxSpeed * 1.15);
    expect(stats.get('turnRate')).toBeCloseTo(CONFIG.playerBase.turnRate * 0.9);
  });

  it('Skills und gewährte Fähigkeiten verändern Werte', () => {
    const content = createRegistries();
    const save = createDefaultSave();
    save.unlocked.skills = ['paddle_1', 'heart_1'];
    const stats = createPlayerStats(content, save);
    expect(stats.get('paddleSpeed')).toBeCloseTo(CONFIG.playerBase.paddleSpeed * 1.1);
    expect(stats.get('maxHearts')).toBe(CONFIG.playerBase.maxHearts + 1);
  });

  it('Skillbaum prüft Voraussetzungen und Kosten', () => {
    const content = createRegistries();
    const save = createDefaultSave();
    save.xp = 1000;
    expect(canUnlockSkill(content, save, 'wave_1')).toBe(false);
    expect(canUnlockSkill(content, save, 'paddle_1')).toBe(true);
    save.unlocked.skills.push('paddle_1');
    expect(canUnlockSkill(content, save, 'wave_1')).toBe(true);
  });

  it('Freischaltbedingungen', () => {
    const save = createDefaultSave();
    expect(isUnlocked({ type: 'default' }, save)).toBe(true);
    expect(isUnlocked({ type: 'bestiary', monsterId: 'kraken', tier: 1 }, save)).toBe(false);
    save.bestiary.kraken = { seen: 1, defeated: 1, highestTierDefeated: 1, defeatedByTier: { 1: 1 } };
    expect(isUnlocked({ type: 'bestiary', monsterId: 'kraken', tier: 1 }, save)).toBe(true);
  });
});
