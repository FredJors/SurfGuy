/**
 * Basisklasse für Monster-Instanzen: Lebenspunkte für Körper und Teile (z. B. Tentakel),
 * Schwächen, Stufen, Treffer-Blitz. Konkrete Verhaltensweisen erben davon (siehe Kraken.ts).
 */
import * as THREE from 'three';
import type { GameEventBus } from '../core/events';
import type { Rng } from '../core/Rng';
import type { RunState } from '../core/RunState';
import type { MonsterDef, MonsterTierDef } from '../data/types';
import type { Effects } from '../fx/Effects';
import type { PlayerStats } from '../player/Progression';
import type { Surfer } from '../player/Surfer';
import type { World } from '../world/World';
import type { AssetLoader } from '../assets/AssetLoader';

export type MonsterPhase = 'warning' | 'emerging' | 'active' | 'diving' | 'retreating' | 'gone';

export interface MonsterPart {
  readonly defId: string;
  readonly tag: string;
  readonly index: number;
  hp: number;
  readonly maxHp: number;
  readonly radius: number;
  alive: boolean;
  /** Aktuelle Weltposition des Trefferpunkts */
  readonly position: THREE.Vector3;
}

export interface MonsterContext {
  readonly surfer: Surfer;
  /** Kameraposition (Monster halten Abstand, damit sie nie die Sicht verdecken) */
  readonly cameraX: number;
  readonly cameraZ: number;
  readonly run: RunState;
  readonly stats: PlayerStats;
  readonly world: World;
  readonly effects: Effects;
  readonly bus: GameEventBus;
  readonly rng: Rng;
  /** Meldet einen Treffer am Spieler; gibt false zurück, wenn er unverwundbar/ausgewichen ist. */
  hitPlayer(source: string, x: number, z: number): boolean;
}

export interface MonsterSpawnArgs {
  id: number;
  def: MonsterDef;
  tier: MonsterTierDef;
  x: number;
  z: number;
  assets: AssetLoader;
}

export abstract class Monster {
  readonly id: number;
  readonly def: MonsterDef;
  readonly tier: MonsterTierDef;
  readonly root = new THREE.Group();
  readonly parts: MonsterPart[] = [];
  phase: MonsterPhase = 'warning';
  phaseTime = 0;
  hp: number;
  readonly maxHp: number;
  x: number;
  z: number;
  /** true, wenn der Spieler entkommen ist (keine Belohnung) */
  escaped = false;
  private flashTime = 0;
  private readonly flashMaterials: { mat: THREE.MeshToonMaterial; base: THREE.Color }[] = [];

  constructor(args: MonsterSpawnArgs) {
    this.id = args.id;
    this.def = args.def;
    this.tier = args.tier;
    this.x = args.x;
    this.z = args.z;
    this.maxHp = this.hp = Math.round(args.def.hp * args.tier.hpMul);
    for (const p of args.def.parts) {
      const count = p.count + (args.tier.extraParts?.[p.id] ?? 0);
      for (let i = 0; i < count; i++) {
        const maxHp = Math.round(p.hp * args.tier.hpMul);
        this.parts.push({ defId: p.id, tag: p.tag, index: i, hp: maxHp, maxHp, radius: p.radius, alive: true, position: new THREE.Vector3() });
      }
    }
  }

  /** Nach dem Aufbau des Modells aufrufen, damit der Treffer-Blitz alle Materialien kennt. */
  protected collectFlashMaterials(): void {
    const seen = new Set<THREE.Material>();
    this.root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshToonMaterial | undefined;
      if (m && !seen.has(m) && (m as THREE.MeshToonMaterial).isMeshToonMaterial) {
        seen.add(m);
        this.flashMaterials.push({ mat: m, base: m.emissive.clone() });
      }
    });
  }

  get isTargetable(): boolean {
    return this.phase === 'active' || this.phase === 'emerging';
  }

  get isDone(): boolean {
    return this.phase === 'gone';
  }

  setPhase(p: MonsterPhase): void {
    this.phase = p;
    this.phaseTime = 0;
  }

  /** Schaden an einem Teil; gibt den tatsächlich verursachten Schaden zurück. */
  takeHit(part: MonsterPart, damage: number, ctx: { bus: GameEventBus }): number {
    if (!this.isTargetable || !part.alive) return 0;
    this.flashTime = 0.14;
    if (part.maxHp > 0) {
      part.hp -= damage;
      this.hp -= damage * this.def.partDamageToBody;
      if (part.hp <= 0) {
        part.alive = false;
        this.onPartDestroyed(part);
        ctx.bus.emit('monsterPartDestroyed', { instanceId: this.id, monsterId: this.def.id, partTag: part.tag });
      }
    } else {
      this.hp -= damage;
    }
    return damage;
  }

  /** Ist der Kampf entschieden (Körper besiegt)? */
  get isDefeated(): boolean {
    return this.hp <= 0;
  }

  protected onPartDestroyed(_part: MonsterPart): void {}

  /** Der Spieler wurde getroffen (von diesem oder einem anderen Monster) → Schonfrist. */
  onPlayerHit(): void {}

  /** Aktualisiert den Treffer-Blitz. */
  protected updateFlash(dt: number): void {
    if (this.flashTime <= 0 && this.flashMaterials.length && this.flashMaterials[0]!.mat.emissive.equals(this.flashMaterials[0]!.base)) return;
    this.flashTime = Math.max(0, this.flashTime - dt);
    const k = this.flashTime > 0 ? 1 : 0;
    for (const f of this.flashMaterials) f.mat.emissive.copy(f.base).lerp(WHITE, k * 0.85);
  }

  abstract update(dt: number, ctx: MonsterContext): void;

  /** Hängt alle Objekte des Monsters in die Szene. */
  attach(parent: THREE.Object3D): void {
    parent.add(this.root);
  }

  dispose(): void {
    this.root.removeFromParent();
  }
}

const WHITE = new THREE.Color('#ffffff');
