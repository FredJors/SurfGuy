/**
 * Alle Spielereignisse. UI, Punkte, Bestiarium (und später Sound) hängen sich
 * ausschließlich an diese Events.
 */
import type { TrickQuality } from '../data/types';
import type { EventBus } from './EventBus';

export interface XZ {
  x: number;
  z: number;
}

export type SurferStateId =
  | 'Lying'
  | 'Posing'
  | 'Paddling'
  | 'Standing'
  | 'Airborne'
  | 'Drawing'
  | 'TrickPerforming'
  | 'Landing'
  | 'Wipeout';

export interface RunSummary {
  score: number;
  pearls: number;
  xp: number;
  monstersDefeated: number;
  tricksLanded: number;
  bestCombo: number;
  wavesRidden: number;
  duration: number;
  newHighscore: boolean;
  previousHighscore: number;
  /** Truhen, die nach dem Run geöffnet werden */
  chests: number;
}

export interface GameEvents {
  // Ablauf
  runStarted: { seed: number };
  runEnded: { summary: RunSummary };
  surferStateChanged: { from: SurferStateId | null; to: SurferStateId };
  zoneChanged: { zoneId: string; name: string };
  boundaryPush: { active: boolean };

  // Wellen
  waveSetIncoming: { setId: number; waveCount: number; dirX: number; dirZ: number; big: boolean };
  waveSpawned: { waveId: number; setId: number; isLast: boolean };
  waveCaught: { waveId: number; height: number; boost: number };
  waveRideEnded: { waveId: number; duration: number; height: number };

  // Sprung & Tricks
  jump: { speed: number; airtime: number; onWave: boolean; position: XZ };
  drawingStarted: { duration: number };
  drawingEnded: { recognized: boolean };
  trickRecognized: { trickId: string; symbolId: string; accuracy: number; quality: TrickQuality };
  trickFailed: { reason: 'noStroke' | 'unknown' | 'timeout' | 'locked'; accuracy: number };
  /** Trick beendet (gelandet oder in der Luft fertig); chain = Nummer im aktuellen Sprung (Kombo) */
  trickLanded: { trickId: string; quality: TrickQuality; hits: number; chain: number };
  landed: { airtime: number; position: XZ; speed: number };
  comboChanged: { combo: number; multiplier: number };

  // Monster
  monsterWarning: { instanceId: number; monsterId: string; position: XZ };
  monsterSpawned: { instanceId: number; monsterId: string; tier: number };
  monsterHit: {
    instanceId: number;
    monsterId: string;
    partTag: string;
    damage: number;
    trickId: string;
    weakness: boolean;
    position: { x: number; y: number; z: number };
  };
  monsterPartDestroyed: { instanceId: number; monsterId: string; partTag: string };
  monsterDefeated: {
    instanceId: number;
    monsterId: string;
    tier: number;
    rewards: { pearls: number; xp: number; points: number };
    position: XZ;
  };
  monsterEscaped: { instanceId: number; monsterId: string; points: number };

  // Fähigkeiten
  abilityUsed: { abilityId: string; slot: number };
  shieldBroken: { position: XZ };

  // Spieler
  playerHit: { source: string; heartsLeft: number; position: XZ };
  pearlCollected: { value: number; position: { x: number; y: number; z: number } };
  /** Perlen kurz hintereinander = Perlenkette (Länge steigt); total = Perlen in der Kette */
  pearlChain: { count: number; bonus: number; total: number; position: { x: number; y: number; z: number } };
  scoreAdded: { points: number; reason: string; total: number; multiplier: number };

  // Welt: Rampen, Geysire, Delfine, Einsammeln
  /** Abheben ohne Sprungtaste bzw. mit Sonderschub */
  launched: { source: LaunchSource; airtime: number; position: XZ; power: number };
  wreckBonk: { position: XZ };
  pickupCollected: { pickupId: string; position: { x: number; y: number; z: number } };
  powerupChanged: { pickupId: string; active: boolean; duration: number };
  dolphinsSpotted: { position: XZ };
  dolphinRide: { active: boolean };
  geyserErupted: { position: XZ };

  // Endgegner
  bossEvent: { kind: 'awaken' | 'enrage' | 'throw' | 'impact' | 'stomp' | 'defeated'; position: XZ };
}

export type LaunchSource = 'ramp' | 'geyser' | 'punch' | 'drop';

export type GameEventBus = EventBus<GameEvents>;
