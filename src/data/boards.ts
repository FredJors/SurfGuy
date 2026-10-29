/**
 * Surfbretter. `stats` sind Faktoren auf die Grundwerte aus der Konfiguration
 * (1 = Standard). Zusätzliche `modifiers` sind optional.
 */
import type { BoardDef } from './types';

export const BOARDS: BoardDef[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Das Allround-Brett. Verzeiht viel.',
    model: 'board',
    colors: { base: '#ffd23f', stripe: '#ff6b35', rail: '#ffffff' },
    stats: { speed: 1, agility: 1, airtime: 1, stability: 1 },
    price: 0,
    unlock: { type: 'default' },
  },
  {
    id: 'speedster',
    name: 'Speedster',
    description: 'Schnell auf der Geraden, etwas zickig in Kurven.',
    model: 'board',
    colors: { base: '#ff4f6d', stripe: '#1d1d3a', rail: '#ffe066' },
    stats: { speed: 1.15, agility: 0.9, airtime: 1, stability: 0.9 },
    price: 600,
    unlock: { type: 'pearls', amount: 600 },
  },
  {
    id: 'floater',
    name: 'Floater',
    description: 'Leicht wie eine Feder – mehr Airtime, mehr Zeit zum Zeichnen.',
    model: 'board',
    colors: { base: '#7ef0c6', stripe: '#2d6cdf', rail: '#ffffff' },
    stats: { speed: 0.95, agility: 1.05, airtime: 1.2, stability: 1 },
    modifiers: [{ stat: 'waveBoost', op: 'addPct', value: 0.05 }],
    price: 900,
    unlock: { type: 'pearls', amount: 900 },
  },
];
