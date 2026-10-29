/**
 * Skillbaum mit drei Ästen: Surfen, Tricks, Überleben.
 * `requires` bildet die Baumstruktur, `position` die Lage im Skillbaum-Bildschirm
 * (col = Spalte 0–2, Zwischenwerte erlaubt; row = Zeile von oben).
 * Kosten: Erfahrung (XP) und/oder Perlen.
 */
import type { SkillNodeDef } from './types';

export const SKILL_NODES: SkillNodeDef[] = [
  // --- Surfen ---------------------------------------------------------------
  {
    id: 'paddle_1',
    name: 'Kräftige Arme',
    description: '+10 % Paddeltempo und -beschleunigung.',
    requires: [],
    cost: { xp: 80 },
    modifiers: [
      { stat: 'paddleSpeed', op: 'addPct', value: 0.1 },
      { stat: 'paddleAccel', op: 'addPct', value: 0.1 },
    ],
    position: { col: 0, row: 0 },
  },
  {
    id: 'wave_1',
    name: 'Wellengespür',
    description: '+25 % größeres Zeitfenster zum Erwischen von Wellen.',
    requires: ['paddle_1'],
    cost: { xp: 180 },
    modifiers: [{ stat: 'catchWindow', op: 'addPct', value: 0.25 }],
    position: { col: 0, row: 1 },
  },
  {
    id: 'ride_1',
    name: 'Wellenreiter',
    description: '+20 % Tempo-Boost beim Erwischen einer Welle.',
    requires: ['wave_1'],
    cost: { xp: 320 },
    modifiers: [{ stat: 'waveBoost', op: 'addPct', value: 0.2 }],
    position: { col: -0.3, row: 2 },
  },
  {
    id: 'dash',
    name: 'Gezeiten-Sprint',
    description: 'Aktive Fähigkeit: kräftiger Tempo-Schub auf Knopfdruck.',
    requires: ['wave_1'],
    cost: { xp: 300, pearls: 120 },
    grantsAbility: 'tidal_dash',
    position: { col: 0.3, row: 2 },
  },
  {
    id: 'speed_1',
    name: 'Leichtgewicht',
    description: '+6 % Höchst- und Reisetempo.',
    requires: ['ride_1'],
    cost: { xp: 550 },
    modifiers: [
      { stat: 'maxSpeed', op: 'addPct', value: 0.06 },
      { stat: 'cruiseSpeed', op: 'addPct', value: 0.06 },
    ],
    position: { col: -0.3, row: 3 },
  },
  {
    id: 'wave_call',
    name: 'Wellenruf',
    description: 'Aktive Fähigkeit: ruft eine große Welle herbei.',
    requires: ['ride_1', 'dash'],
    cost: { xp: 800, pearls: 300 },
    grantsAbility: 'wave_call',
    position: { col: 0.15, row: 4 },
  },

  // --- Tricks ---------------------------------------------------------------
  {
    id: 'trick_1',
    name: 'Trickkunst',
    description: '+10 % Trickschaden.',
    requires: [],
    cost: { xp: 120 },
    modifiers: [{ stat: 'trickDamage', op: 'addPct', value: 0.1 }],
    position: { col: 1, row: 0 },
  },
  {
    id: 'trick_2',
    name: 'Showtalent',
    description: '+15 % Trickpunkte.',
    requires: ['trick_1'],
    cost: { xp: 260 },
    modifiers: [{ stat: 'trickPoints', op: 'addPct', value: 0.15 }],
    position: { col: 0.75, row: 1 },
  },
  {
    id: 'air_1',
    name: 'Sprungkraft',
    description: '+8 % Sprungkraft – mehr Airtime, mehr Zeit zum Zeichnen.',
    requires: ['trick_1'],
    cost: { xp: 260 },
    modifiers: [{ stat: 'jumpPower', op: 'addPct', value: 0.08 }],
    position: { col: 1.25, row: 1 },
  },
  {
    id: 'draw_1',
    name: 'Ruhige Hand',
    description: '+20 % Zeit im Zeichenfenster.',
    requires: ['air_1'],
    cost: { xp: 420 },
    modifiers: [{ stat: 'drawTime', op: 'addPct', value: 0.2 }],
    position: { col: 1.25, row: 2 },
  },
  {
    id: 'trick_3',
    name: 'Meister-Trickser',
    description: '+20 % Trickschaden und +10 % Trickpunkte.',
    requires: ['trick_2', 'draw_1'],
    cost: { xp: 850 },
    modifiers: [
      { stat: 'trickDamage', op: 'addPct', value: 0.2 },
      { stat: 'trickPoints', op: 'addPct', value: 0.1 },
    ],
    position: { col: 1, row: 3 },
  },

  // --- Überleben ------------------------------------------------------------
  {
    id: 'magnet_1',
    name: 'Perlenmagnet',
    description: 'Perlen werden aus größerer Entfernung eingesammelt.',
    requires: [],
    cost: { xp: 120 },
    grantsAbility: 'pearl_magnet',
    position: { col: 2, row: 0 },
  },
  {
    id: 'pearl_1',
    name: 'Perlentaucher',
    description: '+15 % Perlen.',
    requires: ['magnet_1'],
    cost: { xp: 280 },
    modifiers: [{ stat: 'pearlGain', op: 'addPct', value: 0.15 }],
    position: { col: 1.75, row: 1 },
  },
  {
    id: 'shield',
    name: 'Blasenschild',
    description: 'Aktive Fähigkeit: schützt vor dem nächsten Treffer.',
    requires: ['magnet_1'],
    cost: { xp: 320, pearls: 150 },
    grantsAbility: 'bubble_shield',
    position: { col: 2.25, row: 1 },
  },
  {
    id: 'xp_1',
    name: 'Lernfähig',
    description: '+15 % Erfahrung.',
    requires: ['pearl_1'],
    cost: { xp: 380 },
    modifiers: [{ stat: 'xpGain', op: 'addPct', value: 0.15 }],
    position: { col: 1.75, row: 2 },
  },
  {
    id: 'tough_1',
    name: 'Dickes Fell',
    description: '+1 s Unverwundbarkeit nach einem Treffer.',
    requires: ['shield'],
    cost: { xp: 450 },
    modifiers: [{ stat: 'invulnTime', op: 'add', value: 1 }],
    position: { col: 2.25, row: 2 },
  },
  {
    id: 'heart_1',
    name: 'Zähes Herz',
    description: '+1 Herz pro Run.',
    requires: ['xp_1', 'tough_1'],
    cost: { xp: 1000, pearls: 350 },
    grantsAbility: 'extra_heart',
    position: { col: 2, row: 3 },
  },
];
