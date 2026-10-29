/** Register aller Platzhalter-Builder (id → Funktion, die ein Objekt aus Grundformen baut). */
import type * as THREE from 'three';
import { buildBoard } from './board';
import { buildPalm, buildPearl, buildRock, buildVolcano } from './environment';
import { buildKrakenHead } from './kraken';
import { buildSurferFigure } from './surfer';

export type PlaceholderParams = Record<string, unknown>;
export type PlaceholderBuilder = (params: PlaceholderParams) => THREE.Object3D;

export const PLACEHOLDERS: Record<string, PlaceholderBuilder> = {
  surfer: (p) => buildSurferFigure(p),
  board: (p) => buildBoard(p),
  palm: (p) => buildPalm(p as { seed?: number }),
  rock: (p) => buildRock(p as { seed?: number; color?: string }),
  volcano: () => buildVolcano(),
  kraken: (p) => buildKrakenHead(p),
  pearl: () => buildPearl(),
};
