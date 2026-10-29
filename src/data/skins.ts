/**
 * Skins = Modell- bzw. Materialvarianten des Surfers. Für den Platzhalter: Farben und
 * optionales Zubehör ('cap', 'sunglasses', 'bandana', 'headband', 'flower').
 */
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
    id: 'tourist',
    name: 'Tourist',
    model: 'surfer',
    colors: { skin: '#ffd2b3', hair: '#e8c070', shirt: '#2ec4b6', shorts: '#ff9f1c' },
    accessories: ['cap', 'sunglasses'],
    price: 150,
    unlock: { type: 'pearls', amount: 150 },
  },
  {
    id: 'lifeguard',
    name: 'Rettungsschwimmerin',
    model: 'surfer',
    colors: { skin: '#c98b5e', hair: '#f5d76e', shirt: '#ff3b30', shorts: '#ffd23f' },
    accessories: ['headband'],
    price: 250,
    unlock: { type: 'pearls', amount: 250 },
  },
  {
    id: 'island',
    name: 'Inselkind',
    model: 'surfer',
    colors: { skin: '#a8714a', hair: '#1b1b1b', shirt: '#ffe066', shorts: '#3fa34d' },
    accessories: ['flower'],
    price: 300,
    unlock: { type: 'pearls', amount: 300 },
  },
  {
    id: 'reef',
    name: 'Riff-Taucher',
    model: 'surfer',
    colors: { skin: '#8d5a3b', hair: '#111111', shirt: '#22d3ee', shorts: '#0f766e' },
    accessories: ['sunglasses'],
    price: 350,
    unlock: { type: 'bestiary', monsterId: 'kraken', tier: 1 },
  },
  {
    id: 'pirate',
    name: 'Piratin',
    model: 'surfer',
    colors: { skin: '#e8b48f', hair: '#7a2e1e', shirt: '#f4f1e8', shorts: '#2b2b44' },
    accessories: ['bandana'],
    price: 500,
    unlock: { type: 'bestiary', monsterId: 'shark', tier: 2 },
  },
  {
    id: 'night',
    name: 'Nachtsurfer',
    model: 'surfer',
    colors: { skin: '#d9a07a', hair: '#e0e0ff', shirt: '#1d2140', shorts: '#5a3fd8' },
    accessories: ['headband', 'sunglasses'],
    price: 600,
    unlock: { type: 'xp', amount: 3000 },
  },
];
