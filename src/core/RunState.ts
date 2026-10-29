/** Zustand eines einzelnen Runs (wird bei jedem Start neu angelegt). */
export interface RunState {
  seed: number;
  score: number;
  pearls: number;
  xp: number;
  hearts: number;
  maxHearts: number;
  invulnerable: number;
  combo: number;
  comboTimer: number;
  bestCombo: number;
  monstersDefeated: number;
  tricksLanded: number;
  wavesRidden: number;
  elapsed: number;
  zoneId: string;
}

export function createRunState(seed: number, maxHearts: number): RunState {
  return {
    seed,
    score: 0,
    pearls: 0,
    xp: 0,
    hearts: maxHearts,
    maxHearts,
    invulnerable: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    monstersDefeated: 0,
    tricksLanded: 0,
    wavesRidden: 0,
    elapsed: 0,
    zoneId: '',
  };
}
