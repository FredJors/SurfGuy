/**
 * Erfolge mit Stufen (Bronze, Silber, Gold). Die Belohnung je Stufe steht in CONFIG.goals.
 * Neuer Erfolg = neuer Eintrag (Wert aus `AchievementStat`, siehe player/Goals.ts).
 */
import type { AchievementDef } from './types';

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'pearl_diver', name: 'Perlentaucher', description: 'Sammle insgesamt {n} Perlen.', stat: 'totalPearls', tiers: [500, 5000, 25000] },
  { id: 'monster_hunter', name: 'Monsterjäger', description: 'Besiege insgesamt {n} Monster.', stat: 'totalMonstersDefeated', tiers: [10, 75, 300] },
  { id: 'trickster', name: 'Trickkünstler', description: 'Lande insgesamt {n} Tricks.', stat: 'tricksLanded', tiers: [25, 200, 1000] },
  { id: 'perfectionist', name: 'Perfektionist', description: 'Zeichne {n}× „Perfekt!“.', stat: 'perfectTricks', tiers: [10, 75, 300] },
  { id: 'high_flyer', name: 'Luftakrobat', description: 'Bleib {n} Sekunden am Stück in der Luft.', stat: 'bestAirtime', tiers: [2.5, 4, 6] },
  { id: 'combo_king', name: 'Kombo-König', description: 'Schaffe eine Luft-Kombo ×{n}.', stat: 'maxAirCombo', tiers: [2, 3, 4] },
  { id: 'ramp_hero', name: 'Rampenheld', description: 'Springe {n}× von einer Rampe.', stat: 'rampJumps', tiers: [10, 75, 300] },
  { id: 'geyser_flyer', name: 'Geysir-Flieger', description: 'Lass dich {n}× von Geysiren schleudern.', stat: 'geyserJumps', tiers: [5, 40, 150] },
  { id: 'wave_rider', name: 'Wellenreiter', description: 'Erwische {n} Wellen.', stat: 'wavesCaught', tiers: [20, 150, 600] },
  { id: 'treasure_hunter', name: 'Schatzjäger', description: 'Öffne {n} Truhen.', stat: 'chestsOpened', tiers: [5, 40, 150] },
  { id: 'high_score', name: 'Rekordjäger', description: 'Erreiche {n} Punkte in einem Run.', stat: 'highscore', tiers: [5000, 25000, 75000] },
  { id: 'reef_guardian', name: 'Riffbezwinger', description: 'Besiege den Wächter der Insel.', stat: 'bossCrab', tiers: [1] },
  { id: 'keoni_friend', name: 'Keonis Freund', description: 'Besuche Keoni im Surfshop.', stat: 'metKeoni', tiers: [1] },
  { id: 'pele_favor', name: 'Peles Gunst', description: 'Besiege den Lava-Titan im Kratersee.', stat: 'bossTitan', tiers: [1] },
  { id: 'ice_breaker', name: 'Eiskalt', description: 'Friere {n} Monster ein.', stat: 'monstersFrozen', tiers: [10, 60, 250] },
  { id: 'poliahu_favor', name: 'Poliʻahus Gunst', description: 'Besiege den Frostkoloss in der Gletscherlagune.', stat: 'bossColossus', tiers: [1] },
  { id: 'explorer', name: 'Weltenbummler', description: 'Erreiche Kapitel {n}.', stat: 'chapter', tiers: [2, 3] },
];
