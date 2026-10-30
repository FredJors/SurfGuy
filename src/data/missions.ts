/**
 * Tagesaufgaben. Jeden Tag werden drei gezogen (leicht, mittel, schwer – das Datum ist der
 * Zufalls-Startwert, siehe player/Goals.ts). Neue Aufgabe = neuer Eintrag.
 */
import type { MissionDef } from './types';

export const MISSIONS: MissionDef[] = [
  { id: 'pearls', text: 'Sammle {n} Perlen', counter: 'pearls', mode: 'sum', goals: [100, 300, 700] },
  { id: 'pearls_run', text: 'Sammle {n} Perlen in einem Run', counter: 'pearls', mode: 'best', goals: [60, 150, 300] },
  { id: 'monsters', text: 'Besiege {n} Monster', counter: 'monsters', mode: 'sum', goals: [3, 8, 15] },
  { id: 'kraken', text: 'Besiege {n} Kraken', textOne: 'Besiege einen Kraken', counter: 'monsters', mode: 'sum', goals: [1, 3, 6], filter: { monsterId: 'kraken' }, chapter: 1 },
  { id: 'shark', text: 'Besiege {n} Riffhaie', textOne: 'Besiege einen Riffhai', counter: 'monsters', mode: 'sum', goals: [1, 3, 5], filter: { monsterId: 'shark' }, chapter: 1 },
  { id: 'jelly', text: 'Besiege {n} Riesenquallen', textOne: 'Besiege eine Riesenqualle', counter: 'monsters', mode: 'sum', goals: [1, 3, 5], filter: { monsterId: 'jelly' }, chapter: 1 },
  { id: 'serpent', text: 'Besiege {n} Seeschlangen', textOne: 'Besiege eine Seeschlange', counter: 'monsters', mode: 'sum', goals: [1, 3, 5], filter: { monsterId: 'serpent' }, chapter: 2 },
  { id: 'whale', text: 'Besiege {n} Buckelwale', textOne: 'Besiege einen Buckelwal', counter: 'monsters', mode: 'sum', goals: [1, 2, 4], filter: { monsterId: 'whale' }, chapter: 2 },
  { id: 'clam', text: 'Besiege {n} Riesenmuscheln', textOne: 'Besiege eine Riesenmuschel', counter: 'monsters', mode: 'sum', goals: [1, 3, 5], filter: { monsterId: 'clam' }, chapter: 2 },
  { id: 'polar_bear', text: 'Besiege {n} Eisbären', textOne: 'Besiege einen Eisbären', counter: 'monsters', mode: 'sum', goals: [1, 3, 5], filter: { monsterId: 'polar_bear' }, chapter: 3 },
  { id: 'leopard_seal', text: 'Besiege {n} Seeleoparden', textOne: 'Besiege einen Seeleoparden', counter: 'monsters', mode: 'sum', goals: [1, 3, 5], filter: { monsterId: 'leopard_seal' }, chapter: 3 },
  { id: 'narwhal', text: 'Besiege {n} Narwale', textOne: 'Besiege einen Narwal', counter: 'monsters', mode: 'sum', goals: [1, 2, 4], filter: { monsterId: 'narwhal' }, chapter: 3 },
  { id: 'tricks', text: 'Lande {n} Tricks', counter: 'tricks', mode: 'sum', goals: [5, 15, 35] },
  { id: 'perfect', text: 'Zeichne {n}× „Perfekt!“', counter: 'perfectTricks', mode: 'sum', goals: [2, 6, 15] },
  { id: 'salto', text: 'Lande {n} Saltos', counter: 'tricks', mode: 'sum', goals: [3, 8, 15], filter: { trickId: 'salto' } },
  { id: 'spin', text: 'Lande {n} Board-Wirbel', counter: 'tricks', mode: 'sum', goals: [3, 8, 15], filter: { trickId: 'board_spin' } },
  { id: 'fire_wheel', text: 'Lande {n} Feuerräder', counter: 'tricks', mode: 'sum', goals: [2, 6, 12], filter: { trickId: 'fire_wheel' }, chapter: 2 },
  { id: 'frost_nova', text: 'Lande {n} Frostnovas', counter: 'tricks', mode: 'sum', goals: [2, 5, 10], filter: { trickId: 'frost_nova' }, chapter: 3 },
  { id: 'ice_heart', text: 'Lande {n} Eisherzen', counter: 'tricks', mode: 'sum', goals: [0, 3, 8], filter: { trickId: 'ice_heart' }, chapter: 3 },
  { id: 'freeze', text: 'Friere {n} Monster ein', textOne: 'Friere ein Monster ein', counter: 'frozen', mode: 'sum', goals: [1, 3, 6], chapter: 3 },
  { id: 'combo', text: 'Schaffe eine Luft-Kombo ×{n}', counter: 'airCombo', mode: 'best', goals: [0, 2, 3] },
  { id: 'waves', text: 'Erwische {n} Wellen', counter: 'waves', mode: 'sum', goals: [3, 10, 25] },
  { id: 'ramps', text: 'Springe {n}× von einer Rampe', counter: 'rampJumps', mode: 'sum', goals: [2, 6, 12] },
  { id: 'geysers', text: 'Lass dich {n}× von einem Geysir schleudern', counter: 'geyserJumps', mode: 'sum', goals: [1, 3, 6] },
  { id: 'punch', text: 'Schaffe {n} Wellen-Durchstöße', textOne: 'Schaffe einen Wellen-Durchstoß', counter: 'punches', mode: 'sum', goals: [1, 4, 8] },
  { id: 'dolphins', text: 'Reite {n}× mit Delfinen', counter: 'dolphinRides', mode: 'sum', goals: [1, 2, 4], chapter: [1, 2] },
  { id: 'penguins', text: 'Häng dich {n}× an Pinguine', counter: 'dolphinRides', mode: 'sum', goals: [1, 2, 4], chapter: 3 },
  { id: 'score', text: 'Erreiche {n} Punkte in einem Run', counter: 'score', mode: 'best', goals: [2000, 6000, 15000] },
  { id: 'airtime', text: 'Bleib {n} Sekunden am Stück in der Luft', counter: 'airtime', mode: 'best', goals: [2, 3, 4.5] },
  { id: 'weakness', text: 'Triff {n}× eine Schwachstelle', counter: 'weaknessHits', mode: 'sum', goals: [2, 6, 15] },
  { id: 'chests', text: 'Sammle {n} Schatzkisten', textOne: 'Sammle eine Schatzkiste', counter: 'chests', mode: 'sum', goals: [1, 3, 6] },
];
