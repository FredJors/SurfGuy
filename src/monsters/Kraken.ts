/**
 * Kraken: taucht mit Vorwarnung (Blasen, dunkler Schatten) auf, verfolgt den Spieler mit
 * begrenztem Tempo und greift mit Tentakeln an (sichtbares Ausholen + Markierung, dann Schlag).
 */
import * as THREE from 'three';
import { clamp01, smoothstep } from '../core/math';
import { createBlobShadow } from '../fx/Effects';
import { addOutline, toonMaterial } from '../fx/toon';
import { Monster, type MonsterContext, type MonsterPart, type MonsterSpawnArgs } from './Monster';

const SEGMENTS = 20;
const EMERGE_TIME = 0.9;
const RETREAT_TIME = 1.6;
const SLAM_TIME = 0.16;
const RECOVER_TIME = 0.6;
const DIVE_TIME = 0.8;
const REAPPEAR_WARNING = 1.0;
const BODY_RING = 2.2;
const HEAD_SCALE = 0.8;
/** Mindestabstand zur Kamera (m) – das Monster soll nie die Sicht verdecken */
const CAMERA_CLEARANCE = 7.5;

type TentacleState = 'idle' | 'windup' | 'slam' | 'recover' | 'dead';

interface Tentacle {
  part: MonsterPart;
  /** Winkel um den Körper (relativ zur Blickrichtung) */
  angle: number;
  state: TentacleState;
  timer: number;
  cooldown: number;
  windup: number;
  target: THREE.Vector3;
  base: THREE.Vector3;
  ctrl: THREE.Vector3;
  tip: THREE.Vector3;
  phase: number;
  sink: number;
  telegraph: THREE.Group;
}

export class Kraken extends Monster {
  private readonly head: THREE.Object3D;
  private readonly tentacleMesh: THREE.InstancedMesh;
  private readonly tentacles: Tentacle[] = [];
  private readonly shadow: THREE.Mesh;
  private facing = 0;
  private time = 0;
  private bubbleAcc = 0;
  private sinkY = -8;
  private surfaced = false;
  private behindTime = 0;
  private ambushes = 0;
  private warningDuration: number;
  /** Schonfrist nach einem Treffer am Spieler (s) */
  private grace = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly desiredCtrl = new THREE.Vector3();
  private readonly desiredTip = new THREE.Vector3();

  constructor(args: MonsterSpawnArgs) {
    super(args);
    const colors = args.def.colors;
    this.head = args.assets.create(args.def.model, { colors });
    this.head.scale.setScalar(HEAD_SCALE);
    addOutline(this.head, 0.06);
    this.root.add(this.head);

    const tentacleParts = this.parts.filter((p) => p.tag === 'tentacle');
    const geo = new THREE.SphereGeometry(1, 10, 6);
    const mat = toonMaterial('#ffffff');
    this.tentacleMesh = new THREE.InstancedMesh(geo, mat, tentacleParts.length * SEGMENTS);
    this.tentacleMesh.frustumCulled = false;
    const body = new THREE.Color(colors.body);
    const accent = new THREE.Color(colors.accent);
    for (let i = 0; i < this.tentacleMesh.count; i++) {
      this.tentacleMesh.setColorAt(i, i % SEGMENTS > 2 && i % 3 === 0 ? accent : body);
    }
    addOutline(this.tentacleMesh, 0.08);

    const n = tentacleParts.length;
    tentacleParts.forEach((part, i) => {
      // Tentakel vorne/seitlich verteilt (zum Spieler hin), Kopf bleibt sichtbar
      const angle = -Math.PI * 0.75 + (i / Math.max(1, n - 1)) * Math.PI * 1.5;
      const telegraph = this.createTelegraph();
      this.tentacles.push({
        part,
        angle,
        state: 'idle',
        timer: 0,
        cooldown: 1.5 + i * 0.7,
        windup: args.def.attack.windup * args.tier.windupMul,
        target: new THREE.Vector3(),
        base: new THREE.Vector3(),
        ctrl: new THREE.Vector3(),
        tip: new THREE.Vector3(),
        phase: Math.random() * Math.PI * 2,
        sink: 0,
        telegraph,
      });
    });

    this.warningDuration = args.def.warningTime;
    this.shadow = createBlobShadow(9);
    (this.shadow.material as THREE.MeshBasicMaterial).color.set('#0a0a30');
    this.collectFlashMaterials();
  }

  /** Tentakel, Schatten und Markierungen wandern nicht mit dem Kopf mit → direkt in die Szene. */
  override attach(parent: THREE.Object3D): void {
    parent.add(this.root, this.tentacleMesh, this.shadow);
    for (const t of this.tentacles) parent.add(t.telegraph);
  }

  override dispose(): void {
    super.dispose();
    this.tentacleMesh.removeFromParent();
    this.tentacleMesh.dispose();
    this.shadow.removeFromParent();
    for (const t of this.tentacles) t.telegraph.removeFromParent();
  }

  private createTelegraph(): THREE.Group {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1, 40),
      new THREE.MeshBasicMaterial({ color: '#ff2d55', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(1, 40),
      new THREE.MeshBasicMaterial({ color: '#ff2d55', transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    ring.rotation.x = fill.rotation.x = -Math.PI / 2;
    g.add(fill, ring);
    g.visible = false;
    g.renderOrder = 2;
    return g;
  }

  protected override onPartDestroyed(part: MonsterPart): void {
    const t = this.tentacles.find((x) => x.part === part);
    if (t) {
      t.state = 'dead';
      t.telegraph.visible = false;
    }
  }

  override onPlayerHit(): void {
    this.grace = this.def.attack.graceAfterHit;
    for (const t of this.tentacles) {
      if (t.state === 'windup' || t.state === 'slam') {
        t.state = 'idle';
        t.timer = 0;
      }
      t.telegraph.visible = false;
      if (t.state !== 'dead') t.cooldown = Math.max(t.cooldown, 1);
    }
  }

  get aliveTentacles(): number {
    return this.tentacles.filter((t) => t.state !== 'dead').length;
  }

  update(dt: number, ctx: MonsterContext): void {
    this.time += dt;
    this.phaseTime += dt;
    const def = this.def;
    const sx = ctx.surfer.x;
    const sz = ctx.surfer.z;
    let dx = sx - this.x;
    let dz = sz - this.z;
    const dist = Math.hypot(dx, dz) || 1;
    dx /= dist;
    dz /= dist;
    const water = ctx.world.heightAt(this.x, this.z);

    // --- Phasen ---
    switch (this.phase) {
      case 'warning': {
        // Blasen und dunkler Schatten, Kraken noch unter Wasser
        this.bubbleAcc += dt * 14;
        while (this.bubbleAcc > 1) {
          this.bubbleAcc -= 1;
          ctx.effects.bubbles(this.v.set(this.x, water, this.z), 2, 5);
        }
        this.sinkY = -9;
        if (this.phaseTime >= this.warningDuration) {
          this.setPhase('emerging');
          ctx.effects.splash(this.v.set(this.x, water, this.z), 3);
          if (!this.surfaced) ctx.bus.emit('monsterSpawned', { instanceId: this.id, monsterId: def.id, tier: this.tier.tier });
          this.surfaced = true;
        }
        break;
      }
      case 'emerging': {
        this.sinkY = -9 * (1 - smoothstep(0, 1, this.phaseTime / EMERGE_TIME));
        if (this.phaseTime >= EMERGE_TIME) this.setPhase('active');
        break;
      }
      case 'active': {
        this.sinkY = 0;
        // Verfolgen mit begrenztem Tempo, bevorzugten Abstand halten
        const speed = def.chaseSpeed * this.tier.speedMul;
        this.grace = Math.max(0, this.grace - dt);
        if (this.grace > 0) {
          // Schonfrist: Abstand vergrößern, damit der Spieler wieder Tempo aufbauen kann
          const keep = def.preferredDistance + 12;
          if (dist < keep) {
            this.x -= dx * speed * 0.8 * dt;
            this.z -= dz * speed * 0.8 * dt;
          }
        } else if (dist > def.preferredDistance) {
          const step = Math.min(dist - def.preferredDistance, speed * dt);
          this.x += dx * step;
          this.z += dz * step;
        } else if (dist < def.preferredDistance * 0.5) {
          this.x -= dx * speed * 0.4 * dt;
          this.z -= dz * speed * 0.4 * dt;
        }
        this.keepClearOfCamera(ctx, speed, dt);
        // Liegt das Monster hinter dem Spieler (außer Sicht)?
        const s = ctx.surfer;
        const behind = (this.x - s.x) * s.forwardX + (this.z - s.z) * s.forwardZ < -2;
        this.behindTime = behind ? this.behindTime + dt : 0;
        if (this.isDefeated || this.aliveTentacles === 0) {
          this.defeat(ctx);
        } else if (def.ambush && this.behindTime > def.ambush.behindTime && this.ambushes < def.ambush.maxCount && dist > 12) {
          this.ambushes++;
          this.behindTime = 0;
          this.setPhase('diving');
        } else if (dist > def.escapeDistance) {
          this.escaped = true;
          ctx.bus.emit('monsterEscaped', { instanceId: this.id, monsterId: def.id, points: def.escapePoints });
          this.setPhase('retreating');
        }
        break;
      }
      case 'diving': {
        // Abtauchen und vor dem Spieler wieder auftauchen
        this.sinkY = -9 * smoothstep(0, 1, this.phaseTime / DIVE_TIME);
        if (this.phaseTime >= DIVE_TIME) {
          const s = ctx.surfer;
          const ahead = def.ambush?.aheadDistance ?? 26;
          const lead = REAPPEAR_WARNING + EMERGE_TIME;
          const side = ctx.rng.range(-8, 8);
          this.x = s.x + s.forwardX * ahead + s.vx * lead - s.forwardZ * side;
          this.z = s.z + s.forwardZ * ahead + s.vz * lead + s.forwardX * side;
          this.warningDuration = REAPPEAR_WARNING;
          this.setPhase('warning');
          ctx.bus.emit('monsterWarning', { instanceId: this.id, monsterId: def.id, position: { x: this.x, z: this.z } });
        }
        break;
      }
      case 'retreating': {
        this.sinkY = -9 * smoothstep(0, 1, this.phaseTime / RETREAT_TIME);
        if (this.phaseTime >= RETREAT_TIME) this.setPhase('gone');
        break;
      }
      case 'gone':
        return;
    }

    // --- Darstellung Körper ---
    this.facing = Math.atan2(dx, dz);
    const bob = Math.sin(this.time * 1.6) * 0.25;
    this.root.position.set(this.x, water + this.sinkY + bob - 0.5, this.z);
    this.root.rotation.set(Math.sin(this.time * 1.1) * 0.05, this.facing, Math.sin(this.time * 0.9) * 0.05);
    this.root.visible = this.phase !== 'warning';
    const head = this.parts.find((p) => p.tag === 'head');
    head?.position.set(this.x + dx * 0.7, water + this.sinkY + 2.1, this.z + dz * 0.7);

    // Schatten im Wasser (Vorwarnung + unter dem Körper)
    const warnK =
      this.phase === 'warning'
        ? smoothstep(0, this.warningDuration, this.phaseTime)
        : this.phase === 'retreating' || this.phase === 'diving'
          ? 1 - clamp01(this.phaseTime / (this.phase === 'diving' ? DIVE_TIME : RETREAT_TIME))
          : 1;
    this.shadow.position.set(this.x, water + 0.05, this.z);
    this.shadow.scale.setScalar(0.4 + warnK * 0.8 + Math.sin(this.time * 6) * 0.03);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.9 * warnK;

    this.updateTentacles(dt, ctx, water);
    this.updateFlash(dt);
  }

  /** Weicht seitlich aus, wenn es der Kamera (hinter dem Spieler) zu nahe kommt. */
  private keepClearOfCamera(ctx: MonsterContext, speed: number, dt: number): void {
    const cx = ctx.cameraX;
    const cz = ctx.cameraZ;
    // Abstand zur Strecke Kamera → Spieler (die Sichtlinie)
    const px = ctx.surfer.x;
    const pz = ctx.surfer.z;
    const lx = px - cx;
    const lz = pz - cz;
    const len2 = lx * lx + lz * lz || 1;
    const t = Math.max(0, Math.min(1, ((this.x - cx) * lx + (this.z - cz) * lz) / len2));
    const qx = cx + lx * t;
    const qz = cz + lz * t;
    let ox = this.x - qx;
    let oz = this.z - qz;
    let d = Math.hypot(ox, oz);
    if (d >= CAMERA_CLEARANCE) return;
    if (d < 0.01) {
      // genau auf der Sichtlinie: zur Seite ausweichen
      ox = -lz;
      oz = lx;
      d = Math.hypot(ox, oz) || 1;
    }
    const push = Math.min(CAMERA_CLEARANCE - d, speed * 2.5 * dt);
    this.x += (ox / d) * push;
    this.z += (oz / d) * push;
  }

  private defeat(ctx: MonsterContext): void {
    const def = this.def;
    const mul = this.tier.rewardMul;
    const rewards = {
      pearls: Math.round(def.rewards.pearls * mul),
      xp: Math.round(def.rewards.xp * mul),
      points: Math.round(def.rewards.points * mul),
    };
    ctx.bus.emit('monsterDefeated', { instanceId: this.id, monsterId: def.id, tier: this.tier.tier, rewards, position: { x: this.x, z: this.z } });
    const p = this.v.set(this.x, ctx.world.heightAt(this.x, this.z) + 3, this.z);
    ctx.effects.hitSparks(p, '#ffd6f0', 2.5);
    ctx.effects.splash(p.setY(p.y - 3), 3.5);
    for (const t of this.tentacles) t.telegraph.visible = false;
    this.setPhase('retreating');
  }

  private updateTentacles(dt: number, ctx: MonsterContext, water: number): void {
    const def = this.def;
    const atk = def.attack;
    const s = ctx.surfer;
    const active = this.phase === 'active';
    let attacking = this.tentacles.filter((t) => t.state === 'windup' || t.state === 'slam').length;
    let instance = 0;

    for (const t of this.tentacles) {
      const a = this.facing + t.angle;
      t.base.set(this.x + Math.sin(a) * BODY_RING, water + this.sinkY - 0.4, this.z + Math.cos(a) * BODY_RING);
      const ox = Math.sin(a);
      const oz = Math.cos(a);
      let rate = 5;
      t.timer += dt;

      switch (t.state) {
        case 'idle': {
          const sway = Math.sin(this.time * 2 + t.phase);
          this.desiredCtrl.set(t.base.x + ox * 1.2, t.base.y + 3.8, t.base.z + oz * 1.2);
          this.desiredTip.set(t.base.x + ox * (2.8 + sway * 0.8) - oz * sway, t.base.y + 4.8 + Math.sin(this.time * 1.3 + t.phase) * 0.9, t.base.z + oz * (2.8 + sway * 0.8) + ox * sway);
          rate = 4;
          if (active) t.cooldown -= dt;
          const reachable = Math.hypot(s.x - t.base.x, s.z - t.base.z) <= atk.reach;
          const canAttack = this.grace <= 0 && ctx.run.invulnerable <= 0 && !s.fsm.is('Wipeout');
          if (active && t.cooldown <= 0 && reachable && attacking < atk.maxConcurrent && canAttack) {
            // Ausholen: Ziel = vorgehaltene Spielerposition
            const lead = atk.lead * t.windup;
            t.target.set(s.x + s.vx * lead, 0, s.z + s.vz * lead);
            const tx = t.target.x - t.base.x;
            const tz = t.target.z - t.base.z;
            const tl = Math.hypot(tx, tz);
            if (tl > atk.reach) t.target.set(t.base.x + (tx / tl) * atk.reach, 0, t.base.z + (tz / tl) * atk.reach);
            t.state = 'windup';
            t.timer = 0;
            attacking++;
          }
          break;
        }
        case 'windup': {
          const k = clamp01(t.timer / t.windup);
          const tx = t.target.x - t.base.x;
          const tz = t.target.z - t.base.z;
          const tl = Math.hypot(tx, tz) || 1;
          const shake = Math.sin(this.time * 40) * 0.15 * k;
          this.desiredCtrl.set(t.base.x - (tx / tl) * 0.8, t.base.y + 5.5, t.base.z - (tz / tl) * 0.8);
          this.desiredTip.set(t.base.x - (tx / tl) * 2 + shake, t.base.y + 8 + k * 1.5, t.base.z - (tz / tl) * 2);
          rate = 6;
          // Markierung auf dem Wasser
          const ty = ctx.world.heightAt(t.target.x, t.target.z) + 0.12;
          t.telegraph.visible = true;
          t.telegraph.position.set(t.target.x, ty, t.target.z);
          t.telegraph.scale.setScalar(atk.radius * (0.35 + 0.65 * k));
          ((t.telegraph.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.4 * Math.sin(this.time * 18);
          if (t.timer >= t.windup) {
            t.state = 'slam';
            t.timer = 0;
          }
          break;
        }
        case 'slam': {
          const ty = ctx.world.heightAt(t.target.x, t.target.z);
          this.desiredTip.set(t.target.x, ty + 0.3, t.target.z);
          this.desiredCtrl.set((t.base.x + t.target.x) / 2, Math.max(t.base.y, ty) + 2.5, (t.base.z + t.target.z) / 2);
          rate = 38;
          if (t.timer >= SLAM_TIME) {
            t.state = 'recover';
            t.timer = 0;
            t.telegraph.visible = false;
            ctx.effects.splash(this.v.set(t.target.x, ty, t.target.z), 2.2);
            const d = Math.hypot(s.x - t.target.x, s.z - t.target.z);
            if (d <= atk.radius) ctx.hitPlayer(def.id, t.target.x, t.target.z);
          }
          break;
        }
        case 'recover': {
          const ty = ctx.world.heightAt(t.target.x, t.target.z);
          this.desiredTip.set(t.target.x, ty + 0.2, t.target.z);
          this.desiredCtrl.set((t.base.x + t.target.x) / 2, Math.max(t.base.y, ty) + 1.2, (t.base.z + t.target.z) / 2);
          rate = 10;
          if (t.timer >= RECOVER_TIME) {
            t.state = 'idle';
            t.timer = 0;
            t.cooldown = ctx.rng.range(atk.cooldown[0], atk.cooldown[1]) * this.tier.windupMul;
          }
          break;
        }
        case 'dead': {
          t.sink = Math.min(1, t.sink + dt * 1.2);
          this.desiredCtrl.set(t.base.x + ox, t.base.y - 1 - t.sink * 4, t.base.z + oz);
          this.desiredTip.set(t.base.x + ox * 2, t.base.y - 2 - t.sink * 6, t.base.z + oz * 2);
          rate = 3;
          t.telegraph.visible = false;
          break;
        }
      }
      if (this.phase !== 'active') {
        t.telegraph.visible = false;
        if (t.state === 'windup' || t.state === 'slam') t.state = 'idle';
      }

      // Weich auf die Zielkurve zubewegen
      const k = 1 - Math.exp(-rate * dt);
      if (t.tip.lengthSq() === 0) {
        t.tip.copy(this.desiredTip);
        t.ctrl.copy(this.desiredCtrl);
      }
      t.ctrl.lerp(this.desiredCtrl, k);
      t.tip.lerp(this.desiredTip, k);

      // Kugelkette entlang der Bezierkurve
      const thickness = t.state === 'dead' ? 1 - t.sink : 1;
      for (let i = 0; i < SEGMENTS; i++) {
        const u = i / (SEGMENTS - 1);
        bezier(t.base, t.ctrl, t.tip, u, this.v);
        const r = 0.68 * (1 - 0.72 * u) * Math.max(0.01, thickness);
        this.s.setScalar(r);
        this.m.compose(this.v, this.q, this.s);
        this.tentacleMesh.setMatrixAt(instance++, this.m);
      }
      // Trefferpunkt des Tentakels (oberes Mittelstück)
      bezier(t.base, t.ctrl, t.tip, 0.6, t.part.position);
    }
    this.tentacleMesh.instanceMatrix.needsUpdate = true;
  }
}

function bezier(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  const u = 1 - t;
  return out.set(
    u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    u * u * a.y + 2 * u * t * b.y + t * t * c.y,
    u * u * a.z + 2 * u * t * b.z + t * t * c.z,
  );
}
