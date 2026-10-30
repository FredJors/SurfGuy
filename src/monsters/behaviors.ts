/**
 * Verhaltens-Register: verbindet `behavior` aus den Monster-Daten mit einer Implementierung.
 * Neues Monster mit vorhandenem Verhalten = nur Dateneintrag in data/monsters.ts.
 * Neues Verhalten = neue Klasse (erbt von Monster) + Eintrag hier.
 */
import { Clam } from './Clam';
import { Crab } from './Crab';
import { Jelly } from './Jelly';
import { Kraken } from './Kraken';
import { LeopardSeal } from './LeopardSeal';
import type { Monster, MonsterSpawnArgs } from './Monster';
import { Narwhal } from './Narwhal';
import { PolarBear } from './PolarBear';
import { Serpent } from './Serpent';
import { Shark } from './Shark';
import { Titan } from './Titan';
import { Whale } from './Whale';

export const MONSTER_BEHAVIORS: Record<string, (args: MonsterSpawnArgs) => Monster> = {
  kraken: (args) => new Kraken(args),
  shark: (args) => new Shark(args),
  jelly: (args) => new Jelly(args),
  crab: (args) => new Crab(args),
  serpent: (args) => new Serpent(args),
  whale: (args) => new Whale(args),
  clam: (args) => new Clam(args),
  titan: (args) => new Titan(args),
  bear: (args) => new PolarBear(args),
  seal: (args) => new LeopardSeal(args),
  narwhal: (args) => new Narwhal(args),
};
