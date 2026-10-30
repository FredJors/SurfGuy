/**
 * Board-Designs: Farbvarianten für jedes Board (nur Optik). Gibt es ausschließlich aus Truhen,
 * die man im Run einsammelt und nach dem Wipeout öffnet.
 */
import type { BoardDesignDef } from './types';

export const BOARD_DESIGNS: BoardDesignDef[] = [
  { id: 'sunset', name: 'Sonnenuntergang', rarity: 'rare', colors: { base: '#ff7a59', stripe: '#ffd23f', rail: '#6a2c70' } },
  { id: 'deep_sea', name: 'Tiefsee', rarity: 'rare', colors: { base: '#1e5bd8', stripe: '#7fe3ff', rail: '#0b2a6b' } },
  { id: 'watermelon', name: 'Wassermelone', rarity: 'rare', colors: { base: '#ff5d73', stripe: '#2e9e44', rail: '#c8f5a8' } },
  { id: 'neon', name: 'Neon', rarity: 'epic', colors: { base: '#1b1b2f', stripe: '#39ff14', rail: '#ff00e5' } },
  { id: 'galaxy', name: 'Galaxie', rarity: 'epic', colors: { base: '#2b1d5e', stripe: '#c56bff', rail: '#ffd6ff' } },
  { id: 'lava', name: 'Lava', rarity: 'epic', colors: { base: '#2a1a1a', stripe: '#ff4d00', rail: '#ffb000' } },
  { id: 'golden_wave', name: 'Goldwelle', rarity: 'legendary', colors: { base: '#ffd23f', stripe: '#fff6c2', rail: '#b8860b' } },
  { id: 'kraken_ink', name: 'Krakentinte', rarity: 'legendary', colors: { base: '#4b1d6e', stripe: '#ff8ad8', rail: '#120822' } },
  { id: 'glacier', name: 'Gletscher', rarity: 'rare', colors: { base: '#bfe6f7', stripe: '#ffffff', rail: '#3a8fd8' } },
  { id: 'penguin', name: 'Pinguin', rarity: 'epic', colors: { base: '#22284a', stripe: '#f6f8ff', rail: '#ffa21f' } },
  { id: 'northern_lights', name: 'Nordlicht', rarity: 'legendary', colors: { base: '#0d1a44', stripe: '#39ffb0', rail: '#c56bff' } },
];
