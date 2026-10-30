/**
 * Eisbär (Kapitel 3): treibt auf seiner Eisscholle neben dir her. Angriff: duckt sich und brüllt –
 * ein roter Ring zeigt, wo er landet – dann springt er in hohem Bogen auf dich (Stampfsprung).
 * Rausfahren oder hochspringen! Danach paddelt er benommen im Wasser (verwundbarer), bis seine
 * Scholle wieder bei ihm ist. Stufe 3 springt zweimal hintereinander.
 *
 * behaviorParams: slamRadius (m), leapTime (s), leapHeight (m), swimTime (s), swimDamage (Faktor),
 *                 leaps (Sprünge pro Angriff), firstCooldown (s)
 */
import * as THREE from 'three';
import { clamp01, dampAngle, smoothstep } from '../core/math';
import type { GameEventBus } from '../core/events';
import { createBlobShadow } from '../fx/Effects';
import { createRingTelegraph } from '../fx/telegraph';
import { addOutline, toonMaterial } from '../fx/toon';
import { Monster, type MonsterContext, type MonsterPart, type MonsterSpawnArgs } from './Monster';

const EMERGE_TIME = 0.8;
const RETREAT_TIME = 2.4;
/** Oberkante der Scholle über dem Wasser */
const FLOE_TOP = 0.45;
/** Schwimmend: nur Kopf und Rücken über Wasser */
const SWIM_Y = -1.35;

type BearMode = 'drift' | 'crouch' | 'leap' | 'swim';

export class PolarBear extends Monster {
  private readonly model: THREE.Object3D;
  private readonly legs: THREE.Object3D[] = [];
  private readonly head: THREE.Object3D | undefined;
  private readonly floe: THREE.Object3D;
  private readonly telegraph = createRingTelegraph('#ff3b30');
  private readonly shadow: THREE.Mesh;
  private mode: BearMode = 'drift';
  private modeTime = 0;
  private cooldown: number;
  private grace = 0;
  private time = 0;
  private facing = 0;
  private pitch = 0;
  private y = FLOE_TOP;
  private side: 1 | -1 = 1;
  private floeX: number;
  private floeZ: number;
  private fromX = 0;
  private fromZ = 0;
  private fromY = 0;
  private toX = 0;
  private toZ = 0;
  private leapsLeft = 0;
  private surfaced = false;
  private readonly v = new THREE.Vector3();

  constructor(args: MonsterSpawnArgs) {
    super(args);
    this.model = args.assets.create(args.def.model, { colors: args.def.colors });
    for (const n of ['legFL', 'legFR', 'legBL', 'legBR']) {
      const l = this.model.getObjectByName(n);
      if (l) this.legs.push(l);
    }
    this.head = this.model.getObjectByName('head') ?? undefined;
    addOutline(this.model, 0.06);
    this.root.add(this.model);
    this.floe = buildFloe();
    this.floeX = this.x;
    this.floeZ = this.z;
    this.cooldown = this.param('firstCooldown', 2.5);
    this.side = Math.random() < 0.5 ? 1 : -1;
    this.shadow = createBlobShadow(1);
    this.collectFlashMaterials();
  }

  override attach(parent: THREE.Object3D): void {
    parent.add(this.root, this.floe, this.telegraph, this.shadow);
  }

  override dispose(): void {
    super.dispose();
    this.floe.removeFromParent();
    this.telegraph.removeFromParent();
    this.shadow.removeFromParent();
  }

  /** Hoch in der Luft ist er nicht zu treffen (erst kurz vor der Landung wieder). */
  override get isTargetable(): boolean {
    if (this.phase === 'emerging') return true;
    if (this.phase !== 'active') return false;
    return this.mode !== 'leap' || this.modeTime > this.param('leapTime', 1.1) * 0.8;
  }

  override onPlayerHit(): void {
    this.grace = this.def.attack.graceAfterHit;
  }

  /** Benommen im Wasser nimmt er mehr Schaden. */
  override takeHit(part: MonsterPart, damage: number, ctx: { bus: GameEventBus }): number {
    const k = this.mode === 'swim' ? this.param('swimDamage', 1.5) : 1;
    return super.takeHit(part, Math.round(damage * k), ctx);
  }

  private setMode(m: BearMode): void {
    this.mode = m;
    this.modeTime = 0;
  }

  private get slamRadius(): number {
    return this.param('slamRadius', 6);
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
    let crouch = 0;
    let swimK = 0;

    switch (this.phase) {
      case 'warning': {
        // Die Scholle treibt heran, der Bär liegt darauf
        this.facing = dampAngle(this.facing, Math.atan2(s.x - this.x, s.z - this.z), 2, dt);
        this.x += Math.sin(this.facing) * def.chaseSpeed * 0.8 * dt;
        this.z += Math.cos(this.facing) * def.chaseSpeed * 0.8 * dt;
        this.floeX = this.x;
        this.floeZ = this.z;
        this.y = FLOE_TOP;
        crouch = 0.8;
        if (this.phaseTime >= def.warningTime) {
          this.setPhase('emerging');
          if (!this.surfaced) ctx.bus.emit('monsterSpawned', { instanceId: this.id, monsterId: def.id, tier: this.tier.tier });
          this.surfaced = true;
          ctx.bus.emit('monsterAttack', { monsterId: def.id, kind: 'growl', position: { x: this.x, z: this.z } });
        }
        break;
      }
      case 'emerging': {
        crouch = 0.8 * (1 - smoothstep(0, EMERGE_TIME, this.phaseTime));
        this.drift(dt, ctx);
        if (this.phaseTime >= EMERGE_TIME) this.setPhase('active');
        break;
      }
      case 'active': {
        const r = this.updateActive(dt, ctx, dist, water);
        crouch = r.crouch;
        swimK = r.swim;
        if (this.isDefeated) {
          this.emitDefeated(ctx);
          ctx.effects.hitSparks(this.v.set(this.x, water + 2, this.z), '#dff4ff', 2.2);
          this.telegraph.visible = false;
          this.setPhase('retreating');
        } else if (dist > def.escapeDistance && this.mode === 'drift') {
          this.escaped = true;
          ctx.bus.emit('monsterEscaped', { instanceId: this.id, monsterId: def.id, points: def.escapePoints });
          this.telegraph.visible = false;
          this.setPhase('retreating');
        }
        break;
      }
      case 'retreating': {
        // Besiegt: plumpst ins Wasser und taucht ab; entkommen: treibt davon
        const k = clamp01(this.phaseTime / RETREAT_TIME);
        if (this.escaped) {
          this.x += Math.sin(this.facing) * 6 * dt;
          this.z += Math.cos(this.facing) * 6 * dt;
          this.floeX = this.x;
          this.floeZ = this.z;
        } else {
          this.y = FLOE_TOP + (SWIM_Y - 2 - FLOE_TOP) * smoothstep(0, 1, k);
          this.pitch = 0.4 * k;
        }
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
    const floeWater = ctx.world.heightAt(this.floeX, this.floeZ);
    this.floe.position.set(this.floeX, floeWater - 0.35 + Math.sin(this.time * 1.4) * 0.08, this.floeZ);
    this.floe.rotation.set(Math.sin(this.time * 1.1) * 0.03, this.floe.rotation.y + dt * 0.05, Math.cos(this.time * 0.9) * 0.03);
    const inLeap = this.phase === 'active' && this.mode === 'leap';
    const baseY = inLeap ? this.y : (swimK > 0.5 ? water : floeWater) + this.y;
    this.root.position.set(this.x, baseY - crouch * 0.45, this.z);
    this.root.rotation.set(this.pitch, this.facing, 0, 'YXZ');
    // Beine: ducken, strecken im Sprung, paddeln im Wasser
    const paddle = swimK > 0.5 ? Math.sin(this.time * 7) * 0.7 : 0;
    this.legs.forEach((l, i) => {
      const front = i < 2;
      const stretch = inLeap ? (front ? -0.9 : 0.9) : 0;
      l.rotation.x = (front ? 0.55 : -0.55) * crouch + stretch + paddle * (i % 2 ? 1 : -1);
    });
    if (this.head) this.head.rotation.x = 0.25 * crouch - (this.mode === 'crouch' ? Math.sin(this.time * 18) * 0.06 : 0);
    const fx = Math.sin(this.facing);
    const fz = Math.cos(this.facing);
    this.parts[0]?.position.set(this.x + fx * 1.9, baseY + 2.3, this.z + fz * 1.9);
    this.parts[1]?.position.set(this.x, baseY + 1.6, this.z);
    // Schatten unter dem springenden Bären
    this.shadow.visible = inLeap;
    if (inLeap) {
      this.shadow.position.set(this.x, ctx.world.heightAt(this.x, this.z) + 0.06, this.z);
      this.shadow.scale.setScalar(3 + (baseY - water) * 0.12);
      (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.45;
    }
    this.updateFlash(dt);
  }

  /** Treibt auf der Scholle schräg vor dem Spieler (im Blickfeld). */
  private drift(dt: number, ctx: MonsterContext): void {
    const def = this.def;
    const s = ctx.surfer;
    const r = this.grace > 0 ? def.preferredDistance + 10 : def.preferredDistance;
    const hx = Math.sin(s.heading);
    const hz = Math.cos(s.heading);
    const tx = s.x + hz * this.side * r * 0.75 + hx * r * 0.7;
    const tz = s.z - hx * this.side * r * 0.75 + hz * r * 0.7;
    const dx = tx - this.x;
    const dz = tz - this.z;
    const d = Math.hypot(dx, dz) || 1;
    const speed = Math.max(def.chaseSpeed * this.tier.speedMul, Math.hypot(s.vx, s.vz) * (d > 6 ? 1.12 : 0.95));
    const step = Math.min(d, speed * dt);
    this.x += (dx / d) * step;
    this.z += (dz / d) * step;
    this.keepClearOfCamera(ctx, speed, dt, 9);
    this.floeX = this.x;
    this.floeZ = this.z;
    this.facing = dampAngle(this.facing, Math.atan2(s.x - this.x, s.z - this.z), 3, dt);
    this.pitch *= Math.exp(-4 * dt);
    this.y += (FLOE_TOP - this.y) * Math.min(1, dt * 4);
  }

  private startCrouch(ctx: MonsterContext): void {
    this.setMode('crouch');
    this.toX = ctx.surfer.x;
    this.toZ = ctx.surfer.z;
    ctx.bus.emit('monsterAttack', { monsterId: this.def.id, kind: 'growl', position: { x: this.x, z: this.z } });
  }

  /** Gibt Ducken (0..1) und Schwimmen (0..1) für die Darstellung zurück. */
  private updateActive(dt: number, ctx: MonsterContext, dist: number, water: number): { crouch: number; swim: number } {
    const def = this.def;
    const atk = def.attack;
    const s = ctx.surfer;
    switch (this.mode) {
      case 'drift': {
        this.drift(dt, ctx);
        this.telegraph.visible = false;
        this.cooldown -= dt;
        const canAttack = this.grace <= 0 && ctx.run.invulnerable <= 0 && !s.fsm.is('Wipeout');
        if (this.cooldown <= 0 && canAttack && dist < atk.reach) {
          this.leapsLeft = Math.max(1, Math.round(this.param('leaps', 1) + (this.tier.tier >= 3 ? 1 : 0)));
          this.startCrouch(ctx);
        }
        return { crouch: 0, swim: 0 };
      }
      case 'crouch': {
        // Zielt (Ring folgt dem Spieler), im letzten Drittel steht der Landepunkt fest
        const second = this.leapsLeft < Math.round(this.param('leaps', 1) + (this.tier.tier >= 3 ? 1 : 0));
        const windup = atk.windup * this.tier.windupMul * (second ? 0.65 : 1);
        const k = clamp01(this.modeTime / windup);
        if (k < 0.68) {
          const lead = atk.lead * (windup - this.modeTime + this.param('leapTime', 1.1));
          const px = s.x + s.vx * Math.min(lead, 1.2);
          const pz = s.z + s.vz * Math.min(lead, 1.2);
          this.toX += (px - this.toX) * Math.min(1, dt * 6);
          this.toZ += (pz - this.toZ) * Math.min(1, dt * 6);
        }
        this.facing = dampAngle(this.facing, Math.atan2(this.toX - this.x, this.toZ - this.z), 6, dt);
        this.showRing(ctx, k);
        if (this.modeTime >= windup) {
          this.fromX = this.x;
          this.fromZ = this.z;
          this.fromY = this.root.position.y;
          this.setMode('leap');
          ctx.effects.splash(this.v.set(this.x, water, this.z), 1.6);
        }
        return { crouch: smoothstep(0, 0.5, k), swim: second ? 1 : 0 };
      }
      case 'leap': {
        const T = this.param('leapTime', 1.1);
        const k = clamp01(this.modeTime / T);
        const landY = ctx.world.heightAt(this.toX, this.toZ) + SWIM_Y * 0.6;
        this.x = this.fromX + (this.toX - this.fromX) * k;
        this.z = this.fromZ + (this.toZ - this.fromZ) * k;
        this.y = this.fromY + (landY - this.fromY) * k + Math.sin(Math.PI * k) * this.param('leapHeight', 9);
        this.pitch = -0.5 + k * 1.0;
        this.showRing(ctx, 1);
        if (k >= 1) {
          this.telegraph.visible = false;
          ctx.effects.splash(this.v.set(this.x, ctx.world.heightAt(this.x, this.z), this.z), 4.5);
          ctx.effects.shockwave(this.v, '#dff4ff', this.slamRadius * 1.3, 0.6);
          ctx.effects.hitSparks(this.v.set(this.x, ctx.world.heightAt(this.x, this.z) + 1, this.z), '#bfe8ff', 1.6);
          ctx.bus.emit('monsterAttack', { monsterId: def.id, kind: 'slam', position: { x: this.x, z: this.z } });
          if (Math.hypot(s.x - this.x, s.z - this.z) <= this.slamRadius) ctx.hitPlayer(def.id, this.x, this.z);
          this.leapsLeft--;
          this.y = SWIM_Y;
          if (this.leapsLeft > 0 && this.grace <= 0) this.startCrouch(ctx);
          else this.setMode('swim');
        }
        return { crouch: 0, swim: 0 };
      }
      case 'swim': {
        // Benommen im Wasser; die Scholle treibt zu ihm, dann klettert er wieder hinauf
        this.telegraph.visible = false;
        this.y += (SWIM_Y + Math.sin(this.time * 3) * 0.12 - this.y) * Math.min(1, dt * 3);
        this.pitch += (-0.15 - this.pitch) * Math.min(1, dt * 3);
        this.floeX += (this.x - this.floeX) * Math.min(1, dt * 0.9);
        this.floeZ += (this.z - this.floeZ) * Math.min(1, dt * 0.9);
        const floeNear = Math.hypot(this.floeX - this.x, this.floeZ - this.z) < 1.5;
        if (this.modeTime >= this.param('swimTime', 2.6) && floeNear) {
          this.y = FLOE_TOP;
          this.side = Math.random() < 0.5 ? 1 : -1;
          this.cooldown = ctx.rng.range(atk.cooldown[0], atk.cooldown[1]) * this.tier.windupMul;
          ctx.effects.splash(this.v.set(this.x, water, this.z), 1.5);
          this.setMode('drift');
        }
        return { crouch: 0, swim: 1 };
      }
    }
  }

  /** Landering anzeigen (wächst mit der Aufladung, pulsiert schneller). */
  private showRing(ctx: MonsterContext, k: number): void {
    const R = this.slamRadius;
    this.telegraph.visible = true;
    this.telegraph.position.set(this.toX, ctx.world.heightAt(this.toX, this.toZ) + 0.12, this.toZ);
    this.telegraph.scale.setScalar(Math.max(0.5, R * (0.45 + 0.55 * k)));
    ((this.telegraph.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.45 * Math.sin(this.time * (8 + k * 18));
  }
}

let floeGeo: THREE.BufferGeometry | null = null;
let floeMat: THREE.Material | null = null;

/** Eisscholle: flache, unregelmäßige Platte mit Schneekante. */
function buildFloe(): THREE.Object3D {
  if (!floeGeo) {
    const shape = new THREE.Shape();
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 3.6 * (0.85 + 0.15 * Math.sin(a * 3 + 1.3) + 0.08 * Math.cos(a * 5));
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    floeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: true, bevelSize: 0.25, bevelThickness: 0.15, bevelSegments: 1 });
    floeGeo.rotateX(-Math.PI / 2);
    floeGeo.translate(0, -0.15, 0);
    floeMat = toonMaterial('#e6f6ff', { gloss: 0.6, rim: 0.3 });
  }
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(floeGeo, floeMat!);
  mesh.receiveShadow = true;
  g.add(mesh);
  addOutline(g, 0.05);
  return g;
}
