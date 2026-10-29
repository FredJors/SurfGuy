/**
 * Mathematisches Wellenfeld – CPU-Gegenstück zum Wasser-Shader (world/Ocean.ts).
 * Beide MÜSSEN dieselbe Formel verwenden, damit Surfer und Perlen exakt auf dem Wasser liegen.
 *
 * Höhe = ruhige Grunddünung (Summe von Sinuswellen) + einzelne Wellen.
 * Jede Welle ist ein Kreisbogen um die Insel, der nach innen rollt:
 *   r     = Abstand des Punkts zur Inselmitte
 *   s     = radius − r   (Abstand vor dem Kamm, + = Richtung Insel)
 *   l     = Winkelabstand zur Wellenmitte × radius (Bogenlänge entlang des Kamms)
 *   Höhe  = A · Hüllkurve · exp(−(s/b)²) · Ränder(l) · Muster(l, t)
 * b = frontWidth (vorne, steil) bzw. backWidth (hinten, flach). Das Muster lässt die Höhe
 * entlang des Kamms schwanken und die Spitzen seitlich wandern („dynamische“ Wellen).
 */
import { smoothstep, wrapAngle } from '../core/math';

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
  /** Startradius um die Insel (m) */
  readonly startRadius: number;
  /** Laufgeschwindigkeit Richtung Insel (m/s) */
  readonly speed: number;
  /** Maximale Höhe (m) */
  readonly amplitude: number;
  readonly frontWidth: number;
  readonly backWidth: number;
  /** Halbe Bogenlänge des Kamms (m) */
  readonly halfLength: number;
  /** Seitliche Wanderung der Wellenmitte (rad/s) */
  readonly angularDrift: number;
  readonly travelDistance: number;
  growPortion: number;
  readonly fadePortion: number;
  /** Höhenmuster entlang des Kamms: zwei Sinus-Anteile (Stärke, Wellenzahl rad/m, Phase, Wandertempo rad/s) */
  readonly pattern: readonly [PatternComponent, PatternComponent];
  /** Bisher zurückgelegte Strecke (m) */
  travelled: number;
  /** Aktueller Kammradius (m) */
  radius: number;
  /** Aktueller Winkel der Wellenmitte um die Insel (rad, atan2(z, x)) */
  angle: number;
  /** Aktueller Hüllkurven-Faktor 0..1 (Anschwellen/Auslaufen) */
  envelope: number;
  /** Aktuelle Phasen des Musters (für Shader und CPU identisch) */
  phase1: number;
  phase2: number;
}

export interface PatternComponent {
  readonly amount: number;
  readonly k: number;
  readonly phase: number;
  readonly speed: number;
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
  /** Abstand vor dem Kamm (m), + = vor dem Kamm (Richtung Insel) */
  s: number;
  /** Bogenlänge entlang des Kamms ab Wellenmitte (m) */
  l: number;
  /** Laufrichtung der Welle an diesem Punkt (zur Inselmitte, normalisiert) */
  dirX: number;
  dirZ: number;
}

/** Höhenmuster entlang des Kamms (≥ 0.25). Identisch im Shader. */
export function patternAt(w: Wave, l: number): number {
  const [a, b] = w.pattern;
  const m = 1 + a.amount * Math.sin(l * a.k + w.phase1) + b.amount * Math.sin(l * b.k + w.phase2);
  return Math.min(1.7, Math.max(0.25, m));
}

export class WaveField {
  time = 0;
  readonly waves: Wave[] = [];

  constructor(
    readonly swell: SwellComponent[],
    /** Inselmitte: Wellen laufen auf sie zu und an der Riffgrenze aus */
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

  local(w: Wave, x: number, z: number, out: WaveLocal = { s: 0, l: 0, dirX: 0, dirZ: 0 }): WaveLocal {
    const dx = x - this.islandX;
    const dz = z - this.islandZ;
    const r = Math.hypot(dx, dz) || 0.001;
    out.s = w.radius - r;
    out.l = wrapAngle(Math.atan2(dz, dx) - w.angle) * w.radius;
    out.dirX = -dx / r;
    out.dirZ = -dz / r;
    return out;
  }

  /** Seitliche Ränder des Kamms (0..1). */
  edge(w: Wave, l: number): number {
    return 1 - smoothstep(w.halfLength * 0.55, w.halfLength, Math.abs(l));
  }

  /** Querprofil 0..1 (ohne Ränder und Muster). */
  profile(w: Wave, s: number): number {
    const b = s > 0 ? w.frontWidth : w.backWidth;
    const q = s / b;
    return Math.exp(-q * q);
  }

  /** Aktuelle Grundhöhe einer Welle (inkl. Hüllkurve, ohne Insel-Ausblendung). */
  currentAmplitude(w: Wave): number {
    return w.amplitude * w.envelope;
  }

  /** Höhe des Kamms an Bogenposition l (mit Rändern und Muster, ohne Insel-Ausblendung). */
  crestHeight(w: Wave, l: number): number {
    return this.currentAmplitude(w) * this.edge(w, l) * patternAt(w, l);
  }

  /** Höhenbeitrag einer Welle an (x, z). */
  waveHeightAt(w: Wave, x: number, z: number): number {
    const loc = this.local(w, x, z, tmpLocal);
    return this.crestHeight(w, loc.l) * this.profile(w, loc.s) * this.islandFade(x, z);
  }

  heightAt(x: number, z: number): number {
    let h = this.swellHeight(x, z);
    if (this.waves.length === 0) return h;
    const fade = this.islandFade(x, z);
    if (fade <= 0) return h;
    const r = Math.hypot(x - this.islandX, z - this.islandZ);
    for (const w of this.waves) {
      const amp = this.currentAmplitude(w);
      if (amp <= 0.001) continue;
      const s = w.radius - r;
      // Weit weg vom Kamm: kein Beitrag (gleiche Abkürzung wie im Shader)
      if (s > w.frontWidth * 3 || s < -w.backWidth * 3) continue;
      const loc = this.local(w, x, z, tmpLocal);
      h += this.crestHeight(w, loc.l) * this.profile(w, loc.s) * fade;
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
      w.radius = w.startRadius - w.travelled;
      w.angle = wrapAngle(w.angle + w.angularDrift * dt);
      w.phase1 += w.pattern[0].speed * dt;
      w.phase2 += w.pattern[1].speed * dt;
      const t = w.travelled / w.travelDistance;
      w.envelope = smoothstep(0, w.growPortion, t) * (1 - smoothstep(1 - w.fadePortion, 1, t));
      if (t >= 1 || w.radius < 1) {
        this.waves.splice(i, 1);
        removed.push(w);
      }
    }
    return removed;
  }
}

const tmpLocal: WaveLocal = { s: 0, l: 0, dirX: 0, dirZ: 0 };
