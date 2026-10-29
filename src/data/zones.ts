/**
 * Zonen nach Entfernung zur Insel. Je näher an der Insel, desto mehr Monster.
 * Welche Stufe kommt, richtet sich nach dem Fortschritt im Bestiarium (nächste Stufe nach der
 * höchsten besiegten); `tierWeights` gilt nur, wenn kein Spielstand angebunden ist (Tests).
 * Zonen werden nach `maxDistance` aufsteigend geprüft; die letzte gilt für alles darüber hinaus.
 */
import type { ZoneDef } from './types';

export const ZONES: ZoneDef[] = [
  {
    id: 'inner',
    name: 'Vulkangewässer',
    maxDistance: 430,
    spawnInterval: [9, 16],
    maxMonsters: 2,
    tierWeights: { 1: 0.2, 2: 0.5, 3: 0.3 },
  },
  {
    id: 'middle',
    name: 'Strömung',
    maxDistance: 650,
    spawnInterval: [16, 26],
    maxMonsters: 1,
    tierWeights: { 1: 0.6, 2: 0.4 },
  },
  {
    id: 'outer',
    name: 'Offenes Meer',
    maxDistance: Infinity,
    spawnInterval: [22, 36],
    maxMonsters: 1,
    tierWeights: { 1: 1 },
  },
];
