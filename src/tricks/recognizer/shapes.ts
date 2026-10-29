/**
 * Generatoren für Symbol-Vorlagen. Koordinaten wie auf dem Bildschirm (y nach unten),
 * Größe ca. 0..100. Werden in data/symbols.ts zu Vorlagen zusammengestellt.
 */
import type { Point2 } from '../../data/types';

const TAU = Math.PI * 2;

/** Kreis. `clockwise` bezieht sich auf die Bildschirmansicht. */
export function circle(clockwise: boolean, startDeg = -90, n = 48, turns = 1): Point2[] {
  const pts: Point2[] = [];
  const dir = clockwise ? 1 : -1;
  const start = (startDeg * Math.PI) / 180;
  for (let i = 0; i <= n; i++) {
    const a = start + dir * (i / n) * TAU * turns;
    pts.push({ x: 50 + 50 * Math.cos(a), y: 50 + 50 * Math.sin(a) });
  }
  return pts;
}

/** Spirale mit `turns` Umdrehungen, von außen nach innen (oder umgekehrt). */
export function spiral(clockwise: boolean, inward: boolean, turns = 2.25, startDeg = -90, n = 96): Point2[] {
  const pts: Point2[] = [];
  const dir = clockwise ? 1 : -1;
  const start = (startDeg * Math.PI) / 180;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = inward ? 50 * (1 - 0.88 * t) : 50 * (0.12 + 0.88 * t);
    const a = start + dir * t * TAU * turns;
    pts.push({ x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) });
  }
  return pts;
}

/** Polyline aus Eckpunkten, fein unterteilt. */
export function polyline(corners: readonly (readonly [number, number])[], perSegment = 12): Point2[] {
  const pts: Point2[] = [];
  for (let i = 0; i < corners.length - 1; i++) {
    const [ax, ay] = corners[i]!;
    const [bx, by] = corners[i + 1]!;
    for (let k = 0; k < perSegment; k++) {
      const t = k / perSegment;
      pts.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t });
    }
  }
  const [lx, ly] = corners[corners.length - 1]!;
  pts.push({ x: lx, y: ly });
  return pts;
}

/** Waagrechter Zickzack mit `peaks` Spitzen, links → rechts (oder umgekehrt). */
export function zigzag(peaks: number, leftToRight = true, startUp = true): Point2[] {
  const corners: [number, number][] = [];
  const segs = Math.round(peaks * 2);
  for (let i = 0; i <= segs; i++) {
    const x = (i / segs) * 100;
    const up = i % 2 === 0 ? startUp : !startUp;
    corners.push([leftToRight ? x : 100 - x, up ? 20 : 80]);
  }
  return polyline(corners);
}

/** Blitz von oben nach unten: rechts oben → links Mitte → rechts Mitte → links unten. */
export function lightning(mirrored = false): Point2[] {
  const c: [number, number][] = [
    [70, 0],
    [25, 48],
    [75, 52],
    [30, 100],
  ];
  return polyline(mirrored ? c.map(([x, y]) => [100 - x, y] as [number, number]) : c);
}

/** Geschlossenes Dreieck (Spitze oben), Start an Ecke `start` (0 = Spitze, 1/2 = unten). */
export function triangle(clockwise: boolean, start = 0): Point2[] {
  // im Uhrzeigersinn auf dem Bildschirm: Spitze → unten rechts → unten links
  const v: [number, number][] = [
    [50, 4],
    [96, 92],
    [4, 92],
  ];
  const order = clockwise ? [0, 1, 2] : [0, 2, 1];
  const corners = [0, 1, 2, 3].map((i) => v[order[(start + i) % 3]!]!);
  return polyline(corners, 16);
}

/** Geschlossenes Quadrat, Start an Ecke `start` (0 = oben links, im Uhrzeigersinn weiter). */
export function square(clockwise: boolean, start = 0): Point2[] {
  const v: [number, number][] = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ];
  const order = clockwise ? [0, 1, 2, 3] : [0, 3, 2, 1];
  const corners = [0, 1, 2, 3, 4].map((i) => v[order[(start + i) % 4]!]!);
  return polyline(corners, 14);
}

/** „V“: von oben links nach unten zur Spitze und wieder hoch (oder gespiegelt). */
export function vee(leftToRight = true, width = 100): Point2[] {
  const m = (100 - width) / 2;
  const c: [number, number][] = [
    [m, 0],
    [50, 100],
    [100 - m, 0],
  ];
  return polyline(leftToRight ? c : c.reverse(), 18);
}
