/**
 * Verhaltens-Register: verbindet `behavior` aus den Monster-Daten mit einer Implementierung.
 * Neues Monster mit vorhandenem Verhalten = nur Dateneintrag in data/monsters.ts.
 * Neues Verhalten = neue Klasse (erbt von Monster) + Eintrag hier.
 */
import { Kraken } from './Kraken';
import type { Monster, MonsterSpawnArgs } from './Monster';

export const MONSTER_BEHAVIORS: Record<string, (args: MonsterSpawnArgs) => Monster> = {
  kraken: (args) => new Kraken(args),
};
