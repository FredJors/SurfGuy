/**
 * Monster-Spawner und Kampf: zieht Monster gewichtet nach Zone aus dem Register, wählt die Stufe
 * nach Zone, platziert sie vor dem Spieler und wertet Trick-Treffer und Angriffe aus.
 */
import * as THREE from 'three';
import type { AssetLoader } from '../assets/AssetLoader';
import { CONFIG } from '../config/gameConfig';
import type { GameEventBus } from '../core/events';
import { Rng } from '../core/Rng';
import type { RunState } from '../core/RunState';
import type { ContentRegistries } from '../data';
import type { MonsterDef, TrickDef, ZoneDef } from '../data/types';
import type { Effects } from '../fx/Effects';
import type { PlayerStats } from '../player/Progression';
import type { Surfer } from '../player/Surfer';
import type { World } from '../world/World';
import { MONSTER_BEHAVIORS } from './behaviors';
import type { Monster, MonsterContext, MonsterPart } from './Monster';

export interface TargetInfo {
  x: number;
  z: number;
  monster: Monster;
  part: MonsterPart;
}

export class MonsterSystem {
  readonly group = new THREE.Group();
  readonly monsters: Monster[] = [];
  private rng = new Rng(1);
  private nextId = 1;
  private spawnTimer = 0;
  private enabled = false;
  /**
   * Fortschritt aus dem Spielstand: Stufe, mit der ein Monster als Nächstes kommt, und ob es
   * noch nicht auf allen Stufen besiegt ist. Ohne Angabe (Tests) entscheidet die Zone.
   */
  progress: { nextTier(def: MonsterDef): number; unfinished(def: MonsterDef): boolean } | null = null;

  constructor(
    private readonly bus: GameEventBus,
    private readonly content: ContentRegistries,
    private readonly assets: AssetLoader,
    private readonly world: World,
    private readonly effects: Effects,
  ) {}

  start(rng: Rng): void {
    this.clear();
    this.rng = rng;
    this.enabled = true;
    this.spawnTimer = CONFIG.combat.firstMonsterDelay;
  }

  clear(): void {
    for (const m of this.monsters) m.dispose();
    this.monsters.length = 0;
    this.enabled = false;
  }

  zoneAt(x: number, z: number): ZoneDef {
    const d = this.world.island.distanceTo(x, z);
    const zones = [...this.content.zones.all()].sort((a, b) => a.maxDistance - b.maxDistance);
    return zones.find((zone) => d <= zone.maxDistance) ?? zones[zones.length - 1]!;
  }

  update(dt: number, surfer: Surfer, run: RunState, stats: PlayerStats, camera: THREE.Camera): void {
    const ctx: MonsterContext = {
      surfer,
      cameraX: camera.position.x,
      cameraZ: camera.position.z,
      run,
      stats,
      world: this.world,
      effects: this.effects,
      bus: this.bus,
      rng: this.rng,
      hitPlayer: (source, x, z) => this.hitPlayer(source, x, z, surfer, run, stats),
    };

    // Während des Bosskampfs tauchen keine anderen Monster auf
    const bossFight = this.monsters.some((m) => m.def.boss && !m.isDone);
    if (this.enabled && run.hearts > 0 && !bossFight) {
      const zone = this.zoneAt(surfer.x, surfer.z);
      const alive = this.monsters.filter((m) => !m.isDone && m.phase !== 'retreating').length;
      if (alive < zone.maxMonsters) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnInZone(zone, surfer);
          this.spawnTimer = this.rng.range(zone.spawnInterval[0], zone.spawnInterval[1]);
        }
      }
    }

    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i]!;
      m.update(dt, ctx);
      if (m.isDone) {
        m.dispose();
        this.monsters.splice(i, 1);
        continue;
      }
      // Weiche Kollision: der Surfer fährt nicht durch Monster hindurch
      if (m.isTargetable && (!surfer.isAirborne || surfer.y - this.world.heightAt(surfer.x, surfer.z) < 2)) {
        const dx = surfer.x - m.x;
        const dz = surfer.z - m.z;
        const d = Math.hypot(dx, dz) || 0.001;
        const minD = m.def.bodyRadius + 0.6;
        if (d < minD) {
          surfer.x = m.x + (dx / d) * minD;
          surfer.z = m.z + (dz / d) * minD;
        }
      }
    }
  }

  /** Laufender Endgegner (oder null). */
  get boss(): Monster | null {
    return this.monsters.find((m) => m.def.boss && !m.isDone) ?? null;
  }

  /** Wählt Monsterart (gewichtet nach Zone) und Stufe und lässt es vor dem Spieler auftauchen. */
  spawnInZone(zone: ZoneDef, surfer: Surfer): Monster | null {
    // Arten, die noch nicht auf allen Stufen besiegt sind, kommen öfter (Weg zum Boss)
    const P = this.progress;
    const weight = (m: MonsterDef) => (m.boss ? 0 : (m.zoneWeights[zone.id] ?? 0) * (P?.unfinished(m) ? CONFIG.combat.unfinishedWeight : 1));
    const def = this.rng.weighted(this.content.monsters.all(), weight);
    if (!def) return null;
    let tierNo: number;
    if (P) {
      tierNo = P.nextTier(def);
    } else {
      const tierEntries = Object.entries(zone.tierWeights)
        .map(([tier, w]) => ({ tier: Number(tier), w }))
        .filter((t) => t.tier <= def.tiers.length);
      tierNo = this.rng.weighted(tierEntries, (t) => t.w)?.tier ?? 1;
    }
    const C = CONFIG.combat;
    const angle = surfer.heading + ((this.rng.range(-C.spawnAngle, C.spawnAngle) * Math.PI) / 180);
    const dist = this.rng.range(C.spawnDistance[0], C.spawnDistance[1]);
    // Fahrt des Spielers während der Vorwarnung vorhalten, damit das Monster wirklich vor ihm auftaucht
    const lead = def.warningTime + 0.9;
    let x = surfer.x + Math.sin(angle) * dist + surfer.vx * lead;
    let z = surfer.z + Math.cos(angle) * dist + surfer.vz * lead;
    // Nicht im Riff auftauchen
    const [ix, iz] = CONFIG.world.islandPosition;
    const di = Math.hypot(x - ix, z - iz);
    const minD = CONFIG.world.boundaryRadius + 25;
    if (di < minD) {
      x = ix + ((x - ix) / di) * minD;
      z = iz + ((z - iz) / di) * minD;
    }
    return this.spawn(def, tierNo, x, z);
  }

  spawn(def: MonsterDef, tierNo: number, x: number, z: number): Monster | null {
    const factory = MONSTER_BEHAVIORS[def.behavior];
    if (!factory) {
      console.error(`[Monster] Verhalten "${def.behavior}" unbekannt`);
      return null;
    }
    const tier = def.tiers.find((t) => t.tier === tierNo) ?? def.tiers[0]!;
    const m = factory({ id: this.nextId++, def, tier, x, z, assets: this.assets });
    m.attach(this.group);
    this.monsters.push(m);
    this.bus.emit('monsterWarning', { instanceId: m.id, monsterId: def.id, position: { x, z } });
    return m;
  }

  private hitPlayer(source: string, x: number, z: number, surfer: Surfer, run: RunState, stats: PlayerStats): boolean {
    if (run.invulnerable > 0 || run.hearts <= 0 || surfer.fsm.is('Wipeout')) return false;
    // In der Luft hoch genug = ausgewichen
    if (surfer.isAirborne && surfer.y - this.world.heightAt(surfer.x, surfer.z) > CONFIG.combat.dodgeHeight) return false;
    // Blasenschild fängt den Treffer ab
    if (run.shield > 0) {
      run.shield = 0;
      run.invulnerable = CONFIG.combat.shieldInvuln;
      for (const m of this.monsters) m.onPlayerHit();
      this.effects.hitSparks(new THREE.Vector3(surfer.x, surfer.y + 1, surfer.z), '#9be8ff', 1.5);
      this.bus.emit('shieldBroken', { position: { x: surfer.x, z: surfer.z } });
      return false;
    }
    run.hearts -= 1;
    run.invulnerable = stats.get('invulnTime');
    surfer.wipeout();
    for (const m of this.monsters) m.onPlayerHit();
    this.effects.splash(new THREE.Vector3(surfer.x, surfer.y, surfer.z), 2.5);
    this.bus.emit('playerHit', { source, heartsLeft: run.hearts, position: { x, z } });
    return true;
  }

  /** Nächstes Ziel mit Tag in einem Kegel vor dem Surfer (für Zielsuche, z. B. Salto auf den Kopf). */
  findTarget(tag: string | undefined, x: number, z: number, fx: number, fz: number, range: number, halfAngleDeg: number): TargetInfo | null {
    const cos = Math.cos((halfAngleDeg * Math.PI) / 180);
    let best: TargetInfo | null = null;
    let bestD = Infinity;
    for (const m of this.monsters) {
      if (!m.isTargetable) continue;
      for (const p of m.parts) {
        if (!p.alive || (tag && p.tag !== tag)) continue;
        const dx = p.position.x - x;
        const dz = p.position.z - z;
        const d = Math.hypot(dx, dz);
        if (d > range + p.radius) continue;
        if (d > p.radius && (dx * fx + dz * fz) / d < cos) continue;
        if (d < bestD) {
          bestD = d;
          best = { x: p.position.x, z: p.position.z, monster: m, part: p };
        }
      }
    }
    return best;
  }

  /** Wertet einen Trick-Treffer aus. Gibt die Anzahl getroffener Teile zurück. */
  applyTrickHit(trick: TrickDef, damageMul: number, x: number, _y: number, z: number, fx: number, fz: number): number {
    type Cand = { m: Monster; p: MonsterPart; d: number };
    const area = trick.hitArea;
    const collect = (tags: readonly string[] | undefined): Cand[] => {
      const out: Cand[] = [];
      for (const m of this.monsters) {
        if (!m.isTargetable) continue;
        for (const p of m.parts) {
          if (!p.alive || (tags && !tags.includes(p.tag))) continue;
          const dx = p.position.x - x;
          const dz = p.position.z - z;
          const d = Math.hypot(dx, dz);
          if (area.shape === 'circle') {
            if (d > area.radius + p.radius) continue;
          } else {
            if (d > area.range + p.radius) continue;
            const cos = Math.cos((area.halfAngleDeg * Math.PI) / 180);
            if (d > p.radius && (dx * fx + dz * fz) / d < cos) continue;
          }
          out.push({ m, p, d });
        }
      }
      return out;
    };
    // Bevorzugte Ziel-Teile; gibt es keine im Bereich, trifft der Trick, was da ist
    let cands = collect(trick.targetTags);
    if (cands.length === 0 && trick.targetTags) cands = collect(undefined);
    if (cands.length === 0) return 0;
    cands.sort((a, b) => a.d - b.d);
    const targets = trick.targeting === 'nearest' ? cands.slice(0, 1) : cands;

    for (const { m, p } of targets) {
      const weakness = m.def.weaknesses.find((w) => w.trick === trick.id && (!w.tag || w.tag === p.tag));
      const damage = Math.round(trick.damage * damageMul * (weakness?.multiplier ?? 1));
      const dealt = m.takeHit(p, damage, { bus: this.bus });
      if (dealt > 0) {
        this.bus.emit('monsterHit', {
          instanceId: m.id,
          monsterId: m.def.id,
          partTag: p.tag,
          damage: dealt,
          trickId: trick.id,
          weakness: !!weakness,
          position: { x: p.position.x, y: p.position.y, z: p.position.z },
        });
      }
    }
    return targets.length;
  }
}
