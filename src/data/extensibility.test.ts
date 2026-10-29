/**
 * Zeigt (und prüft), dass neue Inhalte reine Dateneinträge sind – siehe README „Neue Inhalte“.
 */
import { describe, expect, it } from 'vitest';
import { MONSTER_BEHAVIORS } from '../monsters/behaviors';
import { CONFIG } from '../config/gameConfig';
import { createDefaultSave } from '../core/SaveGame';
import { ABILITY_EFFECTS } from '../player/abilityEffects';
import { bestiaryProgress, createPlayerStats, equippedAbilities, monsterZones, unlockSkill } from '../player/Progression';
import { DollarOneRecognizer } from '../tricks/recognizer/DollarOne';
import { polyline } from '../tricks/recognizer/shapes';
import { createRegistries, validateContent } from './index';
import type { AbilityDef, BoardDef, MonsterDef, PickupDef, SkillNodeDef, SymbolDef, TrickDef } from './types';

describe('Erweiterbarkeit', () => {
  it('neuer Trick = neues Symbol + neuer Trick-Eintrag', () => {
    const content = createRegistries();
    const triangle: SymbolDef = {
      id: 'triangle',
      name: 'Dreieck',
      templates: [
        polyline([[50, 0], [100, 90], [0, 90], [50, 0]]),
        polyline([[50, 0], [0, 90], [100, 90], [50, 0]]),
      ],
      preview: polyline([[50, 0], [100, 90], [0, 90], [50, 0]]),
    };
    const trick: TrickDef = {
      id: 'shark_fin',
      name: 'Haifischflosse',
      description: 'Schneller Vorwärtsstoß.',
      symbols: ['triangle'],
      duration: 0.8,
      hitTime: 0.5,
      damage: 30,
      hitArea: { shape: 'cone', range: 10, halfAngleDeg: 30 },
      targeting: 'nearest',
      points: 260,
      unlock: { type: 'default' },
      color: '#7ef0c6',
      animation: { spin: { roll: 1 }, poses: [{ t: 0, pose: 'crouch' }, { t: 0.5, pose: 'air' }, { t: 1, pose: 'stand' }] },
    };
    content.symbols.register(triangle);
    content.tricks.register(trick);
    expect(validateContent(content, Object.keys(MONSTER_BEHAVIORS))).toEqual([]);

    const r = new DollarOneRecognizer();
    for (const s of content.symbols.all()) for (const t of s.templates) r.addTemplate(s.id, t);
    const drawn = polyline([[200, 100], [262, 210], [140, 212], [198, 104]]);
    const res = r.recognize(drawn);
    expect(res.symbolId).toBe('triangle');
    expect(res.score).toBeGreaterThan(CONFIG.trick.quality.okay);
  });

  it('neues Board = neuer Board-Eintrag, Werte wirken sofort', () => {
    const content = createRegistries();
    const board: BoardDef = {
      id: 'lava_rider',
      name: 'Lava Rider',
      description: 'Heiß und schnell.',
      model: 'board',
      colors: { base: '#ff6a1a', stripe: '#1d2140', rail: '#ffd23f' },
      stats: { speed: 1.25, agility: 0.85, airtime: 1.1, stability: 0.9 },
      price: 1500,
      unlock: { type: 'pearls', amount: 1500 },
    };
    content.boards.register(board);
    expect(validateContent(content, Object.keys(MONSTER_BEHAVIORS))).toEqual([]);
    const save = createDefaultSave();
    save.equipped.board = 'lava_rider';
    const stats = createPlayerStats(content, save);
    expect(stats.get('maxSpeed')).toBeCloseTo(CONFIG.playerBase.maxSpeed * 1.25);
    expect(stats.get('jumpPower')).toBeCloseTo(1.1);
  });

  it('neues Monster mit vorhandenem Verhalten = nur Dateneintrag', () => {
    const content = createRegistries();
    const before = bestiaryProgress(content, createDefaultSave()).total;
    const shark = content.monsters.get('shark');
    const tiger: MonsterDef = {
      ...shark,
      id: 'tiger_shark',
      name: 'Tigerhai',
      description: 'Gestreift, schneller und nur in der Nähe des Vulkans.',
      hp: 120,
      chaseSpeed: 13,
      behaviorParams: { ...shark.behaviorParams, chargeSpeed: 30 },
      zoneWeights: { inner: 1.5 },
      colors: { body: '#d98a3a', accent: '#2b1d14', eye: '#ffe066' },
    };
    content.monsters.register(tiger);
    expect(validateContent(content, Object.keys(MONSTER_BEHAVIORS))).toEqual([]);
    expect(monsterZones(content, 'tiger_shark')).toEqual([content.zones.get('inner').name]);
    expect(bestiaryProgress(content, createDefaultSave()).total).toBe(before + tiger.tiers.length);
  });

  it('neue Fähigkeit + Skill-Knoten = zwei Dateneinträge', () => {
    const content = createRegistries();
    const ability: AbilityDef = {
      id: 'turbo_dash',
      name: 'Turbo-Sprint',
      description: 'Noch kräftigerer Schub, kürzere Abklingzeit.',
      kind: 'active',
      icon: '⇶',
      cooldown: 10,
      effect: 'speedBurst',
      params: { boost: 12 },
    };
    const node: SkillNodeDef = {
      id: 'dash_2',
      icon: '⇶',
      name: 'Turbo-Sprint',
      description: 'Aktive Fähigkeit: stärkerer Gezeiten-Sprint.',
      requires: ['dash'],
      cost: { xp: 600, pearls: 200 },
      grantsAbility: 'turbo_dash',
      position: { col: 0.45, row: 3 },
    };
    content.abilities.register(ability);
    content.skills.register(node);
    expect(validateContent(content, Object.keys(MONSTER_BEHAVIORS), Object.keys(ABILITY_EFFECTS))).toEqual([]);

    const save = createDefaultSave();
    save.xp = 5000;
    save.pearls = 1000;
    for (const id of ['paddle_1', 'wave_1', 'dash', 'dash_2']) expect(unlockSkill(content, save, id)).toBe(true);
    expect(equippedAbilities(content, save).map((a) => a.id)).toEqual(['tidal_dash', 'turbo_dash']);
  });

  it('neues Power-up = Dateneintrag, wirkt über Modifikatoren', () => {
    const content = createRegistries();
    const superJump: PickupDef = {
      id: 'super_jump',
      name: 'Supersprung',
      model: 'powerup',
      colors: { core: '#7dee8a' },
      icon: '⇑',
      color: '#7dee8a',
      modifiers: [{ stat: 'jumpPower', op: 'mul', value: 1.5 }],
      duration: 12,
      spawnWeight: 1,
      radius: 2.6,
    };
    content.pickups.register(superJump);
    expect(validateContent(content, Object.keys(MONSTER_BEHAVIORS))).toEqual([]);
    const stats = createPlayerStats(content, createDefaultSave());
    stats.addSource({ id: 'powerup:super_jump', modifiers: superJump.modifiers! });
    expect(stats.get('jumpPower')).toBeCloseTo(1.5);
    // Ohne Dauer ist ein Power-up mit Modifikatoren ungültig
    content.pickups.register({ ...superJump, id: 'broken', duration: undefined });
    expect(validateContent(content, Object.keys(MONSTER_BEHAVIORS)).some((e) => e.includes('broken'))).toBe(true);
  });

  it('fehlerhafte Verweise werden gemeldet', () => {
    const content = createRegistries();
    content.tricks.register({ ...content.tricks.get('salto'), id: 'broken', symbols: ['gibtsnicht'] });
    expect(validateContent(content, Object.keys(MONSTER_BEHAVIORS)).some((e) => e.includes('gibtsnicht'))).toBe(true);
    content.abilities.register({ ...content.abilities.get('tidal_dash'), id: 'broken_ability', effect: 'teleport' });
    expect(validateContent(content, Object.keys(MONSTER_BEHAVIORS), Object.keys(ABILITY_EFFECTS)).some((e) => e.includes('teleport'))).toBe(true);
  });
});
