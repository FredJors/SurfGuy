/** Zustand eines einzelnen Runs (wird bei jedem Start neu angelegt). */
export interface RunState {
  seed: number;
  score: number;
  pearls: number;
  /** Angesammelte Perlen-Bruchteile (durch Perlen-Bonus) */
  pearlRemainder: number;
  xp: number;
  hearts: number;
  maxHearts: number;
  invulnerable: number;
  /** Verbleibende Zeit des Blasenschilds (s), 0 = kein Schild */
  shield: number;
  combo: number;
  comboTimer: number;
  bestCombo: number;
  monstersDefeated: number;
  tricksLanded: number;
  wavesRidden: number;
  elapsed: number;
  zoneId: string;
  /** Perlenkette: Perlen kurz hintereinander */
  pearlChain: number;
  /** Summe der Perlen-Werte in der laufenden Kette */
  pearlChainValue: number;
  pearlChainTimer: number;
  bestPearlChain: number;
  /** Laufende Power-ups: id → Restzeit (s) */
  powerups: Record<string, number>;
  /** Durchstoß-Kette */
  punchChain: number;
  punchTimer: number;
  /** Gerade im Windschatten von Delfinen */
  dolphinRide: boolean;
  /** Eingesammelte Truhen (werden nach dem Run geöffnet) */
  chests: number;
  /** Der Wächter der Insel ist in diesem Run schon aufgetaucht */
  bossSpawned: boolean;
  /** Tutorial: Treffer werfen um, kosten aber kein Herz */
  noHeartLoss: boolean;
}

export function createRunState(seed: number, maxHearts: number): RunState {
  return {
    seed,
    score: 0,
    pearls: 0,
    pearlRemainder: 0,
    xp: 0,
    hearts: maxHearts,
    maxHearts,
    invulnerable: 0,
    shield: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    monstersDefeated: 0,
    tricksLanded: 0,
    wavesRidden: 0,
    elapsed: 0,
    zoneId: '',
    pearlChain: 0,
    pearlChainValue: 0,
    pearlChainTimer: 0,
    bestPearlChain: 0,
    powerups: {},
    punchChain: 0,
    punchTimer: 0,
    dolphinRide: false,
    chests: 0,
    bossSpawned: false,
    noHeartLoss: false,
  };
}
