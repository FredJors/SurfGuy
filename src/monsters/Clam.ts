/**
 * Riesenmuschel (Kapitel 2): hüpft mit klatschenden Schalen heran, klappt dann auf und spuckt
 * glühende Lava-Perlen im Bogen (rote Ringe zeigen den Einschlag). Geschlossen prallen Tricks
 * fast wirkungslos ab – offen ist sie verwundbar.
 *
 * behaviorParams: shots (je Salve, +1 pro Stufe), shotInterval (s), shotRadius (m),
 *                 openTime (s), closedArmor (Schadensanteil geschlossen), hopDistance (m),
 *                 firstCooldown (s)
 */
import * as THREE from 'three';
import { clamp01, dampAngle, smoothstep } from '../core/math';
import { createGlow } from '../fx/Effects';
import { createRingTelegraph } from '../fx/telegraph';
import { addOutline } from '../fx/toon';
import { Monster, type MonsterContext, type MonsterPart, type MonsterSpawnArgs } from './Monster';
import type { GameEventBus } from '../core/events';

const EMERGE_TIME = 0.9;
const RETREAT_TIME = 1.4;
const OPEN_TIME = 0.45;
const CLOSE_TIME = 0.35;
const MAX_OPEN = 0.8;

type ClamMode = 'closed' | 'opening' | 'spitting' | 'open' | 'closing';

interface Shot {
  mesh: THREE.Mesh;
  telegraph: THREE.Group;
  sx: number;
  sy: number;
  sz: number;
  tx: number;
  tz: number;
  peak: number;
  t: number;
  dur: number;
}

const shotGeo = new THREE.SphereGeometry(0.55, 14, 10);
const shotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a1a').multiplyScalar(2.4) });

export class Clam extends Monster {
  private readonly model: THREE.Object3D;
  private readonly lid: THREE.Object3D | undefined;
  private readonly pearl: THREE.Mesh | undefined;
  private readonly glow: THREE.Mesh;
  private readonly shots: Shot[] = [];
  private mode: ClamMode = 'closed';
  private modeTime = 0;
  private cooldown: number;
  private grace = 0;
  private time = 0;
  private sinkY = -4;
  private open = 0;
  private yaw = 0;
  private hop = 0;
  private fired = 0;
  private shotTimer = 0;
  private surfaced = false;
  private readonly v = new THREE.Vector3();

  constructor(args: MonsterSpawnArgs) {
    super(args);
    this.model = args.assets.create(args.def.model, { colors: args.def.colors });
    this.lid = this.model.getObjectByName('lid') ?? undefined;
    this.pearl = (this.model.getObjectByName('pearl') as THREE.Mesh | undefined) ?? undefined;
    this.model.scale.setScalar(1.3);
    addOutline(this.model, 0.05);
    this.root.add(this.model);
    this.cooldown = this.param('firstCooldown', 1.5);
    this.glow = createGlow(8, args.def.colors.accent);
    this.collectFlashMaterials();
  }

  override attach(parent: THREE.Object3D): void {
    parent.add(this.root, this.glow);
  }

  override dispose(): void {
    super.dispose();
    this.glow.removeFromParent();
    for (const s of this.shots) {
      s.mesh.removeFromParent();
      s.telegraph.removeFromParent();
    }
    this.shots.length = 0;
  }

  override onPlayerHit(): void {
    this.grace = this.def.attack.graceAfterHit;
  }

  /** Ist die Schale offen genug, um verwundbar zu sein? */
  get isOpen(): boolean {
    return this.open > 0.35;
  }

  /** Geschlossen prallen Treffer fast wirkungslos ab. */
  override takeHit(part: MonsterPart, damage: number, ctx: { bus: GameEventBus }): number {
    if (!this.isOpen && this.isTargetable) {
      ctx.bus.emit('monsterAttack', { monsterId: this.def.id, kind: 'clonk', position: { x: this.x, z: this.z } });
      return super.takeHit(part, Math.max(1, Math.round(damage * this.param('closedArmor', 0.2))), ctx);
    }
    return super.takeHit(part, damage, ctx);
  }

  private setMode(m: ClamMode): void {
    this.mode = m;
    this.modeTime = 0;
  }

  private get shotsPerVolley(): number {
    return Math.round(this.param('shots', 2)) + this.tier.tier - 1;
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
    let glowK = 0.4;

    switch (this.phase) {
      case 'warning': {
        this.sinkY = -4;
        if (Math.random() < dt * 8) ctx.effects.bubbles(this.v.set(this.x, water, this.z), 2, 2.5);
        glowK = smoothstep(0, def.warningTime, this.phaseTime);
        this.yaw = Math.atan2(s.x - this.x, s.z - this.z);
        if (this.phaseTime >= def.warningTime) {
          this.setPhase('emerging');
          ctx.effects.splash(this.v.set(this.x, water, this.z), 2.2);
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
        glowK = this.updateActive(dt, ctx, dist);
        if (this.isDefeated) {
          this.emitDefeated(ctx);
          ctx.effects.hitSparks(this.v.set(this.x, water + 1.5, this.z), '#fff4c2', 2.2);
          this.setPhase('retreating');
        } else if (dist > def.escapeDistance) {
          this.escaped = true;
          ctx.bus.emit('monsterEscaped', { instanceId: this.id, monsterId: def.id, points: def.escapePoints });
          this.setPhase('retreating');
        }
        break;
      }
      case 'retreating': {
        const k = clamp01(this.phaseTime / RETREAT_TIME);
        this.sinkY = -4.5 * smoothstep(0.2, 1, k);
        // Besiegt: klappt weit auf und versinkt; entkommen: schließt sich
        this.open += ((this.escaped ? 0 : 1.1) - this.open) * Math.min(1, dt * 4);
        glowK = 0.3 * (1 - k);
        if (k >= 1) this.setPhase('gone');
        break;
      }
      case 'gone':
        return;
      case 'diving':
        this.setPhase('active');
        break;
    }

    this.updateShots(dt, ctx);

    // --- Darstellung ---
    const hopY = Math.max(0, Math.sin(this.hop * Math.PI * 2)) * 0.9;
    this.root.position.set(this.x, water + this.sinkY + 1.05 + hopY + Math.sin(this.time * 1.7) * 0.08, this.z);
    this.root.rotation.set(Math.sin(this.time * 1.3) * 0.04 - hopY * 0.12, this.yaw, Math.sin(this.time * 1.1) * 0.04);
    this.root.visible = this.phase !== 'warning';
    if (this.lid) this.lid.rotation.x = -this.open;
    if (this.pearl) {
      const m = this.pearl.material as THREE.MeshToonMaterial;
      m.emissiveIntensity = 0.25 + this.open * 0.6 + (this.mode === 'spitting' ? 0.3 * Math.sin(this.time * 20) : 0);
    }
    this.parts[0]?.position.set(this.x, water + this.sinkY + 1.3, this.z);
    this.glow.position.set(this.x, water + 0.06, this.z);
    this.glow.scale.setScalar(0.7 + glowK * 0.4);
    (this.glow.material as THREE.MeshBasicMaterial).opacity = glowK * (this.phase === 'retreating' ? 0.5 : 0.8);
    this.updateFlash(dt);
  }

  /** Gibt die Leuchtstärke 0..1 zurück. */
  private updateActive(dt: number, ctx: MonsterContext, dist: number): number {
    const def = this.def;
    const atk = def.attack;
    const s = ctx.surfer;
    this.yaw = dampAngle(this.yaw, Math.atan2(s.x - this.x, s.z - this.z), 2.5, dt);
    switch (this.mode) {
      case 'closed': {
        // Weit weg: mit klatschenden Schalen heranhüpfen
        const far = dist > this.param('hopDistance', 26);
        if (far) {
          this.hop = (this.hop + dt * 1.6) % 1;
          const speed = def.chaseSpeed * this.tier.speedMul * (0.4 + Math.max(0, Math.sin(this.hop * Math.PI * 2)));
          this.x += Math.sin(this.yaw) * speed * dt;
          this.z += Math.cos(this.yaw) * speed * dt;
          this.open = 0.3 * Math.max(0, Math.sin(this.hop * Math.PI * 2 + 1.2));
          if (this.hop < dt * 1.6) ctx.effects.splash(this.v.set(this.x, ctx.world.heightAt(this.x, this.z), this.z), 0.8);
        } else {
          this.hop += (0 - this.hop) * Math.min(1, dt * 6);
          this.open += (0 - this.open) * Math.min(1, dt * 8);
        }
        this.cooldown -= dt;
        const canAttack = this.grace <= 0 && ctx.run.invulnerable <= 0 && !s.fsm.is('Wipeout');
        if (this.cooldown <= 0 && canAttack && dist < atk.reach) this.setMode('opening');
        return 0.35;
      }
      case 'opening': {
        this.open = MAX_OPEN * smoothstep(0, OPEN_TIME, this.modeTime);
        if (this.modeTime >= OPEN_TIME) {
          this.fired = 0;
          this.shotTimer = atk.windup * this.tier.windupMul;
          this.setMode('spitting');
        }
        return 0.6;
      }
      case 'spitting': {
        this.open = MAX_OPEN + Math.sin(this.time * 14) * 0.05;
        this.shotTimer -= dt;
        if (this.shotTimer <= 0 && this.fired < this.shotsPerVolley) {
          this.spit(ctx);
          this.fired++;
          this.shotTimer = this.param('shotInterval', 0.55);
        }
        if (this.fired >= this.shotsPerVolley && this.shotTimer <= 0) this.setMode('open');
        return 0.9;
      }
      case 'open': {
        // Verwundbar: offen und leicht keuchend
        this.open = MAX_OPEN * (0.9 + 0.1 * Math.sin(this.time * 3));
        if (this.modeTime >= this.param('openTime', 1.6)) this.setMode('closing');
        return 0.7;
      }
      case 'closing': {
        this.open = MAX_OPEN * (1 - smoothstep(0, CLOSE_TIME, this.modeTime));
        if (this.modeTime >= CLOSE_TIME) {
          this.open = 0;
          this.cooldown = ctx.rng.range(atk.cooldown[0], atk.cooldown[1]) * this.tier.windupMul;
          this.setMode('closed');
          ctx.effects.splash(this.v.set(this.x, ctx.world.heightAt(this.x, this.z), this.z), 0.6);
        }
        return 0.4;
      }
    }
  }

  /** Lava-Perle auf den Spieler (vorgehalten) spucken. */
  private spit(ctx: MonsterContext): void {
    const s = ctx.surfer;
    const atk = this.def.attack;
    const water = ctx.world.heightAt(this.x, this.z);
    const sx = this.x + Math.sin(this.yaw) * 0.8;
    const sz = this.z + Math.cos(this.yaw) * 0.8;
    const sy = water + 2;
    const tx = s.x + s.vx * atk.lead + ctx.rng.range(-2, 2);
    const tz = s.z + s.vz * atk.lead + ctx.rng.range(-2, 2);
    const d = Math.hypot(tx - sx, tz - sz);
    const mesh = new THREE.Mesh(shotGeo, shotMat);
    const telegraph = createRingTelegraph('#ff3b30');
    telegraph.visible = true;
    telegraph.position.set(tx, ctx.world.heightAt(tx, tz) + 0.12, tz);
    telegraph.scale.setScalar(this.param('shotRadius', 2.8));
    this.root.parent?.add(mesh, telegraph);
    this.shots.push({ mesh, telegraph, sx, sy, sz, tx, tz, peak: 4 + d * 0.15, t: 0, dur: Math.max(0.9, Math.min(1.7, d / 24)) });
    ctx.bus.emit('monsterAttack', { monsterId: this.def.id, kind: 'spit', position: { x: this.x, z: this.z } });
  }

  private updateShots(dt: number, ctx: MonsterContext): void {
    const s = ctx.surfer;
    const R = this.param('shotRadius', 2.8);
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const sh = this.shots[i]!;
      sh.t += dt;
      const k = Math.min(1, sh.t / sh.dur);
      const ground = ctx.world.heightAt(sh.tx, sh.tz);
      sh.mesh.position.set(sh.sx + (sh.tx - sh.sx) * k, sh.sy + (ground - sh.sy) * k + Math.sin(Math.PI * k) * sh.peak, sh.sz + (sh.tz - sh.sz) * k);
      sh.telegraph.scale.setScalar(R * (0.85 + 0.15 * Math.sin(sh.t * (8 + k * 20))));
      if (Math.random() < dt * 20) {
        ctx.effects.particles.emit({ position: sh.mesh.position, count: 1, spread: 0.3, up: 0.5, life: [0.25, 0.5], size: [0.3, 0.5], color: '#ff9a3c', gravity: -1, drag: 2 });
      }
      if (k >= 1) {
        ctx.effects.splash(this.v.set(sh.tx, ground, sh.tz), 1.4);
        ctx.effects.hitSparks(this.v.set(sh.tx, ground + 0.5, sh.tz), '#ff7a1a', 1);
        ctx.bus.emit('monsterAttack', { monsterId: this.def.id, kind: 'impact', position: { x: sh.tx, z: sh.tz } });
        if (Math.hypot(s.x - sh.tx, s.z - sh.tz) <= R) ctx.hitPlayer(this.def.id, sh.tx, sh.tz);
        sh.mesh.removeFromParent();
        sh.telegraph.removeFromParent();
        this.shots.splice(i, 1);
      }
    }
  }
}
