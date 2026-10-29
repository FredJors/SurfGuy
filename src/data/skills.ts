/**
 * Skillbaum. `requires` bildet die Baumstruktur, `position` die Lage im (späteren) UI.
 * Kosten werden ab Meilenstein 2 im Skillbaum-Bildschirm bezahlt.
 */
import type { SkillNodeDef } from './types';

export const SKILL_NODES: SkillNodeDef[] = [
  {
    id: 'paddle_1',
    name: 'Kräftige Arme',
    description: '+10 % Paddeltempo.',
    requires: [],
    cost: { xp: 100 },
    modifiers: [
      { stat: 'paddleSpeed', op: 'addPct', value: 0.1 },
      { stat: 'paddleAccel', op: 'addPct', value: 0.1 },
    ],
    position: { col: 0, row: 0 },
  },
  {
    id: 'wave_1',
    name: 'Wellengespür',
    description: 'Größeres Zeitfenster zum Erwischen von Wellen.',
    requires: ['paddle_1'],
    cost: { xp: 250 },
    modifiers: [{ stat: 'catchWindow', op: 'addPct', value: 0.2 }],
    position: { col: 0, row: 1 },
  },
  {
    id: 'trick_1',
    name: 'Trickkunst',
    description: '+10 % Trickschaden.',
    requires: [],
    cost: { xp: 150 },
    modifiers: [{ stat: 'trickDamage', op: 'addPct', value: 0.1 }],
    position: { col: 1, row: 0 },
  },
  {
    id: 'trick_2',
    name: 'Showtalent',
    description: '+15 % Trickpunkte.',
    requires: ['trick_1'],
    cost: { xp: 300 },
    modifiers: [{ stat: 'trickPoints', op: 'addPct', value: 0.15 }],
    position: { col: 1, row: 1 },
  },
  {
    id: 'heart_1',
    name: 'Zähes Herz',
    description: 'Schaltet die Fähigkeit „Zähes Herz“ frei (+1 Herz).',
    requires: ['wave_1', 'trick_2'],
    cost: { xp: 800, pearls: 300 },
    grantsAbility: 'extra_heart',
    position: { col: 0.5, row: 2 },
  },
];
