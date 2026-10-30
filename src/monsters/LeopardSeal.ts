/**
 * Seeleopard (Kapitel 3): ein schneller Jäger. Er umkreist dich an der Oberfläche, dann taucht er
 * ab – das Eis knackt, Blasen steigen auf und ein roter Streifen zeigt seine Sprungbahn – und er
 * schießt mit aufgerissenem Maul aus dem Wasser quer über die Bahn. Seitlich ausweichen oder
 * springen! Danach liegt er kurz erschöpft an der Oberfläche (verwundbarer).
 * Ab Stufe 2 springt er zweimal hintereinander.
 *
 * behaviorParams: lungeTime (s), lungeHeight (m), overshoot (m), baskTime (s), baskDamage (Faktor),
 *                 bursts (Sprünge pro Angriff), orbitSpeed (m/s), firstCooldown (s)
 */
import * as THREE from 'three';
import { clamp01, dampAngle, smoothstep } from '../core/math';
import type { GameEventBus } from '../core/events';
import { createBlobShadow } from '../fx/Effects';
import { createStripeTelegraph, placeStripe } from '../fx/telegraph';
import { addOutline } from '../fx/toon';
import { Monster, type MonsterContext, type MonsterPart, type MonsterSpawnArgs } from './Monster';

const EMERGE_TIME = 0.6;
const RETREAT_TIME = 1.6;
const SURFACED = -0.35;
const DIVE_Y = -3.2;
const DIVE_TIME = 0.7;

type SealMode = 'circle' | 'dive' | 'aim' | 'lunge' | 'bask';

export class LeopardSeal extends Monster {
  private readonly model: THREE.Object3D;
  private readonly jaw: THREE.Object3D | undefined;
  private readonly tail: THREE.Object3D | undefined;
  private readonly fins: THREE.Object3D[] = [];
  private readonly telegraph = createStripeTelegraph('#ff3b30');
  private readonly shadow: THREE.Mesh;
  private mode: SealMode = 'circle';
  private modeTime = 0;
  private cooldown: number;
  private grace = 0;
  private time = 0;
  private y = DIVE_Y;
  private facing = 0;
  private pitch = 0;
  private roll = 0;
  private orbitAngle = 0;
  private orbitDir: 1 | -1 = 1;
  private burstsLeft = 0;
  private dirX = 0;
  private dirZ = 1;
  private startX = 0;
  private startZ = 0;
  private length = 0;
  private hitDone = false;
  private surfaced = false;
  private readonly v = new THREE.Vector3();

  constructor(args: MonsterSpawnArgs) {
    super(args);
    this.model = args.assets.create(args.def.model, { colors: args.def.colors });
    this.jaw = this.model.getObjectByName('jaw') ?? undefined;
    this.tail = this.model.getObjectByName('tail') ?? undefined;
    for (const n of ['finL', 'finR']) {
      const f = this.model.getObjectByName(n);
      if (f) this.fins.push(f);
    }
    addOutline(this.model, 0.05);
    this.root.add(this.model);
    this.cooldown = this.param('firstCooldown', 2.2);
    this.orbitDir = Math.random() < 0.5 ? 1 : -1;
    this.shadow = createBlobShadow(1);
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

  /** Abgetaucht nicht zu treffen. */
  override get isTargetable(): boolean {
    if (this.phase === 'emerging') return true;
    if (this.phase !== 'active') return false;
    return this.mode === 'circle' || this.mode === 'bask' || (this.mode === 'lunge' && this.modeTime > 0.15);
  }

  override onPlayerHit(): void {
    this.grace = this.def.attack.graceAfterHit;
    this.burstsLeft = 0;
  }

  /** Erschöpft an der Oberfläche nimmt er mehr Schaden. */
  override takeHit(part: MonsterPart, damage: number, ctx: { bus: GameEventBus }): number {
    const k = this.mode === 'bask' ? this.param('baskDamage', 1.6) : 1;
    return super.takeHit(part, Math.round(damage * k), ctx);
  }

  private setMode(m: SealMode): void {
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
    let jawOpen = 0;
    let swimRate = 6;

    switch (this.phase) {
      case 'warning': {
        // Dunkler Schatten und Blasenspur ziehen heran
        this.y = DIVE_Y;
        this.facing = dampAngle(this.facing, Math.atan2(s.x - this.x, s.z - this.z), 2.5, dt);
        this.x += Math.sin(this.facing) * def.chaseSpeed * 0.7 * dt;
        this.z += Math.cos(this.facing) * def.chaseSpeed * 0.7 * dt;
        if (Math.random() < dt * 8) ctx.effects.bubbles(this.v.set(this.x, water, this.z), 2, 1.5);
        if (this.phaseTime >= def.warningTime) {
          this.setPhase('emerging');
          if (!this.surfaced) ctx.bus.emit('monsterSpawned', { instanceId: this.id, monsterId: def.id, tier: this.tier.tier });
          this.surfaced = true;
          this.orbitAngle = Math.atan2(this.z - s.z, this.x - s.x);
          ctx.effects.splash(this.v.set(this.x, water, this.z), 1.6);
        }
        break;
      }
      case 'emerging': {
        this.y = DIVE_Y + (SURFACED - DIVE_Y) * smoothstep(0, EMERGE_TIME, this.phaseTime);
        if (this.phaseTime >= EMERGE_TIME) this.setPhase('active');
        break;
      }
      case 'active': {
        const r = this.updateActive(dt, ctx, dist, water);
        jawOpen = r.jaw;
        swimRate = r.swim;
        if (this.isDefeated) {
          this.emitDefeated(ctx);
          ctx.effects.hitSparks(this.v.set(this.x, water + 1, this.z), '#dff4ff', 2);
          ctx.effects.splash(this.v.set(this.x, water, this.z), 2);
          this.telegraph.visible = false;
          this.setPhase('retreating');
        } else if (dist > def.escapeDistance && this.mode === 'circle') {
          this.escaped = true;
          ctx.bus.emit('monsterEscaped', { instanceId: this.id, monsterId: def.id, points: def.escapePoints });
          this.telegraph.visible = false;
          this.setPhase('retreating');
        }
        break;
      }
      case 'retreating': {
        const k = clamp01(this.phaseTime / RETREAT_TIME);
        this.y = SURFACED + (DIVE_Y - SURFACED) * smoothstep(0, 1, k);
        if (!this.escaped) this.roll = Math.PI * smoothstep(0, 0.5, k);
        this.pitch *= Math.exp(-3 * dt);
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
    const inAir = this.phase === 'active' && this.mode === 'lunge';
    this.model.visible = this.phase !== 'warning' && !(this.phase === 'active' && this.mode === 'aim');
    this.root.position.set(this.x, inAir ? this.y : water + this.y + Math.sin(this.time * 2.3) * 0.06, this.z);
    this.root.rotation.set(this.pitch, this.facing, this.roll, 'YXZ');
    if (this.jaw) this.jaw.rotation.x = jawOpen * 0.75;
    if (this.tail) this.tail.rotation.y = Math.sin(this.time * swimRate) * 0.4;
    this.fins.forEach((f, i) => (f.rotation.z = Math.sin(this.time * swimRate * 0.5 + i * Math.PI) * 0.3));
    const fx = Math.sin(this.facing);
    const fz = Math.cos(this.facing);
    const yTop = inAir ? this.y : water + this.y;
    this.parts[0]?.position.set(this.x + fx * 2.1, yTop + 0.5, this.z + fz * 2.1);
    this.parts[1]?.position.set(this.x - fx * 0.3, yTop + 0.4, this.z - fz * 0.3);
    // Schatten (auch unter Wasser sichtbar)
    const under = this.phase === 'warning' || (this.phase === 'active' && (this.mode === 'dive' || this.mode === 'aim'));
    this.shadow.visible = under || inAir;
    this.shadow.position.set(this.x, ctx.world.heightAt(this.x, this.z) + 0.05, this.z);
    this.shadow.rotation.set(-Math.PI / 2, 0, -this.facing);
    this.shadow.scale.set(1.3, 3.2, 1);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = under ? 0.55 : 0.3;
    this.updateFlash(dt);
  }

  /** Gibt Maul-Öffnung und Schwimm-Frequenz zurück. */
  private updateActive(dt: number, ctx: MonsterContext, dist: number, water: number): { jaw: number; swim: number } {
    const def = this.def;
    const atk = def.attack;
    const s = ctx.surfer;
    switch (this.mode) {
      case 'circle': {
        this.y += (SURFACED - this.y) * Math.min(1, dt * 3);
        this.roll *= Math.exp(-4 * dt);
        this.pitch *= Math.exp(-4 * dt);
        const speed = this.param('orbitSpeed', def.chaseSpeed) * this.tier.speedMul;
        const r = this.grace > 0 ? def.preferredDistance + 10 : def.preferredDistance;
        this.orbitAngle += (speed / r) * this.orbitDir * dt;
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
        this.telegraph.visible = false;
        this.cooldown -= dt;
        const canAttack = this.grace <= 0 && ctx.run.invulnerable <= 0 && !s.fsm.is('Wipeout');
        if (this.cooldown <= 0 && canAttack && dist < atk.reach) {
          this.burstsLeft = Math.max(1, Math.round(this.param('bursts', 1) + (this.tier.tier >= 2 ? 1 : 0)));
          this.setMode('dive');
          ctx.effects.splash(this.v.set(this.x, water, this.z), 1.4);
        }
        return { jaw: 0, swim: 7 };
      }
      case 'dive': {
        // Abtauchen und unter Wasser in Position schwimmen (seitlich vom Spieler)
        const k = clamp01(this.modeTime / DIVE_TIME);
        this.y = SURFACED + (DIVE_Y - SURFACED) * smoothstep(0, 1, k);
        this.pitch = 0.5 * Math.sin(Math.PI * k);
        const a = this.orbitAngle;
        const r = Math.min(dist, 14);
        const tx = s.x + Math.cos(a) * r;
        const tz = s.z + Math.sin(a) * r;
        this.x += (tx - this.x) * Math.min(1, dt * 3);
        this.z += (tz - this.z) * Math.min(1, dt * 3);
        if (k >= 1) {
          this.setMode('aim');
          ctx.bus.emit('monsterAttack', { monsterId: def.id, kind: 'crack', position: { x: this.x, z: this.z } });
        }
        return { jaw: 0, swim: 10 };
      }
      case 'aim': {
        // Unter Wasser: Bahn zeigen (Streifen), im letzten Drittel steht sie fest
        const second = this.burstsLeft < Math.round(this.param('bursts', 1) + (this.tier.tier >= 2 ? 1 : 0));
        const windup = atk.windup * this.tier.windupMul * (second ? 0.7 : 1);
        const locked = this.modeTime > windup * 0.62;
        if (!locked) {
          const T = this.param('lungeTime', 0.9);
          const px = s.x + s.vx * atk.lead * (windup + T * 0.5);
          const pz = s.z + s.vz * atk.lead * (windup + T * 0.5);
          const ax = px - this.x;
          const az = pz - this.z;
          const al = Math.hypot(ax, az) || 1;
          this.dirX = ax / al;
          this.dirZ = az / al;
          this.length = al + this.param('overshoot', 7);
          this.facing = Math.atan2(this.dirX, this.dirZ);
        }
        this.startX = this.x;
        this.startZ = this.z;
        const ex = this.x + this.dirX * this.length;
        const ez = this.z + this.dirZ * this.length;
        placeStripe(this.telegraph, this.x, this.z, ex, ez, ctx.world.heightAt((this.x + ex) / 2, (this.z + ez) / 2) + 0.3, atk.radius * 2);
        this.telegraph.visible = true;
        ((this.telegraph.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.4 * Math.sin(this.time * (locked ? 40 : 18));
        if (Math.random() < dt * 12) ctx.effects.bubbles(this.v.set(this.x, water, this.z), 2, 1.2);
        if (this.modeTime >= windup) {
          this.hitDone = false;
          this.setMode('lunge');
          ctx.effects.splash(this.v.set(this.x, water, this.z), 2.4);
          ctx.bus.emit('monsterAttack', { monsterId: def.id, kind: 'lunge', position: { x: this.x, z: this.z } });
        }
        return { jaw: 0.3, swim: 12 };
      }
      case 'lunge': {
        // Bogen aus dem Wasser über die Bahn, Maul weit auf
        const T = this.param('lungeTime', 0.9);
        const k = clamp01(this.modeTime / T);
        this.x = this.startX + this.dirX * this.length * k;
        this.z = this.startZ + this.dirZ * this.length * k;
        const w = ctx.world.heightAt(this.x, this.z);
        this.y = w + SURFACED + Math.sin(Math.PI * k) * this.param('lungeHeight', 3.2) - (k > 0.9 ? (k - 0.9) * 20 : 0);
        this.pitch = -0.7 + 1.4 * k;
        const hx = this.x + this.dirX * 2;
        const hz = this.z + this.dirZ * 2;
        if (!this.hitDone && Math.hypot(s.x - hx, s.z - hz) <= atk.radius) {
          this.hitDone = ctx.hitPlayer(def.id, hx, hz) || this.hitDone;
          if (this.hitDone) this.telegraph.visible = false;
        }
        if (k >= 1) {
          this.telegraph.visible = false;
          ctx.effects.splash(this.v.set(this.x, w, this.z), 2.6);
          this.burstsLeft--;
          if (this.burstsLeft > 0 && !this.hitDone && this.grace <= 0) {
            // gleich noch einmal: kurz untertauchen und neu zielen
            this.y = DIVE_Y;
            this.setMode('aim');
          } else {
            this.y = SURFACED;
            this.setMode('bask');
          }
        }
        return { jaw: 1, swim: 16 };
      }
      case 'bask': {
        // Erschöpft an der Oberfläche, rollt leicht
        this.telegraph.visible = false;
        this.y += (SURFACED + 0.1 - this.y) * Math.min(1, dt * 3);
        this.pitch *= Math.exp(-3 * dt);
        this.roll = Math.sin(this.modeTime * 2.2) * 0.25;
        if (this.modeTime >= this.param('baskTime', 2.6)) {
          this.orbitAngle = Math.atan2(this.z - s.z, this.x - s.x);
          this.orbitDir = Math.random() < 0.5 ? 1 : -1;
          this.cooldown = ctx.rng.range(atk.cooldown[0], atk.cooldown[1]) * this.tier.windupMul;
          this.setMode('circle');
        }
        return { jaw: 0.15 + 0.1 * Math.sin(this.time * 4), swim: 2 };
      }
    }
  }
}
