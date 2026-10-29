/**
 * Verhaltens-Register: verbindet `behavior` aus den Monster-Daten mit einer Implementierung.
 * Neues Monster mit vorhandenem Verhalten = nur Dateneintrag in data/monsters.ts.
 * Neues Verhalten = neue Klasse (erbt von Monster) + Eintrag hier.
 */
import { Clam } from './Clam';
import { Crab } from './Crab';
import { Jelly } from './Jelly';
import { Kraken } from './Kraken';
import type { Monster, MonsterSpawnArgs } from './Monster';
import { Serpent } from './Serpent';
import { Shark } from './Shark';
import { Whale } from './Whale';

export const MONSTER_BEHAVIORS: Record<string, (args: MonsterSpawnArgs) => Monster> = {
  kraken: (args) => new Kraken(args),
  shark: (args) => new Shark(args),
  jelly: (args) => new Jelly(args),
  crab: (args) => new Crab(args),
  serpent: (args) => new Serpent(args),
  whale: (args) => new Whale(args),
  clam: (args) => new Clam(args),
};
