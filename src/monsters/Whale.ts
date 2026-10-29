/**
 * Wal (Kapitel 2): schwimmt neben dem Spieler her und bläst Fontänen. Angriff: taucht ab
 * (Fluke ragt kurz heraus), dann wächst unter dem Spieler ein dunkler Schatten mit rotem Ring –
 * und der Wal kracht aus dem Wasser. Raus aus dem Ring oder hoch springen! Danach treibt er
 * benommen auf der Seite (verwundbarer).
 *
 * behaviorParams: slamRadius (m), diveTime, breachTime, restTime (s), restDamage (Faktor),
 *                 firstCooldown (s)
 */
import * as THREE from 'three';
import { clamp01, dampAngle, smoothstep } from '../core/math';
import { createBlobShadow } from '../fx/Effects';
import { createRingTelegraph } from '../fx/telegraph';
import { addOutline } from '../fx/toon';
import { Monster, type MonsterContext, type MonsterPart, type MonsterSpawnArgs } from './Monster';
import type { GameEventBus } from '../core/events';

const EMERGE_TIME = 1.2;
const RETREAT_TIME = 2.2;
/** Rücken knapp über Wasser */
const SURFACED = -0.75;
const DEEP = -12;

type WhaleMode = 'cruise' | 'dive' | 'lurk' | 'breach' | 'rest';

export class Whale extends Monster {
  private readonly model: THREE.Object3D;
  private readonly tail: THREE.Object3D | undefined;
  private readonly fins: THREE.Object3D[] = [];
  private readonly telegraph = createRingTelegraph('#ff3b30');
  private readonly shadow: THREE.Mesh;
  private mode: WhaleMode = 'cruise';
  private modeTime = 0;
  private cooldown: number;
  private grace = 0;
  private time = 0;
  private y = DEEP;
  private facing = 0;
  private pitch = 0;
  private roll = 0;
  private side: 1 | -1 = 1;
  private spoutTimer = 2;
  private targetX = 0;
  private targetZ = 0;
  private slamDone = false;
  private surfaced = false;
  private readonly v = new THREE.Vector3();

  constructor(args: MonsterSpawnArgs) {
    super(args);
    this.model = args.assets.create(args.def.model, { colors: args.def.colors });
    this.tail = this.model.getObjectByName('tail') ?? undefined;
    for (const n of ['finL', 'finR']) {
      const f = this.model.getObjectByName(n);
      if (f) this.fins.push(f);
    }
    addOutline(this.model, 0.07);
    this.root.add(this.model);
    this.cooldown = this.param('firstCooldown', 3);
    this.side = Math.random() < 0.5 ? 1 : -1;
    this.shadow = createBlobShadow(1);
    (this.shadow.material as THREE.MeshBasicMaterial).color.set('#061428');
    this.collectFlashMaterials();
  }

  override attach(parent: THREE.Object3D): void {
    parent.add(this.root, this.telegraph, this.shadow);
  }

  override dispose(): void {
    super.dispose();
    this.telegraph.removeFromParent();
    this.shadow.removeFromParent();
  }

  /** Abgetaucht ist er nicht zu treffen. */
  override get isTargetable(): boolean {
    if (this.phase === 'emerging') return true;
    if (this.phase !== 'active') return false;
    return this.mode === 'cruise' || this.mode === 'rest' || (this.mode === 'breach' && this.modeTime > 0.35) || (this.mode === 'dive' && this.modeTime < 0.5);
  }

  override onPlayerHit(): void {
    this.grace = this.def.attack.graceAfterHit;
  }

  /** Benommen nach dem Aufprall nimmt er mehr Schaden. */
  override takeHit(part: MonsterPart, damage: number, ctx: { bus: GameEventBus }): number {
    const k = this.mode === 'rest' ? this.param('restDamage', 1.5) : 1;
    return super.takeHit(part, Math.round(damage * k), ctx);
  }

  private setMode(m: WhaleMode): void {
    this.mode = m;
    this.modeTime = 0;
  }

  private get slamRadius(): number {
    return this.param('slamRadius', 9);
  }

  update(dt: number, ctx: MonsterContext): void {
    this.time += dt;
    this.phaseTime += dt;
    this.modeTime += dt;
    this.grace = Math.max(0, this.grace - dt);
    const def = this.def;
    const s = ctx.surfer;
    const dist = Math.hypot(s.x - this.x, s.z - this.z) || 1;
    const water = ctx.world.heightAt(this.x, this.z);
    let shadowK = 0.5;
    let shadowSize = 8;

    switch (this.phase) {
      case 'warning': {
        // Dunkler Schatten zieht heran, Luftblasen
        this.y = DEEP;
        this.facing = dampAngle(this.facing, Math.atan2(s.x - this.x, s.z - this.z), 2, dt);
        this.x += Math.sin(this.facing) * def.chaseSpeed * 0.5 * dt;
        this.z += Math.cos(this.facing) * def.chaseSpeed * 0.5 * dt;
        if (Math.random() < dt * 6) ctx.effects.bubbles(this.v.set(this.x, water, this.z), 3, 3);
        shadowK = smoothstep(0, def.warningTime, this.phaseTime) * 0.6;
        if (this.phaseTime >= def.warningTime) {
          this.setPhase('emerging');
          if (!this.surfaced) ctx.bus.emit('monsterSpawned', { instanceId: this.id, monsterId: def.id, tier: this.tier.tier });
          this.surfaced = true;
          ctx.effects.splash(this.v.set(this.x, water, this.z), 3);
          this.spout(ctx, water);
        }
        break;
      }
      case 'emerging': {
        this.y = DEEP + (SURFACED - DEEP) * smoothstep(0, EMERGE_TIME, this.phaseTime);
        this.cruise(dt, ctx, dist);
        if (this.phaseTime >= EMERGE_TIME) this.setPhase('active');
        break;
      }
      case 'active': {
        const r = this.updateActive(dt, ctx, dist, water);
        shadowK = r.k;
        shadowSize = r.size;
        if (this.isDefeated) {
          this.emitDefeated(ctx);
          ctx.effects.hitSparks(this.v.set(this.x, water + 2.5, this.z), '#bfe8ff', 2.5);
          this.spout(ctx, water);
          this.telegraph.visible = false;
          this.setPhase('retreating');
        } else if (dist > def.escapeDistance && this.mode === 'cruise') {
          this.escaped = true;
          ctx.bus.emit('monsterEscaped', { instanceId: this.id, monsterId: def.id, points: def.escapePoints });
          this.telegraph.visible = false;
          this.setPhase('retreating');
        }
        break;
      }
      case 'retreating': {
        // Abtauchen, Fluke zum Abschied
        const k = clamp01(this.phaseTime / RETREAT_TIME);
        this.y = SURFACED + (DEEP - SURFACED) * smoothstep(0.2, 1, k);
        this.pitch += (0.55 - this.pitch) * Math.min(1, dt * 2);
        this.roll *= Math.exp(-3 * dt);
        this.x += Math.sin(this.facing) * 5 * dt;
        this.z += Math.cos(this.facing) * 5 * dt;
        shadowK = 0.4 * (1 - k);
        if (k >= 1) this.setPhase('gone');
        break;
      }
      case 'gone':
        return;
      case 'diving':
        this.setPhase('active');
        break;
    }

    // --- Darstellung ---
    const lurking = this.phase === 'active' && this.mode === 'lurk';
    this.model.visible = this.phase !== 'warning' && !lurking;
    const bob = this.mode === 'cruise' ? Math.sin(this.time * 1.3) * 0.15 : 0;
    this.root.position.set(this.x, water + this.y + bob, this.z);
    this.root.rotation.set(this.pitch, this.facing, this.roll, 'YXZ');
    if (this.tail) this.tail.rotation.x = Math.sin(this.time * (this.mode === 'cruise' ? 2.2 : 4)) * 0.35;
    for (const [i, f] of this.fins.entries()) f.rotation.x = Math.sin(this.time * 1.6 + i) * 0.15;
    const fx = Math.sin(this.facing);
    const fz = Math.cos(this.facing);
    const top = water + this.y + 1.2;
    this.parts[0]?.position.set(this.x + fx * 4.2, top, this.z + fz * 4.2);
    this.parts[1]?.position.set(this.x - fx * 1.2, top + 0.4, this.z - fz * 1.2);
    // Schatten im Wasser
    const sx = lurking ? this.targetX : this.x;
    const sz = lurking ? this.targetZ : this.z;
    this.shadow.position.set(sx, ctx.world.heightAt(sx, sz) + 0.05, sz);
    this.shadow.rotation.set(-Math.PI / 2, 0, lurking ? 0 : -this.facing);
    this.shadow.scale.set(lurking ? shadowSize : shadowSize * 0.45, shadowSize, 1);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = shadowK;
    this.updateFlash(dt);
  }

  /** Blasfontäne aus dem Blasloch. */
  private spout(ctx: MonsterContext, water: number): void {
    const fx = Math.sin(this.facing);
    const fz = Math.cos(this.facing);
    ctx.effects.particles.emit({
      position: { x: this.x + fx * 2.2, y: water + this.y + 2.2, z: this.z + fz * 2.2 },
      count: 26,
      spread: 0.5,
      up: 11,
      life: [0.7, 1.3],
      size: [0.5, 1.1],
      color: '#e8f6ff',
      gravity: 9,
      drag: 1.2,
    });
  }

  /** Schwimmt seitlich neben dem Spieler her. */
  private cruise(dt: number, ctx: MonsterContext, dist: number): void {
    const def = this.def;
    const s = ctx.surfer;
    const r = this.grace > 0 ? def.preferredDistance + 12 : def.preferredDistance;
    const hx = Math.sin(s.heading);
    const hz = Math.cos(s.heading);
    // Schräg vor dem Spieler (im Blickfeld der Kamera)
    const tx = s.x + hz * this.side * r * 0.7 + hx * r * 0.75;
    const tz = s.z - hx * this.side * r * 0.7 + hz * r * 0.75;
    const dx = tx - this.x;
    const dz = tz - this.z;
    const d = Math.hypot(dx, dz) || 1;
    const speed = Math.max(def.chaseSpeed * this.tier.speedMul, Math.hypot(s.vx, s.vz) * (d > 6 ? 1.15 : 0.95));
    this.facing = dampAngle(this.facing, d > 3 ? Math.atan2(dx, dz) : s.heading, 1.6, dt);
    const step = Math.min(d, speed * dt);
    this.x += Math.sin(this.facing) * step;
    this.z += Math.cos(this.facing) * step;
    this.keepClearOfCamera(ctx, speed, dt, 10);
    this.pitch *= Math.exp(-2 * dt);
    this.roll += (Math.sin(this.time * 0.9) * 0.06 - this.roll) * Math.min(1, dt * 2);
    void dist;
  }

  /** Gibt Stärke und Größe des Schattens zurück. */
  private updateActive(dt: number, ctx: MonsterContext, dist: number, water: number): { k: number; size: number } {
    const def = this.def;
    const atk = def.attack;
    const s = ctx.surfer;
    switch (this.mode) {
      case 'cruise': {
        this.y += (SURFACED - this.y) * Math.min(1, dt * 2);
        this.cruise(dt, ctx, dist);
        this.spoutTimer -= dt;
        if (this.spoutTimer <= 0) {
          this.spoutTimer = 3.5 + Math.random() * 2;
          this.spout(ctx, water);
        }
        this.telegraph.visible = false;
        this.cooldown -= dt;
        const canAttack = this.grace <= 0 && ctx.run.invulnerable <= 0 && !s.fsm.is('Wipeout');
        if (this.cooldown <= 0 && canAttack && dist < atk.reach) {
          this.setMode('dive');
          ctx.bus.emit('monsterAttack', { monsterId: def.id, kind: 'dive', position: { x: this.x, z: this.z } });
        }
        return { k: 0.35, size: 8 };
      }
      case 'dive': {
        // Kopf runter, Fluke hoch, weg
        const t = this.param('diveTime', 1.2);
        const k = clamp01(this.modeTime / t);
        this.pitch = 0.9 * smoothstep(0, 0.6, k);
        this.y = SURFACED + (DEEP - SURFACED) * smoothstep(0.25, 1, k);
        this.x += Math.sin(this.facing) * 6 * dt;
        this.z += Math.cos(this.facing) * 6 * dt;
        if (this.modeTime < dt * 1.5) ctx.effects.splash(this.v.set(this.x, water, this.z), 1.8);
        if (k >= 1) {
          this.targetX = s.x;
          this.targetZ = s.z;
          this.setMode('lurk');
        }
        return { k: 0.35 * (1 - k), size: 8 };
      }
      case 'lurk': {
        // Schatten wächst unter dem Spieler; erst folgt er, kurz vor dem Sprung steht er fest
        const windup = atk.windup * this.tier.windupMul;
        const k = clamp01(this.modeTime / windup);
        if (k < 0.65) {
          const lead = atk.lead * (windup - this.modeTime);
          const px = s.x + s.vx * Math.min(lead, 0.8);
          const pz = s.z + s.vz * Math.min(lead, 0.8);
          this.targetX += (px - this.targetX) * Math.min(1, dt * 5);
          this.targetZ += (pz - this.targetZ) * Math.min(1, dt * 5);
        }
        this.x = this.targetX;
        this.z = this.targetZ;
        this.y = DEEP;
        const R = this.slamRadius;
        this.telegraph.visible = true;
        this.telegraph.position.set(this.targetX, ctx.world.heightAt(this.targetX, this.targetZ) + 0.12, this.targetZ);
        this.telegraph.scale.setScalar(Math.max(0.5, R * (0.4 + 0.6 * k)));
        ((this.telegraph.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.45 * Math.sin(this.time * (8 + k * 16));
        if (Math.random() < dt * 10 * k) ctx.effects.bubbles(this.v.set(this.targetX, water, this.targetZ), 3, R * 0.6);
        if (this.modeTime >= windup) {
          this.slamDone = false;
          this.facing = Math.random() * Math.PI * 2;
          this.setMode('breach');
          ctx.effects.splash(this.v.set(this.x, water, this.z), 4);
          ctx.bus.emit('monsterAttack', { monsterId: def.id, kind: 'breach', position: { x: this.x, z: this.z } });
        }
        return { k: 0.2 + 0.55 * k, size: R * (0.5 + 0.5 * k) };
      }
      case 'breach': {
        // Senkrecht hoch, kippt zur Seite und klatscht aufs Wasser
        const T = this.param('breachTime', 1.5);
        const k = clamp01(this.modeTime / T);
        const up = smoothstep(0, 0.45, k);
        const fall = smoothstep(0.45, 0.8, k);
        this.y = DEEP + (9 - DEEP) * up - (9 - SURFACED) * fall;
        this.pitch = -1.45 * up * (1 - fall);
        this.roll = (Math.PI / 2) * fall;
        this.telegraph.visible = !this.slamDone;
        if (!this.slamDone && k >= 0.8) {
          this.slamDone = true;
          this.telegraph.visible = false;
          ctx.effects.splash(this.v.set(this.x, water, this.z), 5);
          ctx.bus.emit('monsterAttack', { monsterId: def.id, kind: 'slam', position: { x: this.x, z: this.z } });
          if (Math.hypot(s.x - this.x, s.z - this.z) <= this.slamRadius) ctx.hitPlayer(def.id, this.x, this.z);
        }
        if (k >= 1) this.setMode('rest');
        return { k: 0.5 * (1 - up) + 0.3 * fall, size: this.slamRadius };
      }
      case 'rest': {
        // Benommen auf der Seite, rollt langsam zurück
        const t = this.param('restTime', 2.6);
        const k = clamp01(this.modeTime / t);
        this.y = SURFACED + 0.2;
        this.roll = (Math.PI / 2) * (1 - smoothstep(0.4, 1, k)) + Math.sin(this.modeTime * 5) * 0.05 * (1 - k);
        this.pitch *= Math.exp(-3 * dt);
        if (k >= 1) {
          this.side = Math.random() < 0.5 ? 1 : -1;
          this.cooldown = ctx.rng.range(atk.cooldown[0], atk.cooldown[1]) * this.tier.windupMul;
          this.setMode('cruise');
        }
        return { k: 0.4, size: 8 };
      }
    }
  }
}
