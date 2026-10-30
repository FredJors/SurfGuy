/**
 * Asset-Manifest: Jedes Modell wird über eine id geladen.
 *
 * Liegt eine passende Datei in src/assets/models/ (z. B. `palm.glb`), wird sie automatisch
 * verwendet und in den Build eingebettet. Fehlt sie, baut das Spiel einen Platzhalter aus
 * Grundformen (assets/placeholders/). So läuft das Spiel immer, und Modelle lassen sich
 * einzeln austauschen. Lizenzen bitte in src/assets/CREDITS.md eintragen.
 */
import type { JointId } from '../data/types';

export interface AssetEntry {
  readonly id: string;
  /** Dateiname in src/assets/models/ */
  readonly file: string;
  /** Platzhalter-Builder (assets/placeholders/index.ts) */
  readonly placeholder: string;
  /** Anpassung des echten Modells an die Spielwelt */
  readonly transform?: {
    readonly scale?: number;
    /** Drehung um die Hochachse in Grad (Modelle sollen nach +Z schauen) */
    readonly rotationY?: number;
    readonly offset?: readonly [number, number, number];
  };
  /** Für animierbare Figuren: Zuordnung Spiel-Gelenk → Knochenname im glTF */
  readonly boneMap?: Partial<Record<JointId, string>>;
}

export const ASSET_MANIFEST: readonly AssetEntry[] = [
  {
    id: 'surfer',
    file: 'surfer.glb',
    placeholder: 'surfer',
    transform: { scale: 1, rotationY: 0 },
    // Passend für Quaternius-Figuren (Universal Base Characters). Bei anderen Modellen anpassen.
    boneMap: {
      hips: 'Hips',
      spine: 'Spine',
      head: 'Head',
      armL: 'UpperArm.L',
      forearmL: 'LowerArm.L',
      armR: 'UpperArm.R',
      forearmR: 'LowerArm.R',
      legL: 'UpperLeg.L',
      shinL: 'LowerLeg.L',
      legR: 'UpperLeg.R',
      shinR: 'LowerLeg.R',
    },
  },
  { id: 'board', file: 'board.glb', placeholder: 'board', transform: { scale: 1 } },
  { id: 'palm', file: 'palm.glb', placeholder: 'palm', transform: { scale: 1 } },
  { id: 'rock', file: 'rock.glb', placeholder: 'rock', transform: { scale: 1 } },
  { id: 'volcano', file: 'volcano.glb', placeholder: 'volcano', transform: { scale: 1 } },
  { id: 'kraken', file: 'kraken.glb', placeholder: 'kraken', transform: { scale: 1 } },
  { id: 'shark', file: 'shark.glb', placeholder: 'shark', transform: { scale: 1 } },
  { id: 'jelly', file: 'jelly.glb', placeholder: 'jelly', transform: { scale: 1 } },
  { id: 'pearl', file: 'pearl.glb', placeholder: 'pearl', transform: { scale: 1 } },
  { id: 'chest', file: 'chest.glb', placeholder: 'chest', transform: { scale: 1 } },
  { id: 'powerup', file: 'powerup.glb', placeholder: 'powerup', transform: { scale: 1 } },
  { id: 'crab', file: 'crab.glb', placeholder: 'crab', transform: { scale: 1 } },
  { id: 'serpent', file: 'serpent.glb', placeholder: 'serpent', transform: { scale: 1 } },
  { id: 'whale', file: 'whale.glb', placeholder: 'whale', transform: { scale: 1 } },
  { id: 'clam', file: 'clam.glb', placeholder: 'clam', transform: { scale: 1 } },
  // Lava-Titan (Endgegner Kapitel 2): Ursprung = Lavaoberfläche, Unterleib im See
  { id: 'titan', file: 'titan.glb', placeholder: 'titan', transform: { scale: 1 } },
  // Vulkan-Trümmer-Rampe (Kapitel 2): gleiche Achsen wie das Wrack
  { id: 'debris', file: 'debris.glb', placeholder: 'debris', transform: { scale: 1 } },
  { id: 'dolphin', file: 'dolphin.glb', placeholder: 'dolphin', transform: { scale: 1 } },
  // Monster des Eismeers (Kapitel 3), schauen nach +Z; Eisbär: Ursprung = Fußsohlen
  { id: 'polar_bear', file: 'polar_bear.glb', placeholder: 'polar_bear', transform: { scale: 1 } },
  { id: 'leopard_seal', file: 'leopard_seal.glb', placeholder: 'leopard_seal', transform: { scale: 1 } },
  { id: 'narwhal', file: 'narwhal.glb', placeholder: 'narwhal', transform: { scale: 1 } },
  // Eisberg-Rampe (Kapitel 3): gleiche Achsen wie das Wrack
  { id: 'iceberg', file: 'iceberg.glb', placeholder: 'iceberg', transform: { scale: 1 } },
  // Pinguin (Kapitel 3, statt Delfin): schaut nach +Z, liegt waagrecht wie beim Tauchen
  { id: 'penguin', file: 'penguin.glb', placeholder: 'penguin', transform: { scale: 1 } },
  // Wrack: Heck-Kante des Decks im Ursprung, Bug nach +Z, Deck bei y = 0 (wird von der Welt gekippt)
  { id: 'wreck', file: 'wreck.glb', placeholder: 'wreck', transform: { scale: 1 } },
];
