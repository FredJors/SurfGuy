/**
 * Mathematisches Wellenfeld – CPU-Gegenstück zum Wasser-Shader (world/oceanShader.ts).
 * Beide MÜSSEN dieselbe Formel verwenden, damit Surfer und Perlen exakt auf dem Wasser liegen.
 *
 * Höhe = ruhige Grunddünung (Summe von Sinuswellen) + Wellen aus Sets.
 * Eine Set-Welle ist ein Kamm, der sich in Richtung `dir` bewegt:
 *   s = Abstand vor dem Kamm (in Laufrichtung), l = seitlicher Abstand entlang des Kamms
 *   Profil = exp(-(s/b)²) mit b = frontWidth (vorne, steil) bzw. backWidth (hinten, flach)
 */
import { smoothstep } from '../core/math';

export interface SwellComponent {
  amp: number;
  k: number;
  omega: number;
  phase: number;
  dirX: number;
  dirZ: number;
}

export interface Wave {
  readonly id: number;
  readonly setId: number;
  readonly indexInSet: number;
  readonly isLast: boolean;
  /** Startpunkt des Kamms */
  readonly originX: number;
  readonly originZ: number;
  /** Laufrichtung (normalisiert) */
  readonly dirX: number;
  readonly dirZ: number;
  readonly speed: number;
  /** Maximale Höhe (m) */
  readonly amplitude: number;
  readonly frontWidth: number;
  readonly backWidth: number;
  readonly halfLength: number;
  readonly travelDistance: number;
  readonly growPortion: number;
  readonly fadePortion: number;
  /** Bisher zurückgelegte Strecke (m) */
  travelled: number;
  /** Aktuelle Kamm-Position */
  crestX: number;
  crestZ: number;
  /** Aktueller Hüllkurven-Faktor 0..1 (Anschwellen/Auslaufen) */
  envelope: number;
}

export const SWELL_PHASES = [0, 1.3, 2.1, 4.0, 5.2, 0.7];

export function makeSwell(config: readonly (readonly [number, number, number, number])[]): SwellComponent[] {
  return config.map(([amp, wavelength, dirDeg, speed], i) => {
    const k = (Math.PI * 2) / wavelength;
    const rad = (dirDeg * Math.PI) / 180;
    return { amp, k, omega: k * speed, phase: SWELL_PHASES[i % SWELL_PHASES.length]!, dirX: Math.sin(rad), dirZ: -Math.cos(rad) };
  });
}

export interface WaveLocal {
  /** Abstand vor dem Kamm in Laufrichtung (m), + = vor dem Kamm (Richtung Insel) */
  s: number;
  /** Seitlicher Abstand entlang des Kamms (m) */
  l: number;
}

export class WaveField {
  time = 0;
  readonly waves: Wave[] = [];

  constructor(
    readonly swell: SwellComponent[],
    /** Wellen laufen an der Riffgrenze aus: Insel-Mittelpunkt und Ausblend-Radien */
    readonly islandX: number,
    readonly islandZ: number,
    readonly fadeInner: number,
    readonly fadeOuter: number,
  ) {}

  /** Wellen werden zur Insel hin flacher (Riff). */
  islandFade(x: number, z: number): number {
    const d = Math.hypot(x - this.islandX, z - this.islandZ);
    return smoothstep(this.fadeInner, this.fadeOuter, d);
  }

  swellHeight(x: number, z: number): number {
    let h = 0;
    for (const c of this.swell) h += c.amp * Math.sin((c.dirX * x + c.dirZ * z) * c.k - this.time * c.omega + c.phase);
    return h;
  }

  local(w: Wave, x: number, z: number, out: WaveLocal = { s: 0, l: 0 }): WaveLocal {
    const dx = x - w.crestX;
    const dz = z - w.crestZ;
    out.s = dx * w.dirX + dz * w.dirZ;
    out.l = -dx * w.dirZ + dz * w.dirX;
    return out;
  }

  /** Profil 0..1 einer Welle an lokaler Position (ohne Höhe). */
  profile(w: Wave, s: number, l: number): number {
    const b = s > 0 ? w.frontWidth : w.backWidth;
    const q = s / b;
    const lateral = 1 - smoothstep(w.halfLength * 0.7, w.halfLength, Math.abs(l));
    return Math.exp(-q * q) * lateral;
  }

  /** Aktuelle Höhe einer einzelnen Welle (inkl. Hüllkurve, ohne Insel-Ausblendung). */
  currentAmplitude(w: Wave): number {
    return w.amplitude * w.envelope;
  }

  /** Höhenbeitrag einer Welle an (x, z). */
  waveHeightAt(w: Wave, x: number, z: number): number {
    const loc = this.local(w, x, z, tmpLocal);
    return this.currentAmplitude(w) * this.profile(w, loc.s, loc.l) * this.islandFade(x, z);
  }

  heightAt(x: number, z: number): number {
    let h = this.swellHeight(x, z);
    if (this.waves.length === 0) return h;
    const fade = this.islandFade(x, z);
    if (fade <= 0) return h;
    for (const w of this.waves) {
      const amp = this.currentAmplitude(w);
      if (amp <= 0.001) continue;
      const loc = this.local(w, x, z, tmpLocal);
      h += amp * this.profile(w, loc.s, loc.l) * fade;
    }
    return h;
  }

  /** Oberflächennormale per Differenzenquotient. */
  normalAt(x: number, z: number, out: { x: number; y: number; z: number } = { x: 0, y: 1, z: 0 }, e = 0.5) {
    const h = this.heightAt(x, z);
    const hx = this.heightAt(x + e, z);
    const hz = this.heightAt(x, z + e);
    const nx = h - hx;
    const ny = e;
    const nz = h - hz;
    const len = Math.hypot(nx, ny, nz);
    out.x = nx / len;
    out.y = ny / len;
    out.z = nz / len;
    return out;
  }

  /** Bewegt alle Wellen weiter und entfernt ausgelaufene. Gibt entfernte Wellen zurück. */
  advance(dt: number): Wave[] {
    this.time += dt;
    const removed: Wave[] = [];
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]!;
      w.travelled += w.speed * dt;
      w.crestX = w.originX + w.dirX * w.travelled;
      w.crestZ = w.originZ + w.dirZ * w.travelled;
      const t = w.travelled / w.travelDistance;
      w.envelope = smoothstep(0, w.growPortion, t) * (1 - smoothstep(1 - w.fadePortion, 1, t));
      if (t >= 1) {
        this.waves.splice(i, 1);
        removed.push(w);
      }
    }
    return removed;
  }
}

const tmpLocal: WaveLocal = { s: 0, l: 0 };
