/**
 * Endgegner „Wächter der Insel“: riesige wütende Krabbe auf einer Sandbank vor dem Riff.
 *
 * Phase 1: wirft Felsbrocken nach dem Spieler (rote Zielmarkierung auf dem Wasser zeigt den
 *          Einschlag; ausweichen oder hoch genug springen).
 * Phase 2 (ab halber Kraft): wirft schneller und stampft zusätzlich auf den Sand → eine
 *          Ringwelle läuft übers Meer und trifft, wer nicht drüberspringt.
 * Schaden nimmt sie nur durch Tricks (wie alle Monster).
 *
 * behaviorParams: throwRange, rockRadius, ringSpeed, ringRange, ringDodgeHeight
 */
import * as THREE from 'three';
import { clamp01, smoothstep } from '../core/math';
import { createRingTelegraph } from '../fx/telegraph';
import { addOutline, enableShadows, toonMaterial } from '../fx/toon';
import { Monster, type MonsterContext, type MonsterSpawnArgs } from './Monster';

const RISE_TIME = 2.2;
const RETREAT_TIME = 3;
const STOMP_WINDUP = 1.1;

interface Rock {
  mesh: THREE.Object3D;
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

interface Ring {
  mesh: THREE.Mesh;
  radius: number;
  hitDone: boolean;
}

export class Crab extends Monster {
  private readonly model: THREE.Object3D;
  private readonly body: THREE.Object3D | undefined;
  private readonly clawL: THREE.Object3D | undefined;
  private readonly clawR: THREE.Object3D | undefined;
  private readonly pincers: THREE.Object3D[] = [];
  private readonly legs: THREE.Object3D[] = [];
  private readonly sandbank: THREE.Mesh;
  private readonly rocks: Rock[] = [];
  private readonly rings: Ring[] = [];
  private readonly rockGeo = new THREE.DodecahedronGeometry(1.3, 0);
  private readonly rockMat = toonMaterial('#7a6a78');
  private readonly ringMat = new THREE.MeshBasicMaterial({ color: '#dff8ff', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  private readonly ringGeo = new THREE.CylinderGeometry(1, 1, 1, 64, 1, true);
  private throwTimer = 3;
  private stompTimer = 4;
  private windup = 0;
  private windupKind: 'throw' | 'stomp' | null = null;
  private throwSide = 1;
  private grace = 0;
  private time = 0;
  private sinkY = -9;
  private yaw = 0;
  /** Phase 2 erreicht (ab halber Kraft) */
  enraged = false;
  private readonly v = new THREE.Vector3();

  constructor(args: MonsterSpawnArgs) {
    super(args);
    this.model = args.assets.create(args.def.model, { colors: args.def.colors });
    this.body = this.model.getObjectByName('body') ?? undefined;
    this.clawL = this.model.getObjectByName('clawL') ?? undefined;
    this.clawR = this.model.getObjectByName('clawR') ?? undefined;
    for (const n of ['pincerL', 'pincerR']) {
      const p = this.model.getObjectByName(n);
      if (p) this.pincers.push(p);
    }
    for (const side of ['L', 'R']) {
      for (let i = 0; i < 3; i++) {
        const l = this.model.getObjectByName(`leg${side}${i}`);
        if (l) this.legs.push(l);
      }
    }
    addOutline(this.model, 0.09);
    this.root.add(this.model);
    // Sandbank unter der Krabbe
    this.sandbank = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), toonMaterial('#f2d38a'));
    this.sandbank.scale.set(15, 2.2, 13);
    addOutline(this.sandbank, 0.08);
    enableShadows(this.sandbank, false, true);
    this.collectFlashMaterials();
  }

  override attach(parent: THREE.Object3D): void {
    parent.add(this.root, this.sandbank);
  }

  override dispose(): void {
    super.dispose();
    this.sandbank.removeFromParent();
    for (const r of this.rocks) {
      r.mesh.removeFromParent();
      r.telegraph.removeFromParent();
    }
    for (const r of this.rings) r.mesh.removeFromParent();
  }

  override onPlayerHit(): void {
    this.grace = this.def.attack.graceAfterHit;
  }

  /** Abstand der Ringwelle zum Spieler (für den HUD-Hinweis); Infinity = keine Welle unterwegs. */
  ringDistanceTo(x: number, z: number): number {
    const d = Math.hypot(x - this.x, z - this.z);
    let best = Infinity;
    for (const r of this.rings) if (!r.hitDone && r.radius < d) best = Math.min(best, d - r.radius);
    return best;
  }

  update(dt: number, ctx: MonsterContext): void {
    this.time += dt;
    this.phaseTime += dt;
    this.grace = Math.max(0, this.grace - dt);
    const def = this.def;
    const s = ctx.surfer;
    const dx = s.x - this.x;
    const dz = s.z - this.z;
    const dist = Math.hypot(dx, dz) || 1;
    const water = ctx.world.heightAt(this.x, this.z);

    switch (this.phase) {
      case 'warning': {
        // Sandbank hebt sich, Blasen steigen auf
        const k = clamp01(this.phaseTime / def.warningTime);
        this.sinkY = -9;
        this.sandbank.position.set(this.x, water - 2.2 + k * 2.4, this.z);
        if (Math.random() < dt * 30) ctx.effects.bubbles(this.v.set(this.x + (Math.random() - 0.5) * 20, water, this.z + (Math.random() - 0.5) * 20), 3, 4);
        if (this.phaseTime >= def.warningTime) {
          this.setPhase('emerging');
          ctx.effects.splash(this.v.set(this.x, water, this.z), 4);
          ctx.bus.emit('monsterSpawned', { instanceId: this.id, monsterId: def.id, tier: this.tier.tier });
          ctx.bus.emit('bossEvent', { kind: 'awaken', position: { x: this.x, z: this.z } });
        }
        break;
      }
      case 'emerging': {
        this.sinkY = -9 * (1 - smoothstep(0, RISE_TIME, this.phaseTime));
        if (this.phaseTime >= RISE_TIME) this.setPhase('active');
        break;
      }
      case 'active': {
        this.sinkY = 0;
        this.updateActive(dt, ctx, dist);
        if (this.isDefeated) {
          this.emitDefeated(ctx);
          ctx.bus.emit('bossEvent', { kind: 'defeated', position: { x: this.x, z: this.z } });
          ctx.effects.hitSparks(this.v.set(this.x, water + 6, this.z), '#ffd23f', 3);
          this.setPhase('retreating');
        }
        break;
      }
      case 'retreating': {
        // Kippt um und versinkt samt Sandbank
        const k = clamp01(this.phaseTime / RETREAT_TIME);
        this.sinkY = -10 * smoothstep(0.3, 1, k);
        this.model.rotation.z = Math.PI * 0.55 * smoothstep(0, 0.4, k);
        this.sandbank.position.y = water + 0.2 - 3 * smoothstep(0.4, 1, k);
        if (k >= 1) this.setPhase('gone');
        break;
      }
      case 'gone':
        return;
      case 'diving':
        this.setPhase('active');
        break;
    }

    this.updateProjectiles(dt, ctx);

    // --- Darstellung ---
    if (this.phase !== 'retreating' && this.phase !== 'warning') this.sandbank.position.set(this.x, water + 0.2, this.z);
    // Zum Spieler drehen (Krabben drehen träge)
    const target = Math.atan2(dx, dz);
    let diff = target - this.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.yaw += diff * Math.min(1, dt * 1.5);
    const sway = Math.sin(this.time * 1.3) * 0.8;
    const stompLift = this.windupKind === 'stomp' ? smoothstep(0, STOMP_WINDUP, STOMP_WINDUP - this.windup) * 2.2 : 0;
    this.root.position.set(this.x + Math.cos(this.yaw) * sway, water + 1.6 + this.sinkY + stompLift, this.z - Math.sin(this.yaw) * sway);
    this.root.rotation.y = this.yaw;
    this.root.visible = this.phase !== 'warning';
    if (this.body) this.body.rotation.z = Math.sin(this.time * 2.6) * 0.04;
    // Scheren: drohen; beim Werfen hoch
    const throwK = this.windupKind === 'throw' ? 1 - this.windup / (this.def.attack.windup * this.tier.windupMul) : 0;
    if (this.clawL) this.clawL.rotation.x = -0.25 + Math.sin(this.time * 3) * 0.12 - (this.throwSide < 0 ? throwK * 1.1 : 0);
    if (this.clawR) this.clawR.rotation.x = -0.25 + Math.sin(this.time * 3 + 1) * 0.12 - (this.throwSide > 0 ? throwK * 1.1 : 0);
    const snap = Math.abs(Math.sin(this.time * (this.enraged ? 9 : 5)));
    for (const p of this.pincers) p.rotation.x = -0.15 - snap * 0.35;
    this.legs.forEach((l, i) => (l.rotation.x = Math.sin(this.time * 4 + i * 1.3) * 0.12));
    // Wut: Dampf steigt aus dem Panzer
    if (this.enraged && this.phase === 'active' && Math.random() < dt * 14) {
      ctx.effects.particles.emit({
        position: this.v.set(this.x + (Math.random() - 0.5) * 6, water + 7, this.z + (Math.random() - 0.5) * 5),
        count: 2,
        spread: 0.8,
        up: 3,
        life: [0.8, 1.4],
        size: [1, 1.8],
        color: '#ffe0d6',
        gravity: -2,
        drag: 1,
        grow: 1.2,
      });
    }

    // Trefferpunkte: Kopf/Panzer und die beiden Scheren
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const y = water + 4;
    this.parts[0]?.position.set(this.x, y, this.z);
    this.parts[1]?.position.set(this.x + fx * 5 + fz * 5, y - 1, this.z + fz * 5 - fx * 5);
    this.parts[2]?.position.set(this.x + fx * 5 - fz * 5, y - 1, this.z + fz * 5 + fx * 5);
    this.updateFlash(dt);
  }

  private updateActive(dt: number, ctx: MonsterContext, dist: number): void {
    const def = this.def;
    const atk = def.attack;
    if (!this.enraged && this.hp <= this.maxHp * 0.5) {
      this.enraged = true;
      this.stompTimer = 1.5;
      ctx.bus.emit('bossEvent', { kind: 'enrage', position: { x: this.x, z: this.z } });
    }
    const canAttack = this.grace <= 0 && ctx.run.invulnerable <= 0 && !ctx.surfer.fsm.is('Wipeout');

    if (this.windupKind) {
      this.windup -= dt;
      if (this.windup <= 0) {
        if (this.windupKind === 'throw') this.throwRock(ctx);
        else this.stomp(ctx);
        this.windupKind = null;
      }
      return;
    }

    this.throwTimer -= dt;
    this.stompTimer -= dt;
    if (this.enraged && this.stompTimer <= 0 && dist < this.param('ringRange', 150)) {
      this.windupKind = 'stomp';
      this.windup = STOMP_WINDUP;
      this.stompTimer = ctx.rng.range(5, 7);
      return;
    }
    if (this.throwTimer <= 0 && canAttack && dist < this.param('throwRange', 95)) {
      this.windupKind = 'throw';
      this.windup = atk.windup * this.tier.windupMul;
      this.throwSide = ctx.rng.chance(0.5) ? 1 : -1;
      const [c0, c1] = atk.cooldown;
      this.throwTimer = ctx.rng.range(c0, c1) * (this.enraged ? 0.65 : 1);
    }
  }

  private throwRock(ctx: MonsterContext): void {
    const s = ctx.surfer;
    const atk = this.def.attack;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const sx = this.x + fx * 5 + fz * 5 * this.throwSide;
    const sz = this.z + fz * 5 - fx * 5 * this.throwSide;
    const sy = ctx.world.heightAt(this.x, this.z) + 7;
    // Ziel: wo der Spieler gleich sein wird (+ etwas Streuung)
    const lead = atk.lead;
    const tx = s.x + s.vx * lead + ctx.rng.range(-2.5, 2.5);
    const tz = s.z + s.vz * lead + ctx.rng.range(-2.5, 2.5);
    const d = Math.hypot(tx - sx, tz - sz);
    const dur = Math.max(1.1, Math.min(2.1, d / 24));
    const mesh = new THREE.Mesh(this.rockGeo, this.rockMat);
    addOutline(mesh, 0.08);
    const telegraph = createRingTelegraph('#ff3b30');
    telegraph.visible = true;
    telegraph.position.set(tx, ctx.world.heightAt(tx, tz) + 0.12, tz);
    telegraph.scale.setScalar(this.param('rockRadius', 3.2));
    this.root.parent?.add(mesh, telegraph);
    this.rocks.push({ mesh, telegraph, sx, sy, sz, tx, tz, peak: 6 + d * 0.22, t: 0, dur });
    ctx.bus.emit('bossEvent', { kind: 'throw', position: { x: this.x, z: this.z } });
  }

  private stomp(ctx: MonsterContext): void {
    const water = ctx.world.heightAt(this.x, this.z);
    ctx.effects.splash(this.v.set(this.x, water, this.z), 5);
    const mesh = new THREE.Mesh(this.ringGeo, this.ringMat);
    mesh.position.set(this.x, water, this.z);
    mesh.renderOrder = 3;
    this.root.parent?.add(mesh);
    this.rings.push({ mesh, radius: 10, hitDone: false });
    ctx.bus.emit('bossEvent', { kind: 'stomp', position: { x: this.x, z: this.z } });
  }

  private updateProjectiles(dt: number, ctx: MonsterContext): void {
    const s = ctx.surfer;
    // Felsbrocken
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const r = this.rocks[i]!;
      r.t += dt;
      const k = Math.min(1, r.t / r.dur);
      const ground = ctx.world.heightAt(r.tx, r.tz);
      r.mesh.position.set(r.sx + (r.tx - r.sx) * k, r.sy + (ground - r.sy) * k + Math.sin(Math.PI * k) * r.peak, r.sz + (r.tz - r.sz) * k);
      r.mesh.rotation.x += dt * 5;
      r.mesh.rotation.z += dt * 3;
      // Zielmarkierung pulsiert schneller, je näher der Einschlag
      const pulse = 0.85 + 0.15 * Math.sin(r.t * (8 + k * 20));
      r.telegraph.scale.setScalar(this.param('rockRadius', 3.2) * pulse);
      if (k >= 1) {
        ctx.effects.splash(this.v.set(r.tx, ground, r.tz), 2.8);
        ctx.bus.emit('bossEvent', { kind: 'impact', position: { x: r.tx, z: r.tz } });
        if (Math.hypot(s.x - r.tx, s.z - r.tz) <= this.param('rockRadius', 3.2)) ctx.hitPlayer(this.def.id, r.tx, r.tz);
        r.mesh.removeFromParent();
        r.telegraph.removeFromParent();
        this.rocks.splice(i, 1);
      }
    }
    // Ringwellen
    const speed = this.param('ringSpeed', 16);
    const range = this.param('ringRange', 150);
    const d = Math.hypot(s.x - this.x, s.z - this.z);
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i]!;
      const prev = ring.radius;
      ring.radius += speed * dt;
      const k = ring.radius / range;
      const height = 2.2 * (1 - k * 0.6);
      ring.mesh.scale.set(ring.radius, height, ring.radius);
      ring.mesh.position.y = ctx.world.heightAt(this.x, this.z) - 0.3 + height * 0.5 - 0.5;
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k * 0.7);
      // Trifft, wenn der Ring den Spieler überstreicht und er nicht hoch genug springt
      if (!ring.hitDone && prev <= d && ring.radius >= d) {
        ring.hitDone = true;
        const air = s.y - ctx.world.heightAt(s.x, s.z);
        if (air < this.param('ringDodgeHeight', 0.9)) ctx.hitPlayer(this.def.id, s.x, s.z);
      }
      if (ring.radius >= range) {
        ring.mesh.removeFromParent();
        this.rings.splice(i, 1);
      }
    }
  }
}
