/**
 * Fähigkeiten. Passive wirken über Modifikatoren; aktive werden im Run per Knopf (Q/E bzw.
 * Knöpfe rechts) ausgelöst. `effect` verweist auf player/abilityEffects.ts.
 * Fähigkeiten werden über Skill-Knoten freigeschaltet (data/skills.ts → grantsAbility).
 */
import type { AbilityDef } from './types';

export const ABILITIES: AbilityDef[] = [
  {
    id: 'extra_heart',
    name: 'Zähes Herz',
    description: '+1 Herz pro Run.',
    kind: 'passive',
    icon: '♥',
    modifiers: [{ stat: 'maxHearts', op: 'add', value: 1 }],
  },
  {
    id: 'pearl_magnet',
    name: 'Perlenmagnet',
    description: 'Perlen werden aus größerer Entfernung eingesammelt.',
    kind: 'passive',
    icon: '◎',
    modifiers: [{ stat: 'pearlMagnet', op: 'addPct', value: 0.75 }],
  },
  {
    id: 'tidal_dash',
    name: 'Gezeiten-Sprint',
    description: 'Kräftiger Tempo-Schub – auch aus dem Liegen direkt aufs Brett.',
    kind: 'active',
    icon: '»',
    cooldown: 14,
    effect: 'speedBurst',
    params: { boost: 8 },
  },
  {
    id: 'wave_call',
    name: 'Wellenruf',
    description: 'Ruft eine große Welle, die dich kurz darauf von hinten erreicht.',
    kind: 'active',
    icon: '≈',
    cooldown: 28,
    effect: 'callWave',
    params: { height: 2.4, arrival: 2.8 },
  },
  {
    id: 'bubble_shield',
    name: 'Blasenschild',
    description: 'Eine Blase schützt dich vor dem nächsten Treffer.',
    kind: 'active',
    icon: '◯',
    cooldown: 30,
    duration: 12,
    effect: 'shield',
  },
];
