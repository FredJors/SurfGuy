/**
 * Monster. `behavior` verweist auf eine Implementierung in monsters/behaviors.ts.
 * Ein neues Monster mit vorhandenem Verhalten ist ein reiner Dateneintrag.
 */
import type { MonsterDef } from './types';

export const MONSTERS: MonsterDef[] = [
  {
    id: 'kraken',
    name: 'Kraken',
    description: 'Lauert unter den Wellen und schlägt mit seinen Tentakeln zu.',
    model: 'kraken',
    behavior: 'kraken',
    hp: 120,
    parts: [
      // hp 0 = Treffer gehen direkt auf den Hauptkörper
      { id: 'head', tag: 'head', hp: 0, count: 1, radius: 2.3 },
      { id: 'tentacle', tag: 'tentacle', hp: 55, count: 4, radius: 1.8 },
    ],
    bodyRadius: 2.6,
    partDamageToBody: 0.3,
    warningTime: 1.6,
    chaseSpeed: 6.5,
    preferredDistance: 9,
    ambush: { behindTime: 2.5, maxCount: 2, aheadDistance: 26 },
    attack: {
      windup: 1.0,
      cooldown: [1.6, 3.2],
      reach: 15,
      radius: 3.0,
      lead: 0.75,
      maxConcurrent: 2,
      graceAfterHit: 5,
    },
    weaknesses: [
      { trick: 'board_spin', tag: 'tentacle', multiplier: 2 },
      { trick: 'salto', tag: 'head', multiplier: 2 },
    ],
    tiers: [
      { tier: 1, name: 'Jungtier', hpMul: 1, speedMul: 1, windupMul: 1, rewardMul: 1 },
      { tier: 2, name: 'Ausgewachsen', hpMul: 1.5, speedMul: 1.12, windupMul: 0.88, rewardMul: 1.8, extraParts: { tentacle: 1 } },
      { tier: 3, name: 'Uralt', hpMul: 2.2, speedMul: 1.25, windupMul: 0.78, rewardMul: 3, extraParts: { tentacle: 2 } },
    ],
    rewards: { pearls: 15, xp: 60, points: 1500 },
    escapePoints: 150,
    escapeDistance: 80,
    zoneWeights: { outer: 1, middle: 1, inner: 1 },
    colors: { body: '#a54bd8', accent: '#ff8ad8', eye: '#fff36b' },
  },
];
