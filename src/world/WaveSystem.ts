/**
 * Lässt Wellen zufällig anrollen: meist einzeln, manchmal als Set (die letzte ist die größte).
 * Jede Welle ist ein Kreisbogen um die Insel und läuft nach innen – egal wo man um die Insel
 * herum surft. Länge, Höhe, Tempo, seitliche Wanderung und Höhenmuster sind zufällig.
 */
import { CONFIG } from '../config/gameConfig';
import type { GameEventBus } from '../core/events';
import type { Rng } from '../core/Rng';
import { WaveField, makeSwell, type Wave } from './WaveField';

/** Optionale Vorgaben für eine einzelne Welle (sonst zufällig). */
export interface WaveSpec {
  angle: number;
  startRadius: number;
  amplitude: number;
  halfLength: number;
  speed: number;
  setId: number;
  indexInSet: number;
  isLast: boolean;
  /** Stärke des Höhenmusters (1 = normal, 0 = gleichmäßig hoch) */
  patternScale?: number;
}

export class WaveSystem {
  readonly field: WaveField;
  private nextIn: number = CONFIG.waves.firstWaveDelay;
  private nextWaveId = 1;
  private nextSetId = 1;
  private enabled = false;

  constructor(
    private readonly bus: GameEventBus,
    private rng: Rng,
  ) {
    const [ix, iz] = CONFIG.world.islandPosition;
    this.field = new WaveField(
      makeSwell(CONFIG.ocean.swell),
      ix,
      iz,
      CONFIG.world.boundaryRadius - 10,
      CONFIG.world.boundaryRadius + 60,
    );
  }

  /** Startet das Anrollen (im Menü laufen nur ruhige Wellen). */
  start(rng: Rng): void {
    this.rng = rng;
    this.enabled = true;
    this.nextIn = CONFIG.waves.firstWaveDelay;
  }

  stop(): void {
    this.enabled = false;
  }

  /** Entfernt alle Wellen (z. B. bei Neustart). */
  clear(): void {
    this.field.waves.length = 0;
  }

  update(dt: number, playerX: number, playerZ: number, playerVx = 0, playerVz = 0): void {
    this.field.advance(dt);
    if (!this.enabled) return;
    this.nextIn -= dt;
    if (this.nextIn > 0) return;
    const cfg = CONFIG.waves;
    if (this.rng.chance(cfg.ambientChance)) this.spawnAmbient(playerX, playerZ);
    else if (this.rng.chance(cfg.setChance)) this.spawnSet(playerX, playerZ, playerVx, playerVz);
    else this.spawnNear(playerX, playerZ, playerVx, playerVz, 1);
    this.nextIn = this.rng.range(cfg.interval[0], cfg.interval[1]);
  }

  /** Ein Set (2–4 Wellen, die letzte am größten), das auf den Spieler zuläuft. */
  spawnSet(playerX: number, playerZ: number, playerVx = 0, playerVz = 0): void {
    const counts = Object.entries(CONFIG.waves.wavesPerSet).map(([n, w]) => ({ n: Number(n), w }));
    const count = this.rng.weighted(counts, (c) => c.w)?.n ?? 3;
    this.spawnNear(playerX, playerZ, playerVx, playerVz, count);
  }

  /** Welle(n), die den Spieler nach einer zufälligen Anlaufzeit erreichen. */
  spawnNear(playerX: number, playerZ: number, playerVx: number, playerVz: number, count: number): void {
    const cfg = CONFIG.waves;
    const f = this.field;
    const dx = playerX - f.islandX;
    const dz = playerZ - f.islandZ;
    const r = Math.hypot(dx, dz) || 1;
    // Wie schnell bewegt sich der Spieler Richtung Insel? (die Welle muss ihn einholen)
    const inward = -(playerVx * dx + playerVz * dz) / r;
    const speed = this.rng.range(cfg.speed[0], cfg.speed[1]);
    const closing = Math.max(4, speed - inward);
    const approach = Math.min(cfg.maxSpawnDistance, Math.max(cfg.minSpawnDistance, closing * this.rng.range(cfg.arrivalTime[0], cfg.arrivalTime[1])));
    const halfLength = this.rng.range(cfg.halfLength[0], cfg.halfLength[1]);
    // Spieler liegt irgendwo auf dem Kamm, nicht immer in der Mitte
    const angle = Math.atan2(dz, dx) + (this.rng.range(-0.5, 0.5) * halfLength) / r;
    const big = count === 1 && this.rng.chance(cfg.bigWaveChance);
    const base = big ? this.rng.range(cfg.bigWaveHeight[0], cfg.bigWaveHeight[1]) : this.rng.range(cfg.height[0], cfg.height[1]);
    const setId = this.nextSetId++;
    let radius = r + approach;
    for (let i = 0; i < count; i++) {
      const isLast = i === count - 1;
      const amplitude = count > 1 ? base * (isLast ? cfg.lastWaveFactor : 1 + i * 0.1) : base;
      this.spawnWave({
        angle: angle + this.rng.range(-0.04, 0.04),
        startRadius: radius,
        amplitude: amplitude * this.rng.range(0.92, 1.08),
        halfLength: halfLength * this.rng.range(0.8, 1.2),
        speed: speed * this.rng.range(0.95, 1.05),
        setId,
        indexInSet: i,
        isLast,
      });
      radius += this.rng.range(cfg.setSpacing[0], cfg.setSpacing[1]);
    }
    if (count > 1 || big) {
      this.bus.emit('waveSetIncoming', { setId, waveCount: count, dirX: -dx / r, dirZ: -dz / r, big });
    }
  }

  /** Gerufene Welle (Fähigkeit „Wellenruf“): gleichmäßig hoch, erreicht den Spieler nach `arrival` s. */
  spawnCalled(playerX: number, playerZ: number, playerVx: number, playerVz: number, height: number, arrival: number): Wave | null {
    const f = this.field;
    const dx = playerX - f.islandX;
    const dz = playerZ - f.islandZ;
    const r = Math.hypot(dx, dz) || 1;
    const inward = -(playerVx * dx + playerVz * dz) / r;
    const speed = 14;
    const approach = Math.max(25, Math.max(4, speed - inward) * arrival);
    const wave = this.spawnWave({
      angle: Math.atan2(dz, dx),
      startRadius: r + approach,
      amplitude: height,
      halfLength: 200,
      speed,
      setId: this.nextSetId++,
      indexInSet: 0,
      isLast: true,
      patternScale: 0.25,
    });
    // Sofort voll ausgebildet, damit sie nicht erst anschwellen muss
    if (wave) wave.growPortion = 0.001;
    return wave;
  }

  /** Welle irgendwo um die Insel – damit das Meer überall lebt. */
  spawnAmbient(playerX: number, playerZ: number): void {
    const cfg = CONFIG.waves;
    const f = this.field;
    const r = Math.hypot(playerX - f.islandX, playerZ - f.islandZ);
    const startRadius = Math.max(CONFIG.world.boundaryRadius + 120, r + this.rng.range(-150, 260));
    this.spawnWave({
      angle: this.rng.range(-Math.PI, Math.PI),
      startRadius,
      amplitude: this.rng.range(cfg.height[0], cfg.height[1]),
      halfLength: this.rng.range(cfg.halfLength[0], cfg.halfLength[1]),
      speed: this.rng.range(cfg.speed[0], cfg.speed[1]),
      setId: this.nextSetId++,
      indexInSet: 0,
      isLast: true,
    });
  }

  spawnWave(spec: WaveSpec): Wave | null {
    const cfg = CONFIG.waves;
    if (this.field.waves.length >= cfg.maxActive) return null;
    // Wellen laufen bis zum Riff (dort flachen sie ab), höchstens travelMax Meter
    const endRadius = CONFIG.world.boundaryRadius - 20;
    const travelDistance = Math.max(80, Math.min(cfg.travelMax, spec.startRadius - endRadius));
    const rng = this.rng;
    const pattern = (amountMax: number) => {
      const k = (Math.PI * 2) / rng.range(cfg.patternWavelength[0], cfg.patternWavelength[1]);
      // Höhenspitzen wandern entlang des Kamms
      const v = rng.range(-cfg.patternSpeed, cfg.patternSpeed);
      return { amount: rng.range(amountMax * 0.4, amountMax), k, phase: rng.range(0, Math.PI * 2), speed: -k * v };
    };
    const ps = spec.patternScale ?? 1;
    const p1 = pattern(cfg.patternAmount * ps);
    const p2 = pattern(cfg.patternAmount * 0.6 * ps);
    const wave: Wave = {
      id: this.nextWaveId++,
      setId: spec.setId,
      indexInSet: spec.indexInSet,
      isLast: spec.isLast,
      startRadius: spec.startRadius,
      speed: spec.speed,
      amplitude: spec.amplitude,
      frontWidth: rng.range(cfg.frontWidth[0], cfg.frontWidth[1]),
      backWidth: rng.range(cfg.backWidth[0], cfg.backWidth[1]),
      halfLength: spec.halfLength,
      angularDrift: rng.range(-cfg.lateralDrift, cfg.lateralDrift) / spec.startRadius,
      travelDistance,
      growPortion: Math.min(0.6, cfg.growDistance / travelDistance),
      fadePortion: cfg.fadePortion,
      pattern: [p1, p2],
      travelled: 0,
      radius: spec.startRadius,
      angle: spec.angle,
      envelope: 0,
      phase1: p1.phase,
      phase2: p2.phase,
    };
    this.field.waves.push(wave);
    this.bus.emit('waveSpawned', { waveId: wave.id, setId: spec.setId, isLast: spec.isLast });
    return wave;
  }

  getWave(id: number): Wave | undefined {
    return this.field.waves.find((w) => w.id === id);
  }
}
