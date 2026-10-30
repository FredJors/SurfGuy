/** Register aller Platzhalter-Builder (id → Funktion, die ein Objekt aus Grundformen baut). */
import type * as THREE from 'three';
import { buildBoard } from './board';
import { buildPalm, buildPearl, buildRock, buildVolcano } from './environment';
import { buildCrab } from './crab';
import { buildDebris } from './debris';
import { buildDolphin } from './dolphin';
import { buildIceberg } from './iceberg';
import { buildPenguin } from './penguin';
import { buildJelly } from './jelly';
import { buildKrakenHead } from './kraken';
import { buildChest, buildPowerup } from './pickups';
import { buildClam, buildSerpent, buildWhale } from './seaMonsters';
import { buildShark } from './shark';
import { buildSurferFigure } from './surfer';
import { buildTitan } from './titan';
import { buildWreck } from './wreck';

export type PlaceholderParams = Record<string, unknown>;
export type PlaceholderBuilder = (params: PlaceholderParams) => THREE.Object3D;

export const PLACEHOLDERS: Record<string, PlaceholderBuilder> = {
  surfer: (p) => buildSurferFigure(p),
  board: (p) => buildBoard(p),
  palm: (p) => buildPalm(p as { seed?: number }),
  rock: (p) => buildRock(p as { seed?: number; color?: string }),
  volcano: () => buildVolcano(),
  kraken: (p) => buildKrakenHead(p),
  shark: (p) => buildShark(p),
  jelly: (p) => buildJelly(p),
  serpent: (p) => buildSerpent(p),
  whale: (p) => buildWhale(p),
  clam: (p) => buildClam(p),
  titan: (p) => buildTitan(p as { colors?: { body: string; accent: string; eye: string } }),
  pearl: (p) => buildPearl(p as { gold?: boolean }),
  chest: () => buildChest(),
  powerup: (p) => buildPowerup(p as { colors?: Record<string, string> }),
  crab: (p) => buildCrab(p as { colors?: Record<string, string> }),
  debris: (p) => buildDebris(p as { length?: number; width?: number; seed?: number }),
  dolphin: (p) => buildDolphin(p as { colors?: Record<string, string> }),
  iceberg: (p) => buildIceberg(p as { length?: number; width?: number; seed?: number }),
  penguin: () => buildPenguin(),
  wreck: (p) => buildWreck(p as { length?: number; width?: number; seed?: number }),
};
