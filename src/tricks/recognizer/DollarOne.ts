/**
 * $1 Unistroke Recognizer (Wobbrock, Wilson & Li, 2007) – offline, ohne KI-Modell.
 * Liefert das erkannte Symbol und eine Genauigkeit von 0 bis 1.
 */
export interface Pt {
  x: number;
  y: number;
}

export interface RecognizerTemplate {
  readonly symbolId: string;
  readonly points: Pt[];
}

export interface RecognitionResult {
  /** null, wenn der Strich zu kurz/klein ist */
  readonly symbolId: string | null;
  /** 0..1 (1 = perfekte Übereinstimmung) */
  readonly score: number;
  /** Bester Treffer je Symbol (absteigend sortiert), z. B. für Debug-Anzeigen */
  readonly ranking: readonly { symbolId: string; score: number }[];
}

const NUM_POINTS = 64;
const SQUARE_SIZE = 250;
const HALF_DIAGONAL = 0.5 * Math.sqrt(SQUARE_SIZE * SQUARE_SIZE * 2);
const ANGLE_RANGE = (45 * Math.PI) / 180;
const ANGLE_PRECISION = (2 * Math.PI) / 180;
const PHI = 0.5 * (-1 + Math.sqrt(5));

export interface DollarOneOptions {
  /** Mindestlänge des Strichs in Pixeln */
  minPathLength?: number;
  /** Mindestgröße (Diagonale der Bounding-Box) in Pixeln */
  minSize?: number;
  /** Striche, die schmaler als dieses Seitenverhältnis sind, gelten als Linie (nicht erkannt) */
  minAspect?: number;
  /** Volle Drehinvarianz (360°) statt nur ±45° um den Startwinkel */
  rotationInvariant?: boolean;
}

export class DollarOneRecognizer {
  private readonly templates: RecognizerTemplate[] = [];
  private readonly minPathLength: number;
  private readonly minSize: number;
  private readonly minAspect: number;
  private readonly rotationInvariant: boolean;

  constructor(options: DollarOneOptions = {}) {
    this.minPathLength = options.minPathLength ?? 40;
    this.minSize = options.minSize ?? 24;
    this.minAspect = options.minAspect ?? 0.2;
    this.rotationInvariant = options.rotationInvariant ?? true;
  }

  addTemplate(symbolId: string, stroke: readonly Pt[]): void {
    if (stroke.length < 2) throw new Error(`[DollarOne] Vorlage "${symbolId}" hat zu wenige Punkte`);
    this.templates.push({ symbolId, points: normalize(stroke) });
  }

  get templateCount(): number {
    return this.templates.length;
  }

  recognize(stroke: readonly Pt[]): RecognitionResult {
    if (stroke.length < 5 || pathLength(stroke) < this.minPathLength) {
      return { symbolId: null, score: 0, ranking: [] };
    }
    const box = boundingBox(stroke);
    if (Math.hypot(box.w, box.h) < this.minSize) return { symbolId: null, score: 0, ranking: [] };
    if (Math.min(box.w, box.h) / Math.max(box.w, box.h) < this.minAspect) {
      return { symbolId: null, score: 0, ranking: [] };
    }

    const candidate = normalize(stroke);
    const best = new Map<string, number>();
    for (const t of this.templates) {
      const d = this.rotationInvariant
        ? distanceAnyAngle(candidate, t.points)
        : distanceAtBestAngle(candidate, t.points, -ANGLE_RANGE, ANGLE_RANGE, ANGLE_PRECISION);
      const score = Math.max(0, 1 - d / HALF_DIAGONAL);
      if (score > (best.get(t.symbolId) ?? -1)) best.set(t.symbolId, score);
    }
    const ranking = [...best.entries()]
      .map(([symbolId, score]) => ({ symbolId, score }))
      .sort((a, b) => b.score - a.score);
    const top = ranking[0];
    return { symbolId: top?.symbolId ?? null, score: top?.score ?? 0, ranking };
  }
}

// --- $1-Schritte --------------------------------------------------------------

export function normalize(stroke: readonly Pt[]): Pt[] {
  let pts = resample(stroke, NUM_POINTS);
  pts = rotateBy(pts, -indicativeAngle(pts));
  pts = scaleTo(pts, SQUARE_SIZE);
  return translateTo(pts, { x: 0, y: 0 });
}

export function resample(stroke: readonly Pt[], n: number): Pt[] {
  const interval = pathLength(stroke) / (n - 1);
  const pts = stroke.map((p) => ({ x: p.x, y: p.y }));
  const out: Pt[] = [{ ...pts[0]! }];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + d >= interval && d > 0) {
      const t = (interval - acc) / d;
      const q = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
      out.push(q);
      pts.splice(i, 0, q);
      acc = 0;
    } else {
      acc += d;
    }
  }
  while (out.length < n) out.push({ ...pts[pts.length - 1]! });
  return out.slice(0, n);
}

function indicativeAngle(pts: readonly Pt[]): number {
  const c = centroid(pts);
  return Math.atan2(c.y - pts[0]!.y, c.x - pts[0]!.x);
}

function rotateBy(pts: readonly Pt[], angle: number): Pt[] {
  const c = centroid(pts);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return pts.map((p) => ({
    x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
    y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
  }));
}

function scaleTo(pts: readonly Pt[], size: number): Pt[] {
  const b = boundingBox(pts);
  // Sehr flache Striche nicht auf Quadrat zerren (Schutz gegen Division durch ~0).
  const w = Math.max(b.w, 1e-3, b.h * 0.15);
  const h = Math.max(b.h, 1e-3, b.w * 0.15);
  return pts.map((p) => ({ x: (p.x * size) / w, y: (p.y * size) / h }));
}

function translateTo(pts: readonly Pt[], to: Pt): Pt[] {
  const c = centroid(pts);
  return pts.map((p) => ({ x: p.x + to.x - c.x, y: p.y + to.y - c.y }));
}

/** Grobe Suche über 360° in 15°-Schritten, dann Feinsuche um das beste Ergebnis. */
function distanceAnyAngle(pts: readonly Pt[], tpl: readonly Pt[]): number {
  const step = (15 * Math.PI) / 180;
  let bestAngle = 0;
  let bestDist = Infinity;
  for (let a = -Math.PI; a < Math.PI; a += step) {
    const d = distanceAtAngle(pts, tpl, a);
    if (d < bestDist) {
      bestDist = d;
      bestAngle = a;
    }
  }
  return Math.min(bestDist, distanceAtBestAngle(pts, tpl, bestAngle - step, bestAngle + step, ANGLE_PRECISION));
}

function distanceAtBestAngle(pts: readonly Pt[], tpl: readonly Pt[], a: number, b: number, threshold: number): number {
  let x1 = PHI * a + (1 - PHI) * b;
  let f1 = distanceAtAngle(pts, tpl, x1);
  let x2 = (1 - PHI) * a + PHI * b;
  let f2 = distanceAtAngle(pts, tpl, x2);
  while (Math.abs(b - a) > threshold) {
    if (f1 < f2) {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = PHI * a + (1 - PHI) * b;
      f1 = distanceAtAngle(pts, tpl, x1);
    } else {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = (1 - PHI) * a + PHI * b;
      f2 = distanceAtAngle(pts, tpl, x2);
    }
  }
  return Math.min(f1, f2);
}

function distanceAtAngle(pts: readonly Pt[], tpl: readonly Pt[], angle: number): number {
  return pathDistance(rotateBy(pts, angle), tpl);
}

function pathDistance(a: readonly Pt[], b: readonly Pt[]): number {
  let d = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) d += Math.hypot(a[i]!.x - b[i]!.x, a[i]!.y - b[i]!.y);
  return d / n;
}

function centroid(pts: readonly Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

export function boundingBox(pts: readonly Pt[]): { x: number; y: number; w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function pathLength(pts: readonly Pt[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  return d;
}
