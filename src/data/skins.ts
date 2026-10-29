/** Skins = Modell- bzw. Materialvarianten des Surfers. */
import type { SkinDef } from './types';

export const SKINS: SkinDef[] = [
  {
    id: 'default',
    name: 'Kai',
    model: 'surfer',
    colors: { skin: '#f2b58a', hair: '#3b2a1e', shirt: '#ff4f6d', shorts: '#2d6cdf' },
    price: 0,
    unlock: { type: 'default' },
  },
  {
    id: 'lifeguard',
    name: 'Rettungsschwimmerin',
    model: 'surfer',
    colors: { skin: '#c98b5e', hair: '#f5d76e', shirt: '#ff3b30', shorts: '#ffd23f' },
    price: 400,
    unlock: { type: 'pearls', amount: 400 },
  },
  {
    id: 'reef',
    name: 'Riff-Taucher',
    model: 'surfer',
    colors: { skin: '#8d5a3b', hair: '#111111', shirt: '#22d3ee', shorts: '#0f766e' },
    price: 700,
    unlock: { type: 'bestiary', monsterId: 'kraken', tier: 1 },
  },
];
