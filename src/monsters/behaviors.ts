/**
 * Verhaltens-Register: verbindet `behavior` aus den Monster-Daten mit einer Implementierung.
 * Neues Monster mit vorhandenem Verhalten = nur Dateneintrag in data/monsters.ts.
 * Neues Verhalten = neue Klasse (erbt von Monster) + Eintrag hier.
 */
import { Crab } from './Crab';
import { Jelly } from './Jelly';
import { Kraken } from './Kraken';
import type { Monster, MonsterSpawnArgs } from './Monster';
import { Shark } from './Shark';

export const MONSTER_BEHAVIORS: Record<string, (args: MonsterSpawnArgs) => Monster> = {
  kraken: (args) => new Kraken(args),
  shark: (args) => new Shark(args),
  jelly: (args) => new Jelly(args),
  crab: (args) => new Crab(args),
};
