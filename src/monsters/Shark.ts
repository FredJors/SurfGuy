/**
 * Riffhai: Vorwarnung = Flosse kreist. Dann umkreist er den Spieler, zielt (roter Streifen auf
 * dem Wasser zeigt die Bahn) und rammt blitzschnell. Danach ist er kurz benommen.
 * Ausweichen: seitlich wegfahren oder hoch genug springen.
 *
 * behaviorParams: chargeSpeed (m/s), overshoot (m), recoverTime (s), orbitSpeed (m/s)
 */
import * as THREE from 'three';
import { clamp01, dampAngle, smoothstep } from '../core/math';
import { createBlobShadow } from '../fx/Effects';
import { createStripeTelegraph, placeStripe } from '../fx/telegraph';
import { addOutline } from '../fx/toon';
import { Monster, type MonsterContext, type MonsterSpawnArgs } from './Monster';

const EMERGE_TIME = 0.6;
const RETREAT_TIME = 1.4;
/** Tiefe: nur die Flosse schaut heraus / Rücken sichtbar / Rammen */
const FIN_ONLY = -1.15;
const SURFACED = -0.5;
const CHARGING = -0.15;

type SharkMode = 'circle' | 'aim' | 'charge' | 'recover';

export class Shark extends Monster {
  private readonly model: THREE.Object3D;
  private readonly tail: THREE.Object3D | undefined;
  private readonly telegraph = createStripeTelegraph();
  private readonly shadow: THREE.Mesh;
  private mode: SharkMode = 'circle';
  private modeTime = 0;
  private cooldown: number;
  private grace = 0;
  private time = 0;
  private sinkY = FIN_ONLY;
  private facing = 0;
  private roll = 0;
  private orbitAngle = 0;
  private orbitDir: 1 | -1 = 1;
  private surfaced = false;
  // Rammen
  private chargeDirX = 0;
  private chargeDirZ = 1;
  private chargeLength = 0;
  private chargeTravel = 0;
  private hitDone = false;
  private readonly v = new THREE.Vector3();

  constructor(args: MonsterSpawnArgs) {
    super(args);
    this.model = args.assets.create(args.def.model, { colors: args.def.colors });
    this.tail = this.model.getObjectByName('tail') ?? undefined;
    addOutline(this.model, 0.05);
    this.root.add(this.model);
    this.cooldown = this.param('firstCooldown', 2.5);
    this.orbitDir = Math.random() < 0.5 ? 1 : -1;
    this.shadow = createBlobShadow(5);
    (this.shadow.material as THREE.MeshBasicMaterial).color.set('#0a1a40');
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

  override onPlayerHit(): void {
    this.grace = this.def.attack.graceAfterHit;
    if (this.mode === 'aim' || this.mode === 'charge') this.setMode('recover');
    this.telegraph.visible = false;
  }

  private setMode(m: SharkMode): void {
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
    const dx = s.x - this.x;
    const dz = s.z - this.z;
    const dist = Math.hypot(dx, dz) || 1;
    const water = ctx.world.heightAt(this.x, this.z);
    const speed = this.param('orbitSpeed', def.chaseSpeed) * this.tier.speedMul;
    let tailRate = 6;

    switch (this.phase) {
      case 'warning': {
        // Nur die Flosse: kreist an der Auftauchstelle
        this.sinkY = FIN_ONLY;
        const a = this.time * 1.4;
        this.x += Math.cos(a) * 5 * dt;
        this.z += Math.sin(a) * 5 * dt;
        this.facing = Math.atan2(Math.cos(a), Math.sin(a));
        if (this.phaseTime >= def.warningTime) {
          this.setPhase('emerging');
          if (!this.surfaced) ctx.bus.emit('monsterSpawned', { instanceId: this.id, monsterId: def.id, tier: this.tier.tier });
          this.surfaced = true;
          this.orbitAngle = Math.atan2(this.z - s.z, this.x - s.x);
        }
        break;
      }
      case 'emerging': {
        this.sinkY = FIN_ONLY + (SURFACED - FIN_ONLY) * smoothstep(0, EMERGE_TIME, this.phaseTime);
        if (this.phaseTime >= EMERGE_TIME) this.setPhase('active');
        break;
      }
      case 'active': {
        tailRate = this.updateActive(dt, ctx, speed, dist);
        if (this.isDefeated) {
          this.emitDefeated(ctx);
          ctx.effects.hitSparks(this.v.set(this.x, water + 1, this.z), '#ffd6f0', 2);
          ctx.effects.splash(this.v.set(this.x, water, this.z), 2.5);
          this.telegraph.visible = false;
          this.setPhase('retreating');
        } else if (dist > def.escapeDistance) {
          this.escaped = true;
          ctx.bus.emit('monsterEscaped', { instanceId: this.id, monsterId: def.id, points: def.escapePoints });
          this.telegraph.visible = false;
          this.setPhase('retreating');
        }
        break;
      }
      case 'retreating': {
        const k = clamp01(this.phaseTime / RETREAT_TIME);
        this.sinkY = SURFACED - 2.8 * smoothstep(0, 1, k);
        // Besiegt: Bauch nach oben
        if (!this.escaped) this.roll = Math.PI * smoothstep(0, 0.5, k);
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
    const bob = Math.sin(this.time * 2.1) * 0.08;
    this.root.position.set(this.x, water + this.sinkY + bob, this.z);
    this.root.rotation.set(0, this.facing, this.roll, 'YXZ');
    if (this.tail) this.tail.rotation.y = Math.sin(this.time * tailRate) * 0.45;
    const fx = Math.sin(this.facing);
    const fz = Math.cos(this.facing);
    this.parts[0]?.position.set(this.x + fx * 1.2, water + this.sinkY + 0.9, this.z + fz * 1.2);
    this.shadow.position.set(this.x, water + 0.05, this.z);
    this.shadow.rotation.set(-Math.PI / 2, 0, -this.facing);
    this.shadow.scale.set(0.8, 1.6, 1);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = this.phase === 'warning' ? 0.6 : 0.35;
    this.updateFlash(dt);
  }

  /** Gibt die Schwanzschlag-Frequenz zurück. */
  private updateActive(dt: number, ctx: MonsterContext, speed: number, dist: number): number {
    const def = this.def;
    const atk = def.attack;
    const s = ctx.surfer;
    const radius = def.preferredDistance;

    switch (this.mode) {
      case 'circle': {
        this.sinkY += (SURFACED - this.sinkY) * Math.min(1, dt * 3);
        this.roll *= Math.exp(-4 * dt);
        // Um den Spieler kreisen; während der Schonfrist weiter weg
        const r = this.grace > 0 ? radius + 10 : radius;
        this.orbitAngle += ((speed / r) * this.orbitDir * dt);
        const tx = s.x + Math.cos(this.orbitAngle) * r;
        const tz = s.z + Math.sin(this.orbitAngle) * r;
        const mx = tx - this.x;
        const mz = tz - this.z;
        const md = Math.hypot(mx, mz);
        const step = Math.min(md, speed * 1.8 * dt);
        if (md > 0.01) {
          this.x += (mx / md) * step;
          this.z += (mz / md) * step;
          this.facing = dampAngle(this.facing, Math.atan2(mx, mz), 5, dt);
        }
        this.keepClearOfCamera(ctx, speed, dt);
        this.cooldown -= dt;
        const canAttack = this.grace <= 0 && ctx.run.invulnerable <= 0 && !s.fsm.is('Wipeout');
        if (this.cooldown <= 0 && canAttack && dist < atk.reach) this.setMode('aim');
        return 7;
      }
      case 'aim': {
        const windup = atk.windup * this.tier.windupMul;
        // Ziel vorhalten und Bahn anzeigen
        const lead = atk.lead * windup;
        const px = s.x + s.vx * lead;
        const pz = s.z + s.vz * lead;
        let ax = px - this.x;
        let az = pz - this.z;
        const al = Math.hypot(ax, az) || 1;
        ax /= al;
        az /= al;
        this.facing = dampAngle(this.facing, Math.atan2(ax, az), 8, dt);
        this.chargeDirX = Math.sin(this.facing);
        this.chargeDirZ = Math.cos(this.facing);
        this.chargeLength = al + this.param('overshoot', 12);
        this.sinkY += (CHARGING - this.sinkY) * Math.min(1, dt * 4);
        this.roll = Math.sin(this.time * 30) * 0.05 * clamp01(this.modeTime / windup);
        const ex = this.x + this.chargeDirX * this.chargeLength;
        const ez = this.z + this.chargeDirZ * this.chargeLength;
        placeStripe(this.telegraph, this.x, this.z, ex, ez, ctx.world.heightAt((this.x + ex) / 2, (this.z + ez) / 2) + 0.3, atk.radius * 2);
        this.telegraph.visible = true;
        ((this.telegraph.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.4 * Math.sin(this.time * 18);
        if (this.modeTime >= windup) {
          this.chargeTravel = 0;
          this.hitDone = false;
          this.setMode('charge');
        }
        return 14;
      }
      case 'charge': {
        const v = this.param('chargeSpeed', 24) * this.tier.speedMul;
        const step = v * dt;
        this.x += this.chargeDirX * step;
        this.z += this.chargeDirZ * step;
        this.chargeTravel += step;
        // Kopf trifft den Spieler?
        const hx = this.x + this.chargeDirX * 2;
        const hz = this.z + this.chargeDirZ * 2;
        if (!this.hitDone && Math.hypot(s.x - hx, s.z - hz) <= atk.radius) {
          this.hitDone = ctx.hitPlayer(this.def.id, hx, hz) || this.hitDone;
          if (this.hitDone) this.telegraph.visible = false;
        }
        if (Math.random() < dt * 25) ctx.effects.splash(this.v.set(this.x, ctx.world.heightAt(this.x, this.z), this.z), 0.5);
        if (this.chargeTravel >= this.chargeLength) {
          this.telegraph.visible = false;
          this.setMode('recover');
        }
        return 22;
      }
      case 'recover': {
        // Benommen: wackelt, taucht etwas ab, dann wieder kreisen
        this.sinkY += (SURFACED - this.sinkY) * Math.min(1, dt * 2);
        this.roll = Math.sin(this.modeTime * 9) * 0.35 * (1 - clamp01(this.modeTime / this.param('recoverTime', 1.4)));
        this.telegraph.visible = false;
        if (this.modeTime >= this.param('recoverTime', 1.4)) {
          this.orbitAngle = Math.atan2(this.z - s.z, this.x - s.x);
          this.orbitDir = Math.random() < 0.5 ? 1 : -1;
          this.cooldown = ctx.rng.range(atk.cooldown[0], atk.cooldown[1]) * this.tier.windupMul;
          this.setMode('circle');
        }
        return 3;
      }
    }
  }
}
