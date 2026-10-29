/**
 * Erzeugt Wellen-Sets: In Abständen läuft ein Set (meist 3 Wellen, die letzte ist
 * die größte) von hinten auf den Spieler zu – immer in Richtung Insel.
 */
import { CONFIG } from '../config/gameConfig';
import type { GameEventBus } from '../core/events';
import type { Rng } from '../core/Rng';
import { WaveField, makeSwell, type Wave } from './WaveField';

export class WaveSystem {
  readonly field: WaveField;
  private nextSetIn: number = CONFIG.waves.firstSetDelay;
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

  /** Startet die Set-Erzeugung (im Menü laufen nur ruhige Wellen). */
  start(rng: Rng): void {
    this.rng = rng;
    this.enabled = true;
    this.nextSetIn = CONFIG.waves.firstSetDelay;
  }

  stop(): void {
    this.enabled = false;
  }

  /** Entfernt alle Set-Wellen (z. B. bei Neustart). */
  clear(): void {
    this.field.waves.length = 0;
  }

  update(dt: number, playerX: number, playerZ: number, playerVx = 0, playerVz = 0): void {
    this.field.advance(dt);
    if (!this.enabled) return;
    this.nextSetIn -= dt;
    if (this.nextSetIn <= 0) {
      this.spawnSet(playerX, playerZ, playerVx, playerVz);
      this.nextSetIn = this.rng.range(CONFIG.waves.setInterval[0], CONFIG.waves.setInterval[1]);
    }
  }

  spawnSet(playerX: number, playerZ: number, playerVx = 0, playerVz = 0): void {
    const cfg = CONFIG.waves;
    const [ix, iz] = CONFIG.world.islandPosition;
    let dirX = ix - playerX;
    let dirZ = iz - playerZ;
    const len = Math.hypot(dirX, dirZ) || 1;
    dirX /= len;
    dirZ /= len;

    const counts = Object.entries(cfg.wavesPerSet).map(([n, w]) => ({ n: Number(n), w }));
    const count = this.rng.weighted(counts, (c) => c.w)?.n ?? 3;
    const setId = this.nextSetId++;
    const baseHeight = this.rng.range(cfg.height[0], cfg.height[1]);
    const lateral = this.rng.range(-25, 25);
    // Startabstand so wählen, dass das Set nach ca. arrivalTime beim Spieler ist
    const along = playerVx * dirX + playerVz * dirZ;
    const closing = Math.max(4, cfg.speed - along);
    const approach = Math.min(cfg.maxSpawnDistance, Math.max(cfg.minSpawnDistance, closing * cfg.arrivalTime));

    for (let i = 0; i < count; i++) {
      if (this.field.waves.length >= cfg.maxActive) break;
      const isLast = i === count - 1;
      const back = approach + i * cfg.spacing;
      const travelDistance = back + cfg.travelBeyond;
      const originX = playerX - dirX * back - dirZ * lateral;
      const originZ = playerZ - dirZ * back + dirX * lateral;
      const amplitude = baseHeight * (isLast ? cfg.lastWaveFactor : 1 + i * 0.08) * this.rng.range(0.95, 1.05);
      const wave: Wave = {
        id: this.nextWaveId++,
        setId,
        indexInSet: i,
        isLast,
        originX,
        originZ,
        dirX,
        dirZ,
        speed: cfg.speed,
        amplitude,
        frontWidth: cfg.frontWidth,
        backWidth: cfg.backWidth,
        halfLength: cfg.crestLength / 2,
        travelDistance,
        growPortion: (cfg.growPortion * back) / travelDistance,
        fadePortion: cfg.fadePortion,
        travelled: 0,
        crestX: originX,
        crestZ: originZ,
        envelope: 0,
      };
      this.field.waves.push(wave);
      this.bus.emit('waveSpawned', { waveId: wave.id, setId, isLast });
    }
    this.bus.emit('waveSetIncoming', { setId, waveCount: count, dirX, dirZ });
  }

  getWave(id: number): Wave | undefined {
    return this.field.waves.find((w) => w.id === id);
  }
}
