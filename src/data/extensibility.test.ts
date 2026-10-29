/**
 * Zeigt (und prüft), dass neue Inhalte reine Dateneinträge sind – siehe README „Neue Inhalte“.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config/gameConfig';
import { createDefaultSave } from '../core/SaveGame';
import { createPlayerStats } from '../player/Progression';
import { DollarOneRecognizer } from '../tricks/recognizer/DollarOne';
import { polyline } from '../tricks/recognizer/shapes';
import { createRegistries, validateContent } from './index';
import type { BoardDef, SymbolDef, TrickDef } from './types';

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
    expect(validateContent(content, ['kraken'])).toEqual([]);

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
    expect(validateContent(content, ['kraken'])).toEqual([]);
    const save = createDefaultSave();
    save.equipped.board = 'lava_rider';
    const stats = createPlayerStats(content, save);
    expect(stats.get('maxSpeed')).toBeCloseTo(CONFIG.playerBase.maxSpeed * 1.25);
    expect(stats.get('jumpPower')).toBeCloseTo(1.1);
  });

  it('fehlerhafte Verweise werden gemeldet', () => {
    const content = createRegistries();
    content.tricks.register({ ...content.tricks.get('salto'), id: 'broken', symbols: ['gibtsnicht'] });
    expect(validateContent(content, ['kraken']).some((e) => e.includes('gibtsnicht'))).toBe(true);
  });
});
