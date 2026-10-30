/**
 * Narwal (Kapitel 3): schwimmt in Sichtweite neben dir. Angriff: Er hält an, senkt den Kopf, sein
 * Stoßzahn leuchtet auf und ein langer Streifen zeigt die Bahn – dann stürmt er mit irrem Tempo
 * hindurch und weit darüber hinaus. Seitlich raus oder springen! Am Ende dreht er schwerfällig um
 * (verwundbarer). Stufe 3 stürmt danach gleich noch einmal zurück.
 *
 * behaviorParams: chargeSpeed (m/s), minLength (m), overshoot (m), turnTime (s),
 *                 turnDamage (Faktor), charges (Anläufe pro Angriff), firstCooldown (s)
 */
import * as THREE from 'three';
import { clamp01, dampAngle, smoothstep } from '../core/math';
import type { GameEventBus } from '../core/events';
import { createStripeTelegraph, placeStripe } from '../fx/telegraph';
import { addOutline } from '../fx/toon';
import { Monster, type MonsterContext, type MonsterPart, type MonsterSpawnArgs } from './Monster';

const EMERGE_TIME = 1.0;
const RETREAT_TIME = 2.0;
const SURFACED = -0.55;
const DEEP = -5;

type NarwhalMode = 'cruise' | 'aim' | 'charge' | 'turn';

export class Narwhal extends Monster {
  private readonly model: THREE.Object3D;
  private readonly tail: THREE.Object3D | undefined;
  private readonly fins: THREE.Object3D[] = [];
  private readonly hornMats: THREE.MeshToonMaterial[] = [];
  private readonly telegraph = createStripeTelegraph('#ff3b30');
  private mode: NarwhalMode = 'cruise';
  private modeTime = 0;
  private cooldown: number;
  private grace = 0;
  private time = 0;
  private y = DEEP;
  private facing = 0;
  private pitch = 0;
  private roll = 0;
  private side: 1 | -1 = 1;
  private chargesLeft = 0;
  private dirX = 0;
  private dirZ = 1;
  private length = 0;
  private travel = 0;
  private hitDone = false;
  private turnFrom = 0;
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
    this.model.getObjectByName('horn')?.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshToonMaterial | undefined;
      if (m?.isMeshToonMaterial && !this.hornMats.includes(m)) this.hornMats.push(m);
    });
    addOutline(this.model, 0.06);
    this.root.add(this.model);
    this.cooldown = this.param('firstCooldown', 3);
    this.side = Math.random() < 0.5 ? 1 : -1;
    this.collectFlashMaterials();
  }

  override attach(parent: THREE.Object3D): void {
    parent.add(this.root, this.telegraph);
  }

  override dispose(): void {
    super.dispose();
    this.telegraph.removeFromParent();
  }

  override onPlayerHit(): void {
    this.grace = this.def.attack.graceAfterHit;
    this.chargesLeft = 0;
  }

  /** Beim schwerfälligen Wenden nimmt er mehr Schaden. */
  override takeHit(part: MonsterPart, damage: number, ctx: { bus: GameEventBus }): number {
    const k = this.mode === 'turn' ? this.param('turnDamage', 1.5) : 1;
    return super.takeHit(part, Math.round(damage * k), ctx);
  }

  private setMode(m: NarwhalMode): void {
    this.mode = m;
    this.modeTime = 0;
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
    let glow = 0;
    let tailRate = 3;

    switch (this.phase) {
      case 'warning': {
        // Stoßzahn schneidet durchs Wasser, Körper noch unten
        this.y = SURFACED - 1.2;
        this.facing = dampAngle(this.facing, Math.atan2(s.x - this.x, s.z - this.z), 2, dt);
        this.x += Math.sin(this.facing) * def.chaseSpeed * 0.7 * dt;
        this.z += Math.cos(this.facing) * def.chaseSpeed * 0.7 * dt;
        if (Math.random() < dt * 10) ctx.effects.splash(this.v.set(this.x + Math.sin(this.facing) * 4, water, this.z + Math.cos(this.facing) * 4), 0.3);
        if (this.phaseTime >= def.warningTime) {
          this.setPhase('emerging');
          if (!this.surfaced) ctx.bus.emit('monsterSpawned', { instanceId: this.id, monsterId: def.id, tier: this.tier.tier });
          this.surfaced = true;
          ctx.effects.splash(this.v.set(this.x, water, this.z), 2);
        }
        break;
      }
      case 'emerging': {
        this.y = SURFACED - 1.2 + 1.2 * smoothstep(0, EMERGE_TIME, this.phaseTime);
        this.cruise(dt, ctx);
        if (this.phaseTime >= EMERGE_TIME) this.setPhase('active');
        break;
      }
      case 'active': {
        const r = this.updateActive(dt, ctx, dist, water);
        glow = r.glow;
        tailRate = r.tail;
        if (this.isDefeated) {
          this.emitDefeated(ctx);
          ctx.effects.hitSparks(this.v.set(this.x, water + 1.5, this.z), '#dff4ff', 2.2);
          ctx.effects.splash(this.v.set(this.x, water, this.z), 2.5);
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
        const k = clamp01(this.phaseTime / RETREAT_TIME);
        this.y = SURFACED + (DEEP - SURFACED) * smoothstep(0.2, 1, k);
        this.pitch += (0.4 - this.pitch) * Math.min(1, dt * 2);
        if (!this.escaped) this.roll = (Math.PI / 2) * smoothstep(0, 0.5, k);
        this.x += Math.sin(this.facing) * 4 * dt;
        this.z += Math.cos(this.facing) * 4 * dt;
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
    this.model.visible = this.phase !== 'warning' || this.phaseTime > 0.2;
    this.root.position.set(this.x, water + this.y + Math.sin(this.time * 1.6) * 0.1, this.z);
    this.root.rotation.set(this.pitch, this.facing, this.roll, 'YXZ');
    if (this.tail) this.tail.rotation.x = Math.sin(this.time * tailRate) * 0.4;
    this.fins.forEach((f, i) => (f.rotation.x = Math.sin(this.time * 1.8 + i) * 0.2));
    for (const m of this.hornMats) m.emissiveIntensity = glow;
    const fx = Math.sin(this.facing);
    const fz = Math.cos(this.facing);
    const top = water + this.y + 0.8;
    this.parts[0]?.position.set(this.x + fx * 2.2, top, this.z + fz * 2.2);
    this.parts[1]?.position.set(this.x - fx * 1.0, top, this.z - fz * 1.0);
    this.updateFlash(dt);
  }

  /** Schwimmt seitlich vor dem Spieler mit. */
  private cruise(dt: number, ctx: MonsterContext): void {
    const def = this.def;
    const s = ctx.surfer;
    const r = this.grace > 0 ? def.preferredDistance + 12 : def.preferredDistance;
    const hx = Math.sin(s.heading);
    const hz = Math.cos(s.heading);
    const tx = s.x + hz * this.side * r * 0.8 + hx * r * 0.6;
    const tz = s.z - hx * this.side * r * 0.8 + hz * r * 0.6;
    const dx = tx - this.x;
    const dz = tz - this.z;
    const d = Math.hypot(dx, dz) || 1;
    const speed = Math.max(def.chaseSpeed * this.tier.speedMul, Math.hypot(s.vx, s.vz) * (d > 6 ? 1.15 : 0.95));
    this.facing = dampAngle(this.facing, d > 3 ? Math.atan2(dx, dz) : s.heading, 2, dt);
    const step = Math.min(d, speed * dt);
    this.x += Math.sin(this.facing) * step;
    this.z += Math.cos(this.facing) * step;
    this.keepClearOfCamera(ctx, speed, dt, 10);
    this.pitch *= Math.exp(-3 * dt);
    this.roll += (Math.sin(this.time * 0.8) * 0.08 - this.roll) * Math.min(1, dt * 2);
    this.y += (SURFACED - this.y) * Math.min(1, dt * 2);
  }

  private startAim(): void {
    this.setMode('aim');
  }

  /** Gibt Leuchten des Stoßzahns und Schwanzschlag zurück. */
  private updateActive(dt: number, ctx: MonsterContext, dist: number, water: number): { glow: number; tail: number } {
    const def = this.def;
    const atk = def.attack;
    const s = ctx.surfer;
    switch (this.mode) {
      case 'cruise': {
        this.cruise(dt, ctx);
        this.telegraph.visible = false;
        this.cooldown -= dt;
        const canAttack = this.grace <= 0 && ctx.run.invulnerable <= 0 && !s.fsm.is('Wipeout');
        if (this.cooldown <= 0 && canAttack && dist < atk.reach) {
          this.chargesLeft = Math.max(1, Math.round(this.param('charges', 1) + (this.tier.tier >= 3 ? 1 : 0)));
          this.startAim();
        }
        return { glow: 0, tail: 2.5 };
      }
      case 'aim': {
        const second = this.chargesLeft < Math.round(this.param('charges', 1) + (this.tier.tier >= 3 ? 1 : 0));
        const windup = atk.windup * this.tier.windupMul * (second ? 0.7 : 1);
        const k = clamp01(this.modeTime / windup);
        const locked = k > 0.62;
        if (!locked) {
          const lead = atk.lead * windup;
          const px = s.x + s.vx * lead;
          const pz = s.z + s.vz * lead;
          const ax = px - this.x;
          const az = pz - this.z;
          const al = Math.hypot(ax, az) || 1;
          this.facing = dampAngle(this.facing, Math.atan2(ax, az), 7, dt);
          this.dirX = Math.sin(this.facing);
          this.dirZ = Math.cos(this.facing);
          this.length = Math.max(this.param('minLength', 55), al + this.param('overshoot', 25));
        }
        // Kopf senkt sich, Körper zittert
        this.pitch = 0.18 * smoothstep(0, 0.4, k);
        this.roll = Math.sin(this.time * 34) * 0.04 * k;
        this.y += (SURFACED + 0.15 - this.y) * Math.min(1, dt * 3);
        const ex = this.x + this.dirX * this.length;
        const ez = this.z + this.dirZ * this.length;
        placeStripe(this.telegraph, this.x, this.z, ex, ez, ctx.world.heightAt((this.x + ex) / 2, (this.z + ez) / 2) + 0.3, atk.radius * 2);
        this.telegraph.visible = true;
        ((this.telegraph.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.4 * Math.sin(this.time * (locked ? 40 : 16));
        if (this.modeTime >= windup) {
          this.travel = 0;
          this.hitDone = false;
          this.setMode('charge');
          ctx.bus.emit('monsterAttack', { monsterId: def.id, kind: 'charge', position: { x: this.x, z: this.z } });
        }
        return { glow: 0.4 + 1.6 * k, tail: 6 };
      }
      case 'charge': {
        const v = this.param('chargeSpeed', 34) * this.tier.speedMul;
        const step = v * dt;
        this.x += this.dirX * step;
        this.z += this.dirZ * step;
        this.travel += step;
        this.pitch *= Math.exp(-6 * dt);
        this.roll *= Math.exp(-6 * dt);
        // Stoßzahn-Spitze und Kopf treffen
        for (const reach of [4.5, 2]) {
          const hx = this.x + this.dirX * reach;
          const hz = this.z + this.dirZ * reach;
          if (!this.hitDone && Math.hypot(s.x - hx, s.z - hz) <= atk.radius) {
            this.hitDone = ctx.hitPlayer(def.id, hx, hz) || this.hitDone;
            if (this.hitDone) this.telegraph.visible = false;
          }
        }
        if (Math.random() < dt * 30) ctx.effects.splash(this.v.set(this.x + this.dirX * 3, water, this.z + this.dirZ * 3), 0.6);
        if (this.travel >= this.length) {
          this.telegraph.visible = false;
          this.chargesLeft--;
          this.turnFrom = this.facing;
          this.setMode('turn');
        }
        return { glow: 2, tail: 16 };
      }
      case 'turn': {
        // Schwerfällig wenden (verwundbar); Stufe 3 stürmt danach gleich zurück
        const T = this.param('turnTime', 2.2) * (this.chargesLeft > 0 ? 0.55 : 1);
        const k = clamp01(this.modeTime / T);
        const target = Math.atan2(s.x - this.x, s.z - this.z);
        let delta = target - this.turnFrom;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        this.facing = this.turnFrom + delta * smoothstep(0, 1, k);
        this.roll = Math.sin(k * Math.PI) * 0.35;
        this.x += Math.sin(this.facing) * 3 * dt;
        this.z += Math.cos(this.facing) * 3 * dt;
        this.y += (SURFACED - this.y) * Math.min(1, dt * 2);
        if (k >= 1) {
          if (this.chargesLeft > 0 && this.grace <= 0 && !s.fsm.is('Wipeout')) this.startAim();
          else {
            this.side = Math.random() < 0.5 ? 1 : -1;
            this.cooldown = ctx.rng.range(atk.cooldown[0], atk.cooldown[1]) * this.tier.windupMul;
            this.setMode('cruise');
          }
        }
        return { glow: 0.3 * (1 - k), tail: 4 };
      }
    }
  }
}
