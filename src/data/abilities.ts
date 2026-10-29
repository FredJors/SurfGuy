/** Fähigkeiten. Passive wirken über Modifikatoren; aktive folgen ab Meilenstein 2. */
import type { AbilityDef } from './types';

export const ABILITIES: AbilityDef[] = [
  {
    id: 'extra_heart',
    name: 'Zähes Herz',
    description: '+1 Herz pro Run.',
    kind: 'passive',
    modifiers: [{ stat: 'maxHearts', op: 'add', value: 1 }],
  },
  {
    id: 'pearl_magnet',
    name: 'Perlenmagnet',
    description: 'Perlen werden aus größerer Entfernung eingesammelt.',
    kind: 'passive',
    modifiers: [{ stat: 'pearlMagnet', op: 'addPct', value: 0.75 }],
  },
  {
    id: 'tidal_dash',
    name: 'Gezeiten-Sprint',
    description: 'Kurzer Tempo-Schub auf Knopfdruck (ab Meilenstein 2).',
    kind: 'active',
    cooldown: 20,
    effect: 'speedBurst',
  },
];
