/**
 * Zeichenbare Symbole. Mehrere Vorlagen je Symbol (Richtung, Startpunkt, Form)
 * machen die Erkennung robuster.
 *
 * Neues Symbol: Eintrag ergänzen. Eigene Striche lassen sich im Spiel mit `?debug`
 * aufzeichnen – der letzte Strich wird dann als JSON in der Konsole ausgegeben.
 */
import { circle, lightning, spiral, zigzag } from '../tricks/recognizer/shapes';
import type { SymbolDef } from './types';

export const SYMBOLS: SymbolDef[] = [
  {
    id: 'circle',
    name: 'Kreis',
    templates: [
      circle(true, -90),
      circle(false, -90),
      circle(true, 0),
      circle(false, 180),
      circle(true, 90),
      circle(false, 90),
      // leicht überzeichnete Kreise
      circle(true, -90, 52, 1.12),
      circle(false, -90, 52, 1.12),
    ],
    preview: circle(true, -90),
  },
  {
    id: 'spiral',
    name: 'Spirale',
    // Richtung (im/gegen Uhrzeigersinn) × innen/außen beginnend × 1,5–3 Umdrehungen
    templates: [true, false].flatMap((cw) =>
      [true, false].flatMap((inward) => [1.6, 2.1, 2.6, 3.1].map((turns) => spiral(cw, inward, turns))),
    ),
    preview: spiral(true, true),
  },
  {
    id: 'zigzag',
    name: 'Zickzack',
    // 3–7 Linien, beide Spiegelungen; dazu der klassische Blitz
    templates: [
      ...[1.5, 2, 2.5, 3, 3.5].flatMap((peaks) => [zigzag(peaks, true, true), zigzag(peaks, true, false)]),
      lightning(false),
      lightning(true),
    ],
    preview: lightning(false),
  },
];
