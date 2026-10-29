/**
 * Deterministisches 2D-Rauschen (Value Noise) und fraktales Rauschen (fBm) für natürliche
 * Formen: Gelände, Felsen, Muster. Gleicher Seed → gleiche Form.
 */

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Wertrauschen im Bereich 0..1. */
export function noise2(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = fade(xf);
  const v = fade(yf);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fraktales Rauschen (mehrere Oktaven) im Bereich ungefähr -1..1. */
export function fbm(x: number, y: number, octaves = 4, seed = 0): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += (noise2(x * freq, y * freq, seed + i * 17) * 2 - 1) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

/** 3D-Rauschen aus drei 2D-Ebenen (reicht für Fels-Verformung). */
export function noise3(x: number, y: number, z: number, seed = 0): number {
  return (noise2(x, y, seed) + noise2(y, z, seed + 7) + noise2(z, x, seed + 13)) / 3;
}
