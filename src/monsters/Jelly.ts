/**
 * Riesenqualle: Vorwarnung = rosa Leuchten unter Wasser. Schwebt langsam heran und lädt einen
 * Stromstoß auf – ein wachsender Ring auf dem Wasser zeigt die Reichweite. Wer drin ist, wird
 * getroffen. Langsam genug, um ihr davonzufahren; ein Salto von oben trifft doppelt.
 *
 * behaviorParams: pulseRadius (m)
 */
import * as THREE from 'three';
import { clamp01, smoothstep } from '../core/math';
import { createGlow } from '../fx/Effects';
import { createRingTelegraph } from '../fx/telegraph';
import { addOutline } from '../fx/toon';
import { Monster, type MonsterContext, type MonsterSpawnArgs } from './Monster';

const EMERGE_TIME = 1.0;
const RETREAT_TIME = 1.6;
const ZAP_TIME = 0.35;

type JellyMode = 'drift' | 'charge' | 'zap';

export class Jelly extends Monster {
  private readonly model: THREE.Object3D;
  private readonly bell: THREE.Object3D | undefined;
  private readonly glow: THREE.Mesh | undefined;
  private readonly telegraph = createRingTelegraph('#fff36b');
  private readonly shadow: THREE.Mesh;
  private mode: JellyMode = 'drift';
  private modeTime = 0;
  private cooldown: number;
  private grace = 0;
  private time = 0;
  private sinkY = -4;
  private surfaced = false;
  private bubbleAcc = 0;
  private readonly v = new THREE.Vector3();

  constructor(args: MonsterSpawnArgs) {
    super(args);
    this.model = args.assets.create(args.def.model, { colors: args.def.colors });
    this.bell = this.model.getObjectByName('bell') ?? undefined;
    this.glow = (this.model.getObjectByName('glow') as THREE.Mesh | undefined) ?? undefined;
    addOutline(this.model, 0.05);
    this.root.add(this.model);
    this.cooldown = this.param('firstCooldown', 2.2);
    this.shadow = createGlow(9, args.def.colors.body);
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
    if (this.mode === 'charge') this.setMode('drift');
    this.telegraph.visible = false;
  }

  private setMode(m: JellyMode): void {
    this.mode = m;
    this.modeTime = 0;
  }

  private get pulseRadius(): number {
    return this.param('pulseRadius', 7);
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
    let glowK = 0.3;

    switch (this.phase) {
      case 'warning': {
        // Rosa Leuchten und Blasen unter Wasser
        this.sinkY = -4;
        this.bubbleAcc += dt * 8;
        while (this.bubbleAcc > 1) {
          this.bubbleAcc -= 1;
          ctx.effects.bubbles(this.v.set(this.x, water, this.z), 2, 3);
        }
        if (this.phaseTime >= def.warningTime) {
          this.setPhase('emerging');
          ctx.effects.splash(this.v.set(this.x, water, this.z), 2);
          if (!this.surfaced) ctx.bus.emit('monsterSpawned', { instanceId: this.id, monsterId: def.id, tier: this.tier.tier });
          this.surfaced = true;
        }
        break;
      }
      case 'emerging': {
        this.sinkY = -4 * (1 - smoothstep(0, EMERGE_TIME, this.phaseTime));
        if (this.phaseTime >= EMERGE_TIME) this.setPhase('active');
        break;
      }
      case 'active': {
        this.sinkY = 0;
        glowK = this.updateActive(dt, ctx, dist, dx / dist, dz / dist);
        if (this.isDefeated) {
          this.emitDefeated(ctx);
          ctx.effects.hitSparks(this.v.set(this.x, water + 1.5, this.z), '#ffd6f0', 2);
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
        this.sinkY = -4 * smoothstep(0, 1, k);
        // Besiegt: fällt in sich zusammen
        if (!this.escaped) this.model.scale.set(1 + k * 0.3, Math.max(0.2, 1 - k * 0.8), 1 + k * 0.3);
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
    const pulse = Math.sin(this.time * 3.2);
    this.root.position.set(this.x, water + this.sinkY + 0.15 + pulse * 0.12, this.z);
    this.root.rotation.y = Math.atan2(dx, dz);
    this.root.visible = this.phase !== 'warning';
    if (this.bell) this.bell.scale.set(1 + pulse * 0.06, 1 - pulse * 0.08, 1 + pulse * 0.06);
    if (this.glow) {
      const m = this.glow.material as THREE.MeshBasicMaterial;
      m.color.set(def.colors.accent).lerp(WHITE, glowK);
      this.glow.scale.setScalar(0.85 + glowK * 0.35);
    }
    this.parts[0]?.position.set(this.x, water + this.sinkY + 1.3, this.z);
    // Leuchten im Wasser (Vorwarnung und unter der Glocke)
    const warnK = this.phase === 'warning' ? smoothstep(0, def.warningTime, this.phaseTime) : 1;
    this.shadow.position.set(this.x, water + 0.06, this.z);
    this.shadow.scale.setScalar(0.6 + warnK * 0.5 + Math.sin(this.time * 6) * 0.05);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = (this.phase === 'retreating' ? 0.3 : 1) * warnK;
    this.updateFlash(dt);
  }

  /** Gibt die Leuchtstärke 0..1 zurück. */
  private updateActive(dt: number, ctx: MonsterContext, dist: number, nx: number, nz: number): number {
    const def = this.def;
    const atk = def.attack;
    const s = ctx.surfer;
    const speed = def.chaseSpeed * this.tier.speedMul;
    const water = ctx.world.heightAt(this.x, this.z);

    // Langsam heranschweben (in der Schonfrist zurückweichen)
    if (this.mode !== 'zap') {
      const keep = this.grace > 0 ? def.preferredDistance + 10 : def.preferredDistance;
      const dir = dist > keep ? 1 : dist < keep * 0.7 ? -0.6 : 0;
      this.x += nx * speed * dir * dt;
      this.z += nz * speed * dir * dt;
      this.keepClearOfCamera(ctx, speed, dt);
    }

    switch (this.mode) {
      case 'drift': {
        this.telegraph.visible = false;
        this.cooldown -= dt;
        const canAttack = this.grace <= 0 && ctx.run.invulnerable <= 0 && !s.fsm.is('Wipeout');
        if (this.cooldown <= 0 && canAttack && dist < atk.reach) this.setMode('charge');
        return 0.3;
      }
      case 'charge': {
        const windup = atk.windup * this.tier.windupMul;
        const k = clamp01(this.modeTime / windup);
        // Stromring wächst bis zur Reichweite
        this.telegraph.visible = true;
        this.telegraph.position.set(this.x, water + 0.12, this.z);
        this.telegraph.scale.setScalar(Math.max(0.5, this.pulseRadius * k));
        ((this.telegraph.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.5 * Math.sin(this.time * 20);
        if (this.modeTime >= windup) {
          this.setMode('zap');
          this.telegraph.scale.setScalar(this.pulseRadius);
          ctx.effects.hitSparks(this.v.set(this.x, water + 1, this.z), '#fff36b', 1.6);
          if (dist <= this.pulseRadius) ctx.hitPlayer(def.id, this.x, this.z);
        }
        return 0.3 + k * 0.7;
      }
      case 'zap': {
        // Kurzer heller Blitz, dann wieder treiben
        this.telegraph.visible = Math.floor(this.modeTime * 30) % 2 === 0;
        if (this.modeTime >= ZAP_TIME) {
          this.telegraph.visible = false;
          this.cooldown = ctx.rng.range(atk.cooldown[0], atk.cooldown[1]) * this.tier.windupMul;
          this.setMode('drift');
        }
        return 1;
      }
    }
  }
}

const WHITE = new THREE.Color('#ffffff');
