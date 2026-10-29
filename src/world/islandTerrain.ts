/**
 * Gelände der Vulkaninsel als Höhenfunktion (Inselmitte = Ursprung, Meter):
 * flacher Strand → hügeliges Tiefland → konkaver Vulkankegel mit Rinnen → Kraterrand → Krater.
 * Wird vom Modell (Platzhalter) und beim Platzieren von Palmen, Büschen und Felsen genutzt.
 */
import { CONFIG } from '../config/gameConfig';
import { fbm, noise2 } from '../core/noise';

const SEED = 41;

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Glattes Grundprofil (ohne Rauschen) über dem normierten Radius rn = r / Inselradius. */
function baseProfile(rn: number): number {
  const H = CONFIG.world.volcanoHeight;
  if (rn >= 1.06) return -0.5 - (rn - 1.06) * 40;
  if (rn >= 0.86) return 1.6 * (1 - smooth(0.86, 1.06, rn)) - 0.5 * smooth(0.98, 1.06, rn);
  if (rn >= 0.56) return 1.6 + (0.86 - rn) / 0.3 * 0.11 * H;
  if (rn >= 0.17) {
    const t = (rn - 0.17) / 0.39; // 0 am Kraterrand, 1 am Fuß
    return 0.11 * H + 1.6 + Math.pow(1 - t, 1.7) * (0.89 * H - 1.6);
  }
  // Krater: Rand bei 0.17, Mitte etwas tiefer
  return H * (0.9 + 0.1 * smooth(0.08, 0.17, rn));
}

/** Geländehöhe an (x, z) relativ zur Inselmitte. */
export function islandHeight(x: number, z: number): number {
  const R = CONFIG.world.islandRadius;
  const H = CONFIG.world.volcanoHeight;
  const r = Math.hypot(x, z);
  const rn = r / R;
  const a = Math.atan2(z, x);
  let h = baseProfile(rn);
  if (rn < 1.0) {
    // Rinnen und Grate am Vulkanhang (stärker in der Mitte des Hangs)
    const warp = fbm(a * 1.6, rn * 3, 3, SEED) * 1.4;
    const ridges = Math.pow(1 - Math.abs(Math.sin(a * 11 + warp)), 2);
    const slopeMask = smooth(0.14, 0.24, rn) * (1 - smooth(0.5, 0.66, rn));
    h += (ridges - 0.45) * 0.1 * H * slopeMask;
    // Hügel und Mulden im Tiefland
    const lowland = smooth(0.5, 0.6, rn) * (1 - smooth(0.8, 0.9, rn));
    h += fbm(x * 0.025, z * 0.025, 4, SEED + 3) * 9 * lowland;
    // feine Unebenheit überall außer am Strand
    h += fbm(x * 0.09, z * 0.09, 3, SEED + 5) * 1.6 * (1 - smooth(0.82, 0.9, rn));
    // unregelmäßiger Kraterrand
    h += (noise2(a * 3, 1.3, SEED + 9) - 0.5) * 0.05 * H * (1 - smooth(0.12, 0.24, rn)) * smooth(0.1, 0.16, rn);
  }
  return h;
}

export type IslandBiome = 'sand' | 'grass' | 'jungle' | 'rock' | 'ash' | 'crater' | 'seabed';

/** Was wächst/liegt an dieser Stelle? (slope = 1 - Normalen-Y, 0 = flach) */
export function islandBiome(x: number, z: number, h: number, slope: number): IslandBiome {
  const R = CONFIG.world.islandRadius;
  const H = CONFIG.world.volcanoHeight;
  const rn = Math.hypot(x, z) / R;
  if (h < -0.3) return 'seabed';
  if (rn < 0.15 && h < 0.97 * H) return 'crater';
  if (rn > 0.84 && h < 2.6) return 'sand';
  if (h > 0.52 * H) return 'ash';
  if (slope > 0.42 || h > 0.32 * H) return 'rock';
  const patch = fbm(x * 0.03, z * 0.03, 3, SEED + 21);
  return patch > 0.1 && rn > 0.5 ? 'jungle' : 'grass';
}
