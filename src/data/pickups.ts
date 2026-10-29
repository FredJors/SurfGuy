/**
 * Dinge, die im Meer treiben und eingesammelt werden: Schatzkisten und Power-ups.
 * Power-ups wirken über das Modifikator-System (zeitlich begrenzt) oder als Tempo-Schub.
 * Freie Perlen (Ketten, Bögen, Goldperlen) stellt CONFIG.pickups ein.
 */
import type { PickupDef } from './types';

export const PICKUPS: PickupDef[] = [
  {
    id: 'chest',
    name: 'Schatzkiste',
    model: 'chest',
    icon: '▣',
    color: '#ffd23f',
    pearls: 18,
    points: 400,
    spawnWeight: 3,
    radius: 2.8,
  },
  {
    id: 'magnet',
    name: 'Perlenmagnet',
    model: 'powerup',
    colors: { core: '#ff5fa2' },
    icon: '◎',
    color: '#ff5fa2',
    modifiers: [{ stat: 'pearlMagnet', op: 'mul', value: 3.5 }],
    duration: 15,
    spawnWeight: 2,
    radius: 2.6,
  },
  {
    id: 'double_points',
    name: 'Doppelte Punkte',
    model: 'powerup',
    colors: { core: '#ffd23f' },
    icon: '×2',
    color: '#ffd23f',
    modifiers: [{ stat: 'scoreGain', op: 'mul', value: 2 }],
    duration: 15,
    spawnWeight: 2,
    radius: 2.6,
  },
  {
    id: 'turbo',
    name: 'Turbo',
    model: 'powerup',
    colors: { core: '#3fe0ff' },
    icon: '»',
    color: '#3fe0ff',
    boost: 10,
    spawnWeight: 2,
    radius: 2.6,
  },
];
