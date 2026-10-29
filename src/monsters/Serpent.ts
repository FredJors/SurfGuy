/**
 * Seeschlange (Kapitel 2): Vorwarnung = Blasenspur. Schwimmt in Schlangenlinien um den Spieler,
 * Körperbögen tauchen aus dem Wasser auf. Angriff: richtet sich auf (roter Streifen zeigt die
 * Bahn), dann schnellt der Kopf vor. Danach liegt der Kopf kurz erschöpft auf dem Wasser
 * (verwundbarer). Seitlich ausweichen oder drüberspringen.
 *
 * behaviorParams: lungeSpeed (m/s), overshoot (m), tiredTime (s), rearHeight (m),
 *                 segments (Anzahl), spacing (m), tiredDamage (Faktor), firstCooldown (s)
 */
import * as THREE from 'three';
import { clamp01, dampAngle, smoothstep } from '../core/math';
import { createStripeTelegraph, placeStripe } from '../fx/telegraph';
import { addOutline } from '../fx/toon';
import { Monster, type MonsterContext, type MonsterPart, type MonsterSpawnArgs } from './Monster';
import type { GameEventBus } from '../core/events';

const EMERGE_TIME = 0.9;
const RETREAT_TIME = 1.8;
const TRAIL_STEP = 0.35;
/** Abstand Kopf → erstes Segment */
const NECK = 1.4;
const HIDDEN = -3.2;

type SerpentMode = 'swim' | 'rear' | 'lunge' | 'tired';

export class Serpent extends Monster {
  private readonly model: THREE.Object3D;
  private readonly head: THREE.Object3D;
  private readonly jaw: THREE.Object3D | undefined;
  private readonly segs: THREE.Object3D[] = [];
  /** Trefferpunkte auf dem Körper (Windungen) */
  private readonly coils: MonsterPart[];
  private readonly telegraph = createStripeTelegraph();
  /** Spur des Kopfes (neueste zuerst); die Segmente folgen ihr */
  private readonly trail: { x: number; z: number }[] = [];
  private mode: SerpentMode = 'swim';
  private modeTime = 0;
  private cooldown: number;
  private grace = 0;
  private time = 0;
  private sinkY = HIDDEN;
  private facing = 0;
  private lift = 0.5;
  private pitch = 0;
  private roll = 0;
  private jawOpen = 0;
  private surfaced = false;
  private orbitDir: 1 | -1 = 1;
  private bubbleAcc = 0;
  private lungeX = 0;
  private lungeZ = 1;
  private lungeLength = 0;
  private lungeTravel = 0;
  private hitDone = false;
  private readonly v = new THREE.Vector3();
  private readonly look = new THREE.Vector3();

  constructor(args: MonsterSpawnArgs) {
    super(args);
    const count = Math.round(this.param('segments', 9));
    this.model = args.assets.create(args.def.model, { colors: args.def.colors, segments: count });
    this.head = this.model.getObjectByName('head') ?? this.model;
    this.jaw = this.model.getObjectByName('jaw') ?? undefined;
    for (let i = 0; i < count; i++) {
      const s = this.model.getObjectByName(`seg${i}`);
      if (s) this.segs.push(s);
    }
    addOutline(this.model, 0.05);
    this.root.add(this.model);
    this.cooldown = this.param('firstCooldown', 2.5);
    this.orbitDir = Math.random() < 0.5 ? 1 : -1;
    this.facing = Math.random() * Math.PI * 2;
    // Spur hinter dem Kopf vorbelegen
    const len = this.trailLength;
    for (let i = 0; i < len; i++) this.trail.push({ x: this.x - Math.sin(this.facing) * i * TRAIL_STEP, z: this.z - Math.cos(this.facing) * i * TRAIL_STEP });
    this.coils = this.parts.filter((p) => p.tag !== 'head');
    this.collectFlashMaterials();
  }

  private get trailLength(): number {
    return Math.ceil((NECK + this.segs.length * this.param('spacing', 1.9)) / TRAIL_STEP) + 3;
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
    if (this.mode === 'rear' || this.mode === 'lunge') this.setMode('tired');
    this.telegraph.visible = false;
  }

  /** Erschöpft (nach dem Vorschnellen) nimmt sie mehr Schaden. */
  override takeHit(part: MonsterPart, damage: number, ctx: { bus: GameEventBus }): number {
    const k = this.mode === 'tired' ? this.param('tiredDamage', 1.5) : 1;
    return super.takeHit(part, Math.round(damage * k), ctx);
  }

  private setMode(m: SerpentMode): void {
    this.mode = m;
    this.modeTime = 0;
  }

  /** Kopf ein Stück vorwärts bewegen und die Spur fortschreiben. */
  private moveHead(dist: number): void {
    this.x += Math.sin(this.facing) * dist;
    this.z += Math.cos(this.facing) * dist;
    let last = this.trail[0]!;
    let d = Math.hypot(this.x - last.x, this.z - last.z);
    while (d >= TRAIL_STEP) {
      const k = TRAIL_STEP / d;
      last = { x: last.x + (this.x - last.x) * k, z: last.z + (this.z - last.z) * k };
      this.trail.unshift(last);
      d -= TRAIL_STEP;
    }
    if (this.trail.length > this.trailLength) this.trail.length = this.trailLength;
  }

  /** Punkt auf der Spur in `dist` Metern Abstand vom Kopf. */
  private trailPoint(dist: number, out: THREE.Vector3): THREE.Vector3 {
    const f = dist / TRAIL_STEP;
    const i = Math.min(this.trail.length - 2, Math.floor(f));
    const a = this.trail[i]!;
    const b = this.trail[i + 1]!;
    const t = Math.min(1, f - i);
    return out.set(a.x + (b.x - a.x) * t, 0, a.z + (b.z - a.z) * t);
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

    switch (this.phase) {
      case 'warning': {
        // Blasenspur schlängelt sich heran
        this.sinkY = HIDDEN;
        this.facing = dampAngle(this.facing, Math.atan2(s.x - this.x, s.z - this.z) + Math.sin(this.time * 2) * 0.6, 2, dt);
        this.moveHead(def.chaseSpeed * 0.5 * dt);
        this.bubbleAcc += dt * 10;
        while (this.bubbleAcc > 1) {
          this.bubbleAcc -= 1;
          this.trailPoint(Math.random() * 6, this.v);
          ctx.effects.bubbles(this.v.setY(water), 2, 1.5);
        }
        if (this.phaseTime >= def.warningTime) {
          this.setPhase('emerging');
          ctx.effects.splash(this.v.set(this.x, water, this.z), 2.2);
          if (!this.surfaced) ctx.bus.emit('monsterSpawned', { instanceId: this.id, monsterId: def.id, tier: this.tier.tier });
          this.surfaced = true;
          ctx.bus.emit('monsterAttack', { monsterId: def.id, kind: 'hiss', position: { x: this.x, z: this.z } });
        }
        break;
      }
      case 'emerging': {
        this.sinkY = HIDDEN * (1 - smoothstep(0, EMERGE_TIME, this.phaseTime));
        this.swim(dt, ctx, dist);
        if (this.phaseTime >= EMERGE_TIME) this.setPhase('active');
        break;
      }
      case 'active': {
        this.sinkY = 0;
        this.updateActive(dt, ctx, dist);
        if (this.isDefeated) {
          this.emitDefeated(ctx);
          ctx.effects.hitSparks(this.v.set(this.x, water + 2, this.z), '#ffd166', 2);
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
        this.sinkY = -4.5 * smoothstep(0, 1, k);
        if (!this.escaped) this.roll = Math.PI * 0.5 * smoothstep(0, 0.6, k);
        else this.moveHead(this.def.chaseSpeed * dt);
        if (k >= 1) this.setPhase('gone');
        break;
      }
      case 'gone':
        return;
      case 'diving':
        this.setPhase('active');
        break;
    }
    this.place(ctx, water);
    this.updateFlash(dt);
  }

  /** Umkreisen in Schlangenlinien (auch während des Auftauchens). */
  private swim(dt: number, ctx: MonsterContext, dist: number): void {
    const def = this.def;
    const s = ctx.surfer;
    const speed = def.chaseSpeed * this.tier.speedMul;
    const r = this.grace > 0 ? def.preferredDistance + 12 : def.preferredDistance;
    // Zielpunkt etwas weiter auf dem Kreis um den Spieler (vorgehalten)
    const around = Math.atan2(this.z - s.z, this.x - s.x) + this.orbitDir * 0.55;
    const tx = s.x + s.vx * 0.6 + Math.cos(around) * r;
    const tz = s.z + s.vz * 0.6 + Math.sin(around) * r;
    const want = Math.atan2(tx - this.x, tz - this.z) + Math.sin(this.time * 1.9) * 0.5;
    this.facing = dampAngle(this.facing, want, 2.6, dt);
    // Tempo an den Spieler anpassen, damit sie dranbleibt
    const catchUp = dist > r + 8 ? Math.hypot(s.vx, s.vz) * 0.9 : 0;
    this.moveHead(Math.max(speed, catchUp) * dt);
    this.keepClearOfCamera(ctx, speed, dt);
    this.lift += (0.55 - this.lift) * Math.min(1, dt * 3);
    this.pitch *= Math.exp(-4 * dt);
    this.roll *= Math.exp(-4 * dt);
    this.jawOpen += (0.12 + 0.08 * Math.sin(this.time * 3) - this.jawOpen) * Math.min(1, dt * 4);
  }

  private updateActive(dt: number, ctx: MonsterContext, dist: number): void {
    const def = this.def;
    const atk = def.attack;
    const s = ctx.surfer;
    switch (this.mode) {
      case 'swim': {
        this.swim(dt, ctx, dist);
        this.telegraph.visible = false;
        this.cooldown -= dt;
        const canAttack = this.grace <= 0 && ctx.run.invulnerable <= 0 && !s.fsm.is('Wipeout');
        if (this.cooldown <= 0 && canAttack && dist < atk.reach) {
          this.setMode('rear');
          ctx.bus.emit('monsterAttack', { monsterId: def.id, kind: 'hiss', position: { x: this.x, z: this.z } });
        }
        break;
      }
      case 'rear': {
        // Aufrichten, Maul auf, Bahn zeigen
        const windup = atk.windup * this.tier.windupMul;
        const k = clamp01(this.modeTime / windup);
        const lead = atk.lead * windup;
        const px = s.x + s.vx * lead;
        const pz = s.z + s.vz * lead;
        const ax = px - this.x;
        const az = pz - this.z;
        const al = Math.hypot(ax, az) || 1;
        this.facing = dampAngle(this.facing, Math.atan2(ax, az), 7, dt);
        this.moveHead(-1.5 * dt * (1 - k));
        this.lungeX = Math.sin(this.facing);
        this.lungeZ = Math.cos(this.facing);
        this.lungeLength = al + this.param('overshoot', 10);
        this.lift = 0.55 + (this.param('rearHeight', 4.2) - 0.55) * smoothstep(0, 0.6, k);
        this.pitch = 0.35 * k;
        this.jawOpen = 0.15 + 0.6 * k;
        this.roll = Math.sin(this.time * 24) * 0.04 * k;
        const ex = this.x + this.lungeX * this.lungeLength;
        const ez = this.z + this.lungeZ * this.lungeLength;
        placeStripe(this.telegraph, this.x, this.z, ex, ez, ctx.world.heightAt((this.x + ex) / 2, (this.z + ez) / 2) + 0.3, atk.radius * 2);
        this.telegraph.visible = true;
        ((this.telegraph.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.4 * Math.sin(this.time * 18);
        if (this.modeTime >= windup) {
          this.lungeTravel = 0;
          this.hitDone = false;
          this.setMode('lunge');
          ctx.bus.emit('monsterAttack', { monsterId: def.id, kind: 'lunge', position: { x: this.x, z: this.z } });
        }
        break;
      }
      case 'lunge': {
        const step = this.param('lungeSpeed', 30) * this.tier.speedMul * dt;
        this.moveHead(step);
        this.lungeTravel += step;
        this.lift += (0.9 - this.lift) * Math.min(1, dt * 10);
        this.pitch += (-0.1 - this.pitch) * Math.min(1, dt * 10);
        this.jawOpen = 0.8;
        const hx = this.x + this.lungeX * 1.5;
        const hz = this.z + this.lungeZ * 1.5;
        if (!this.hitDone && Math.hypot(s.x - hx, s.z - hz) <= atk.radius) {
          this.hitDone = ctx.hitPlayer(def.id, hx, hz) || this.hitDone;
          if (this.hitDone) this.telegraph.visible = false;
        }
        if (Math.random() < dt * 30) ctx.effects.splash(this.v.set(this.x, ctx.world.heightAt(this.x, this.z), this.z), 0.6);
        if (this.lungeTravel >= this.lungeLength) {
          this.telegraph.visible = false;
          ctx.effects.splash(this.v.set(this.x, ctx.world.heightAt(this.x, this.z), this.z), 1.6);
          this.setMode('tired');
        }
        break;
      }
      case 'tired': {
        // Kopf liegt flach auf dem Wasser, Maul klappt zu, leichtes Taumeln
        const t = this.param('tiredTime', 1.8);
        this.lift += (0.05 - this.lift) * Math.min(1, dt * 5);
        this.pitch += (0.15 - this.pitch) * Math.min(1, dt * 5);
        this.roll = Math.sin(this.modeTime * 6) * 0.25 * (1 - clamp01(this.modeTime / t));
        this.jawOpen += (0.05 - this.jawOpen) * Math.min(1, dt * 8);
        this.moveHead(1.5 * dt);
        if (this.modeTime >= t) {
          this.orbitDir = Math.random() < 0.5 ? 1 : -1;
          this.cooldown = ctx.rng.range(atk.cooldown[0], atk.cooldown[1]) * this.tier.windupMul;
          this.setMode('swim');
        }
        break;
      }
    }
  }

  /** Kopf, Segmente und Trefferpunkte setzen. */
  private place(ctx: MonsterContext, water: number): void {
    const visible = this.phase !== 'warning';
    this.model.visible = visible;
    const headY = water + this.sinkY + this.lift;
    this.head.position.set(this.x, headY, this.z);
    this.head.rotation.set(this.pitch, this.facing, this.roll, 'YXZ');
    if (this.jaw) this.jaw.rotation.x = this.jawOpen;
    // Segmente auf der Spur; Bögen tauchen wellenförmig aus dem Wasser
    const spacing = this.param('spacing', 1.9);
    const humps = this.mode === 'tired' ? 0.35 : 1;
    let prevX = this.x;
    let prevY = headY;
    let prevZ = this.z;
    for (let i = 0; i < this.segs.length; i++) {
      const seg = this.segs[i]!;
      this.trailPoint(NECK + i * spacing, this.v);
      const w = ctx.world.heightAt(this.v.x, this.v.z);
      // Hals hebt sich mit dem Kopf (beim Aufrichten)
      const neck = Math.max(0, 1 - i / 3) * Math.max(0, this.lift - 0.6) * 0.7;
      const y = w + this.sinkY - 0.3 + 0.6 * Math.sin(this.time * 2.4 - i * 0.8) * humps + neck;
      seg.position.set(this.v.x, y, this.v.z);
      seg.lookAt(this.look.set(prevX, prevY, prevZ));
      prevX = this.v.x;
      prevY = y;
      prevZ = this.v.z;
    }
    this.parts[0]?.position.set(this.x, headY + 0.4, this.z);
    // Windungen als Trefferpunkte gleichmäßig auf dem Körper verteilen
    this.coils.forEach((p, k) => {
      const seg = this.segs[Math.round(((k + 1) * this.segs.length) / (this.coils.length + 1))] ?? this.segs[0];
      if (seg) p.position.copy(seg.position);
    });
  }
}
