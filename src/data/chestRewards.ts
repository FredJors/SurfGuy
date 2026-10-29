/**
 * Inhalt der Truhen (Glücksspiel nach dem Run). `weight` = relative Wahrscheinlichkeit.
 * Board-Designs, die man schon hat, werden in Perlen umgewandelt (CONFIG.chests.duplicatePearls).
 */
import type { ChestRewardDef } from './types';

export const CHEST_REWARDS: ChestRewardDef[] = [
  // Perlenhaufen
  { id: 'pearls_s', name: 'Perlenhäufchen', rarity: 'common', weight: 30, pearls: 30 },
  { id: 'pearls_m', name: 'Perlenhaufen', rarity: 'rare', weight: 14, pearls: 80 },
  { id: 'pearls_l', name: 'Perlenberg', rarity: 'epic', weight: 5, pearls: 200 },
  { id: 'pearls_xl', name: 'Perlenschatz', rarity: 'legendary', weight: 1.2, pearls: 500 },
  // XP-Flaschen
  { id: 'xp_s', name: 'Kleine XP-Flasche', rarity: 'common', weight: 26, xp: 60 },
  { id: 'xp_m', name: 'XP-Flasche', rarity: 'rare', weight: 12, xp: 150 },
  { id: 'xp_l', name: 'Große XP-Flasche', rarity: 'epic', weight: 4, xp: 400 },
  // Board-Designs
  { id: 'design_sunset', name: 'Design „Sonnenuntergang“', rarity: 'rare', weight: 4, design: 'sunset' },
  { id: 'design_deep_sea', name: 'Design „Tiefsee“', rarity: 'rare', weight: 4, design: 'deep_sea' },
  { id: 'design_watermelon', name: 'Design „Wassermelone“', rarity: 'rare', weight: 4, design: 'watermelon' },
  { id: 'design_neon', name: 'Design „Neon“', rarity: 'epic', weight: 1.6, design: 'neon' },
  { id: 'design_galaxy', name: 'Design „Galaxie“', rarity: 'epic', weight: 1.6, design: 'galaxy' },
  { id: 'design_lava', name: 'Design „Lava“', rarity: 'epic', weight: 1.6, design: 'lava' },
  { id: 'design_golden_wave', name: 'Design „Goldwelle“', rarity: 'legendary', weight: 0.5, design: 'golden_wave' },
  { id: 'design_kraken_ink', name: 'Design „Krakentinte“', rarity: 'legendary', weight: 0.5, design: 'kraken_ink' },
];
