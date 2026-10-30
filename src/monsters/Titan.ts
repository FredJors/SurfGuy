/**
 * Endgegner Kapitel 2: der Lava-Titan, Peles Wächter im Kratersee.
 *
 * Phase 1: wirft Feuerbälle (rote Ringe = Einschlag) und schlägt mit der Faust in den See –
 *          unter dem Spieler bricht dann Lava hervor (Ring zeigt die Stelle).
 * Phase 2 (ab 60 %): wirft doppelt und schickt Glutwellen übers Wasser – drüberspringen.
 * Phase 3 (ab 30 %): Feuerstrahl, der einmal im Kreis über den See fegt – drüberspringen.
 * Schaden nur durch Tricks: in seiner Nähe springt jeder Trick auf seinen Kopf.
 *
 * Mit behaviorParams.ice = 1 derselbe Kampf als Frostkoloss (Kapitel 3): Eisbrocken, Eisstacheln,
 * Frostwellen und ein Schneesturm-Strahl (nur andere Farben und Bezeichnungen).
 *
 * behaviorParams: trickRange, headHeight, throwRange, ballRadius, slamRange, slamRadius,
 *                 slamWindup, ringSpeed, ringRange, ringDodgeHeight, ringInterval, beamSpeed,
 *                 beamTurns, beamLength, beamDodgeHeight, beamWindup, beamInterval
 */
import * as THREE from 'three';
import { clamp01, smoothstep, wrapAngle } from '../core/math';
import { createRingTelegraph } from '../fx/telegraph';
import { addOutline } from '../fx/toon';
import { Monster, type MonsterContext, type MonsterSpawnArgs } from './Monster';

const RISE_DEPTH = -34;
const RETREAT_TIME = 4.5;
const THROW_WINDUP = 0.8;
const RING_WINDUP = 1.3;

interface Ball {
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

interface Ring {
  mesh: THREE.Mesh;
  radius: number;
  hitDone: boolean;
}

interface Eruption {
  x: number;
  z: number;
  t: number;
  dur: number;
  telegraph: THREE.Group;
  column: THREE.Mesh;
  fired: boolean;
}

interface Beam {
  angle: number;
  dir: 1 | -1;
  /** zurückgelegter Winkel (rad) */
  swept: number;
  windup: number;
  mesh: THREE.Group;
  playerSide: number;
}

const ballGeo = new THREE.IcosahedronGeometry(1.6, 1);

/** Farben der Angriffe je Stil (Lava/Eis) und Namen der Sprung-Bedrohungen */
const PALETTE = {
  lava: { ball: '#ff7a1a', ring: '#ff9a3c', column: '#ff8a2a', beamOuter: '#ff5a1a', beamInner: '#ffe08a', spark: '#ffd23f', ember: '#ffb347', mouth: '#ffcf6b', trail: '#ff9a3c', impact: '#ff7a1a', beamLabel: 'Feuerstrahl!', ringLabel: 'Glutwelle!' },
  ice: { ball: '#bfe8ff', ring: '#8fd8ff', column: '#dff6ff', beamOuter: '#5fc0ff', beamInner: '#ffffff', spark: '#e6f8ff', ember: '#dff4ff', mouth: '#bff0ff', trail: '#e6f8ff', impact: '#bfe8ff', beamLabel: 'Schneesturm!', ringLabel: 'Frostwelle!' },
} as const;
const columnGeo = new THREE.CylinderGeometry(1, 1.6, 1, 16, 1, true);
columnGeo.translate(0, 0.5, 0);

export class Titan extends Monster {
  private readonly model: THREE.Object3D;
  private readonly torso: THREE.Object3D | undefined;
  private readonly head: THREE.Object3D | undefined;
  private readonly arms: (THREE.Object3D | undefined)[];
  private readonly fores: (THREE.Object3D | undefined)[];
  private readonly core: THREE.Mesh | undefined;
  private readonly mouth: THREE.Mesh | undefined;
  private readonly balls: Ball[] = [];
  private readonly rings: Ring[] = [];
  private readonly eruptions: Eruption[] = [];
  private beam: Beam | null = null;
  private readonly pal: (typeof PALETTE)['lava' | 'ice'];
  private readonly ballMat: THREE.MeshBasicMaterial;
  private readonly ringMat: THREE.MeshBasicMaterial;
  private readonly ringGeo = new THREE.CylinderGeometry(1, 1, 1, 72, 1, true);
  private readonly columnMat: THREE.MeshBasicMaterial;
  private throwTimer = 3.5;
  private slamTimer = 6;
  private ringTimer = 2;
  private beamTimer = 2;
  private windup = 0;
  private windupKind: 'throw' | 'slam' | 'ring' | null = null;
  private throwSide: 1 | -1 = 1;
  private grace = 0;
  private time = 0;
  private sinkY = RISE_DEPTH;
  private yaw = 0;
  private armPose = { l: 0, r: 0, both: 0 };
  /** Kampfphase 1–3 */
  stage = 1;
  private readonly v = new THREE.Vector3();

  constructor(args: MonsterSpawnArgs) {
    super(args);
    this.pal = this.param('ice', 0) > 0 ? PALETTE.ice : PALETTE.lava;
    const glowIce = this.pal === PALETTE.ice ? 1.15 : 1;
    this.ballMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(this.pal.ball).multiplyScalar(2.2 / glowIce / glowIce) });
    this.ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(this.pal.ring).multiplyScalar(1.4), transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    this.columnMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(this.pal.column).multiplyScalar(1.8 / glowIce), transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    this.model = args.assets.create(args.def.model, { colors: args.def.colors });
    this.torso = this.model.getObjectByName('torso') ?? undefined;
    this.head = this.model.getObjectByName('head') ?? undefined;
    this.arms = [this.model.getObjectByName('armL'), this.model.getObjectByName('armR')];
    this.fores = [this.model.getObjectByName('forearmL'), this.model.getObjectByName('forearmR')];
    this.core = (this.model.getObjectByName('core') as THREE.Mesh | undefined) ?? undefined;
    this.mouth = (this.model.getObjectByName('mouth') as THREE.Mesh | undefined) ?? undefined;
    addOutline(this.model, 0.12);
    this.root.add(this.model);
    this.collectFlashMaterials();
  }

  /** Wut-Phase erreicht (für die Boss-Leiste) */
  get enraged(): boolean {
    return this.stage >= 2;
  }

  override dispose(): void {
    super.dispose();
    for (const b of this.balls) {
      b.mesh.removeFromParent();
      b.telegraph.removeFromParent();
    }
    for (const r of this.rings) r.mesh.removeFromParent();
    for (const e of this.eruptions) {
      e.telegraph.removeFromParent();
      e.column.removeFromParent();
    }
    this.beam?.mesh.removeFromParent();
  }

  override onPlayerHit(): void {
    this.grace = this.def.attack.graceAfterHit;
  }

  /** Tricks in der Nähe landen auf seinem Kopf. */
  override bounceTarget(water: number): { x: number; y: number; z: number } | null {
    if (this.phase !== 'active') return null;
    return { x: this.x + Math.sin(this.yaw) * 1.5, y: water + this.param('headHeight', 19), z: this.z + Math.cos(this.yaw) * 1.5 };
  }

  /**
   * Wie bald muss der Spieler springen? Glutwelle oder Feuerstrahl, umgerechnet in Meter bei
   * Ringwellen-Tempo (für den HUD-Hinweis „Spring!“); Infinity = nichts unterwegs.
   */
  override jumpThreatDistance(x: number, z: number): number {
    const d = Math.hypot(x - this.x, z - this.z);
    let best = Infinity;
    for (const r of this.rings) if (!r.hitDone && r.radius < d) best = Math.min(best, d - r.radius);
    const b = this.beam;
    if (b && b.windup <= 0 && d > 6 && d < this.param('beamLength', 135)) {
      const ahead = wrapAngle(Math.atan2(z - this.z, x - this.x) - b.angle) * b.dir;
      if (ahead > 0 && ahead < 1.5) {
        const seconds = ahead / this.param('beamSpeed', 0.5);
        best = Math.min(best, seconds * this.param('ringSpeed', 18));
      }
    }
    return best;
  }

  override jumpThreatLabel(): string {
    return this.beam ? this.pal.beamLabel : this.pal.ringLabel;
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
        // Er steigt aus dem See: Blasen, Spritzer, Beben
        const k = smoothstep(0, def.warningTime, this.phaseTime);
        this.sinkY = RISE_DEPTH * (1 - k);
        if (Math.random() < dt * 40) {
          ctx.effects.splash(this.v.set(this.x + (Math.random() - 0.5) * 24, water, this.z + (Math.random() - 0.5) * 24), 2 + k * 3);
        }
        if (this.phaseTime >= def.warningTime) {
          this.sinkY = 0;
          this.setPhase('active');
          ctx.effects.splash(this.v.set(this.x, water, this.z), 6);
          ctx.bus.emit('monsterSpawned', { instanceId: this.id, monsterId: def.id, tier: this.tier.tier });
          ctx.bus.emit('bossEvent', { kind: 'awaken', monsterId: def.id, position: { x: this.x, z: this.z } });
        }
        break;
      }
      case 'emerging':
        this.setPhase('active');
        break;
      case 'active': {
        this.updateActive(dt, ctx, dist);
        if (this.isDefeated) {
          this.emitDefeated(ctx);
          ctx.bus.emit('bossEvent', { kind: 'defeated', monsterId: def.id, position: { x: this.x, z: this.z } });
          ctx.effects.hitSparks(this.v.set(this.x, water + 14, this.z), this.pal.spark, 4);
          this.clearAttacks();
          this.setPhase('retreating');
        }
        break;
      }
      case 'retreating': {
        // Zerfällt: kippt nach hinten, Glut erlischt, versinkt im See
        const k = clamp01(this.phaseTime / RETREAT_TIME);
        this.sinkY = RISE_DEPTH * smoothstep(0.25, 1, k);
        if (this.torso) this.torso.rotation.x = -0.6 * smoothstep(0, 0.5, k);
        if (Math.random() < dt * 25) ctx.effects.splash(this.v.set(this.x + (Math.random() - 0.5) * 18, water, this.z + (Math.random() - 0.5) * 18), 3);
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
    this.updateBeam(dt, ctx);

    // --- Darstellung ---
    if (!this.beam) {
      let diff = Math.atan2(dx, dz) - this.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.yaw += diff * Math.min(1, dt * 0.9);
    }
    const breathe = Math.sin(this.time * 1.1) * 0.35;
    this.root.position.set(this.x, water + this.sinkY + breathe, this.z);
    this.root.rotation.y = this.yaw;
    this.root.visible = this.phaseTime > 0.3 || this.phase !== 'warning';
    if (this.torso && this.phase !== 'retreating') {
      this.torso.rotation.x = 0.08 + Math.sin(this.time * 0.9) * 0.04 + this.armPose.both * 0.18;
      this.torso.rotation.z = Math.sin(this.time * 0.7) * 0.05;
    }
    if (this.head) {
      this.head.rotation.x = this.beam ? 0.35 : 0.1 + Math.sin(this.time * 1.3) * 0.05;
      this.head.rotation.y = Math.sin(this.time * 0.8) * 0.12;
    }
    this.poseArms(dt);
    // Kern pulsiert, Maul glüht beim Feuerstrahl
    const pulse = 1 + Math.sin(this.time * (this.stage >= 3 ? 7 : this.stage === 2 ? 5 : 3)) * 0.12;
    this.core?.scale.setScalar(pulse);
    this.mouth?.scale.set(1, this.beam ? 2.2 + Math.sin(this.time * 30) * 0.3 : 1, 1);
    // Wut: Glutfunken steigen auf
    if (this.stage >= 2 && this.phase === 'active' && Math.random() < dt * 16) {
      ctx.effects.particles.emit({
        position: this.v.set(this.x + (Math.random() - 0.5) * 12, water + 10 + Math.random() * 8, this.z + (Math.random() - 0.5) * 8),
        count: 2,
        spread: 1,
        up: 4,
        life: [0.8, 1.5],
        size: [0.4, 0.8],
        color: this.pal.ember,
        gravity: -2,
        drag: 1,
      });
    }

    // Trefferpunkte: Kopf und glühender Kern
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    this.parts[0]?.position.set(this.x + fx * 1.5, water + this.sinkY + this.param('headHeight', 19), this.z + fz * 1.5);
    this.parts[1]?.position.set(this.x + fx * 4, water + this.sinkY + 10, this.z + fz * 4);
    this.updateFlash(dt);
  }

  /** Arme je nach Angriff: Ausholen zum Wurf, Faust heben, beide hoch zum Schlag auf den See. */
  private poseArms(dt: number): void {
    const P = this.armPose;
    const throwing = this.windupKind === 'throw' ? 1 : 0;
    const slamming = this.windupKind === 'slam' ? 1 : 0;
    const ringing = this.windupKind === 'ring' ? 1 : 0;
    const targetL = (this.throwSide < 0 ? throwing : 0) + (this.throwSide < 0 ? slamming : 0);
    const targetR = (this.throwSide > 0 ? throwing : 0) + (this.throwSide > 0 ? slamming : 0);
    P.l += (targetL - P.l) * Math.min(1, dt * 5);
    P.r += (targetR - P.r) * Math.min(1, dt * 5);
    P.both += (ringing - P.both) * Math.min(1, dt * 4);
    const sway = Math.sin(this.time * 1.2) * 0.12;
    const [aL, aR] = this.arms;
    const [fL, fR] = this.fores;
    const up = (k: number) => -2.6 * Math.min(1, k + P.both);
    if (aL) aL.rotation.set(up(P.l) + sway, 0, 0.35 + P.both * 0.3);
    if (aR) aR.rotation.set(up(P.r) - sway, 0, -0.35 - P.both * 0.3);
    if (fL) fL.rotation.x = -0.5 - P.l * 0.6;
    if (fR) fR.rotation.x = -0.5 - P.r * 0.6;
  }

  private clearAttacks(): void {
    this.windupKind = null;
    for (const e of this.eruptions) {
      e.telegraph.removeFromParent();
      e.column.removeFromParent();
    }
    this.eruptions.length = 0;
    if (this.beam) {
      this.beam.mesh.removeFromParent();
      this.beam = null;
    }
  }

  private updateActive(dt: number, ctx: MonsterContext, dist: number): void {
    const def = this.def;
    const atk = def.attack;
    // Phasenwechsel
    if (this.stage === 1 && this.hp <= this.maxHp * 0.6) {
      this.stage = 2;
      this.ringTimer = 1.5;
      ctx.bus.emit('bossEvent', { kind: 'enrage', monsterId: def.id, position: { x: this.x, z: this.z } });
    } else if (this.stage === 2 && this.hp <= this.maxHp * 0.3) {
      this.stage = 3;
      this.beamTimer = 1.5;
      ctx.bus.emit('bossEvent', { kind: 'rage', monsterId: def.id, position: { x: this.x, z: this.z } });
    }
    if (this.beam) return;
    const canAttack = this.grace <= 0 && ctx.run.invulnerable <= 0 && !ctx.surfer.fsm.is('Wipeout');

    if (this.windupKind) {
      this.windup -= dt;
      if (this.windup <= 0) {
        if (this.windupKind === 'throw') this.throwBalls(ctx);
        else if (this.windupKind === 'ring') this.sendRing(ctx);
        this.windupKind = null;
      }
      return;
    }

    this.throwTimer -= dt;
    this.slamTimer -= dt;
    this.ringTimer -= dt;
    this.beamTimer -= dt;
    if (this.stage >= 3 && this.beamTimer <= 0 && canAttack) {
      this.startBeam(ctx);
      return;
    }
    if (this.stage >= 2 && this.ringTimer <= 0 && dist < this.param('ringRange', 140)) {
      this.windupKind = 'ring';
      this.windup = RING_WINDUP;
      this.ringTimer = this.param('ringInterval', 6.5) * ctx.rng.range(0.85, 1.15);
      return;
    }
    if (this.slamTimer <= 0 && canAttack && dist < this.param('slamRange', 55)) {
      this.startSlam(ctx);
      return;
    }
    if (this.throwTimer <= 0 && canAttack && dist < this.param('throwRange', 120)) {
      this.windupKind = 'throw';
      this.windup = THROW_WINDUP * this.tier.windupMul;
      this.throwSide = ctx.rng.chance(0.5) ? 1 : -1;
      this.throwTimer = ctx.rng.range(atk.cooldown[0], atk.cooldown[1]) * (this.stage >= 2 ? 0.75 : 1);
    }
  }

  /** Faustschlag in den See: unter dem Spieler bricht kurz darauf Lava hervor. */
  private startSlam(ctx: MonsterContext): void {
    const s = ctx.surfer;
    const lead = 0.55;
    const x = s.x + s.vx * lead;
    const z = s.z + s.vz * lead;
    const R = this.param('slamRadius', 8);
    const telegraph = createRingTelegraph('#ff3b30');
    telegraph.visible = true;
    telegraph.position.set(x, ctx.world.heightAt(x, z) + 0.12, z);
    telegraph.scale.setScalar(R * 0.4);
    const column = new THREE.Mesh(columnGeo, this.columnMat);
    column.visible = false;
    column.position.set(x, ctx.world.heightAt(x, z) - 0.5, z);
    this.root.parent?.add(telegraph, column);
    this.eruptions.push({ x, z, t: 0, dur: this.param('slamWindup', 1.3) * this.tier.windupMul, telegraph, column, fired: false });
    this.throwSide = ctx.rng.chance(0.5) ? 1 : -1;
    // Faust bleibt oben, bis die Lava hervorbricht
    this.windupKind = 'slam';
    this.windup = this.eruptions[this.eruptions.length - 1]!.dur * 0.85;
    this.slamTimer = ctx.rng.range(5, 7.5) * (this.stage >= 2 ? 0.8 : 1);
  }

  private throwBalls(ctx: MonsterContext): void {
    const s = ctx.surfer;
    const atk = this.def.attack;
    const count = this.stage >= 2 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      const side = this.throwSide;
      const sx = this.x + fx * 4 + fz * 9 * side;
      const sz = this.z + fz * 4 - fx * 9 * side;
      const sy = ctx.world.heightAt(this.x, this.z) + 24;
      const spread = i === 0 ? 0 : 7;
      const tx = s.x + s.vx * atk.lead + ctx.rng.range(-2.5, 2.5) + (i ? Math.cos(s.heading) * spread : 0);
      const tz = s.z + s.vz * atk.lead + ctx.rng.range(-2.5, 2.5) - (i ? Math.sin(s.heading) * spread : 0);
      const d = Math.hypot(tx - sx, tz - sz);
      const mesh = new THREE.Mesh(ballGeo, this.ballMat);
      const telegraph = createRingTelegraph('#ff3b30');
      telegraph.visible = true;
      telegraph.position.set(tx, ctx.world.heightAt(tx, tz) + 0.12, tz);
      telegraph.scale.setScalar(this.param('ballRadius', 3.6));
      this.root.parent?.add(mesh, telegraph);
      this.balls.push({ mesh, telegraph, sx, sy, sz, tx, tz, peak: 8 + d * 0.15, t: 0, dur: Math.max(1.2, Math.min(2.2, d / 28)) });
    }
    ctx.bus.emit('bossEvent', { kind: 'throw', monsterId: this.def.id, position: { x: this.x, z: this.z } });
  }

  private sendRing(ctx: MonsterContext): void {
    const water = ctx.world.heightAt(this.x, this.z);
    ctx.effects.splash(this.v.set(this.x, water, this.z), 6);
    const mesh = new THREE.Mesh(this.ringGeo, this.ringMat);
    mesh.position.set(this.x, water, this.z);
    mesh.renderOrder = 3;
    this.root.parent?.add(mesh);
    this.rings.push({ mesh, radius: 12, hitDone: false });
    ctx.bus.emit('bossEvent', { kind: 'stomp', monsterId: this.def.id, position: { x: this.x, z: this.z } });
  }

  private startBeam(ctx: MonsterContext): void {
    const s = ctx.surfer;
    const L = this.param('beamLength', 135);
    const g = new THREE.Group();
    // Strahl auf dem See: leuchtender Streifen + heller Kern
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(this.pal.beamOuter).multiplyScalar(1.6), transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    outer.rotation.x = -Math.PI / 2;
    outer.scale.set(L, 4.2, 1);
    outer.position.x = L / 2 + 6;
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(this.pal.beamInner).multiplyScalar(2.2), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    inner.rotation.x = -Math.PI / 2;
    inner.scale.set(L, 1.2, 1);
    inner.position.set(L / 2 + 6, 0.05, 0);
    g.add(outer, inner);
    g.renderOrder = 3;
    this.root.parent?.add(g);
    // Start etwas neben dem Spieler, dreht auf ihn zu
    const toPlayer = Math.atan2(s.z - this.z, s.x - this.x);
    const dir: 1 | -1 = ctx.rng.chance(0.5) ? 1 : -1;
    const angle = toPlayer - dir * 1.4;
    this.beam = { angle, dir, swept: 0, windup: this.param('beamWindup', 1.6), mesh: g, playerSide: 0 };
    this.beamTimer = this.param('beamInterval', 9);
    ctx.bus.emit('bossEvent', { kind: 'beam', monsterId: this.def.id, position: { x: this.x, z: this.z } });
  }

  private updateBeam(dt: number, ctx: MonsterContext): void {
    const b = this.beam;
    if (!b) return;
    const s = ctx.surfer;
    const water = ctx.world.heightAt(this.x, this.z);
    b.mesh.position.set(this.x, water + 0.25, this.z);
    b.mesh.rotation.y = -b.angle;
    // Titan schaut in Strahlrichtung
    this.yaw = Math.atan2(Math.cos(b.angle), Math.sin(b.angle));
    const [outer, inner] = b.mesh.children as THREE.Mesh[];
    if (b.windup > 0) {
      // Vorwarnung: nur ein dünner, flackernder Streifen
      b.windup -= dt;
      (outer!.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.15 * Math.sin(this.time * 20);
      inner!.visible = false;
      return;
    }
    inner!.visible = true;
    (outer!.material as THREE.MeshBasicMaterial).opacity = 0.6;
    const step = this.param('beamSpeed', 0.5) * dt;
    const prev = wrapAngle(Math.atan2(s.z - this.z, s.x - this.x) - b.angle);
    b.angle += b.dir * step;
    b.swept += step;
    const now = wrapAngle(Math.atan2(s.z - this.z, s.x - this.x) - b.angle);
    const d = Math.hypot(s.x - this.x, s.z - this.z);
    // Strahl fegt über den Spieler hinweg?
    if (Math.sign(prev) !== Math.sign(now) && Math.abs(now) < 0.6 && d > 6 && d < this.param('beamLength', 135) + 6) {
      const air = s.y - ctx.world.heightAt(s.x, s.z);
      if (air < this.param('beamDodgeHeight', 0.8)) ctx.hitPlayer(this.def.id, s.x, s.z);
    }
    if (Math.random() < dt * 30) {
      const r = 10 + Math.random() * this.param('beamLength', 135);
      ctx.effects.particles.emit({
        position: this.v.set(this.x + Math.cos(b.angle) * r, water + 0.6, this.z + Math.sin(b.angle) * r),
        count: 3,
        spread: 1.5,
        up: 5,
        life: [0.4, 0.8],
        size: [0.5, 1],
        color: this.pal.mouth,
        gravity: 6,
        drag: 1,
      });
    }
    if (b.swept >= Math.PI * 2 * this.param('beamTurns', 1)) {
      b.mesh.removeFromParent();
      this.beam = null;
      this.throwTimer = 1.5;
      this.slamTimer = 2.5;
    }
  }

  private updateProjectiles(dt: number, ctx: MonsterContext): void {
    const s = ctx.surfer;
    // Feuerbälle
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i]!;
      b.t += dt;
      const k = Math.min(1, b.t / b.dur);
      const ground = ctx.world.heightAt(b.tx, b.tz);
      b.mesh.position.set(b.sx + (b.tx - b.sx) * k, b.sy + (ground - b.sy) * k + Math.sin(Math.PI * k) * b.peak, b.sz + (b.tz - b.sz) * k);
      b.mesh.rotation.x += dt * 4;
      b.telegraph.scale.setScalar(this.param('ballRadius', 3.6) * (0.85 + 0.15 * Math.sin(b.t * (8 + k * 20))));
      if (Math.random() < dt * 40) {
        ctx.effects.particles.emit({ position: b.mesh.position, count: 2, spread: 0.6, up: 0.5, life: [0.3, 0.6], size: [0.6, 1.1], color: this.pal.trail, gravity: -1, drag: 2 });
      }
      if (k >= 1) {
        ctx.effects.splash(this.v.set(b.tx, ground, b.tz), 2.6);
        ctx.effects.hitSparks(this.v.set(b.tx, ground + 0.8, b.tz), this.pal.impact, 1.4);
        ctx.bus.emit('bossEvent', { kind: 'impact', monsterId: this.def.id, position: { x: b.tx, z: b.tz } });
        if (Math.hypot(s.x - b.tx, s.z - b.tz) <= this.param('ballRadius', 3.6)) ctx.hitPlayer(this.def.id, b.tx, b.tz);
        b.mesh.removeFromParent();
        b.telegraph.removeFromParent();
        this.balls.splice(i, 1);
      }
    }
    // Lava-Ausbrüche nach dem Faustschlag
    const R = this.param('slamRadius', 8);
    for (let i = this.eruptions.length - 1; i >= 0; i--) {
      const e = this.eruptions[i]!;
      e.t += dt;
      const k = clamp01(e.t / e.dur);
      if (!e.fired) {
        e.telegraph.scale.setScalar(R * (0.4 + 0.6 * k));
        ((e.telegraph.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.45 * Math.sin(e.t * (8 + k * 18));
        if (k >= 1) {
          e.fired = true;
          e.t = 0;
          e.telegraph.visible = false;
          e.column.visible = true;
          const ground = ctx.world.heightAt(e.x, e.z);
          ctx.effects.splash(this.v.set(e.x, ground, e.z), 4);
          ctx.bus.emit('bossEvent', { kind: 'slam', monsterId: this.def.id, position: { x: e.x, z: e.z } });
          const air = s.y - ctx.world.heightAt(s.x, s.z);
          if (Math.hypot(s.x - e.x, s.z - e.z) <= R && air < 1.6) ctx.hitPlayer(this.def.id, e.x, e.z);
        }
      } else {
        // Lavasäule schießt hoch und fällt zusammen
        const life = 0.9;
        const q = clamp01(e.t / life);
        const height = 16 * Math.sin(Math.PI * Math.min(1, q * 1.2));
        e.column.scale.set(R * 0.55 * (1 - q * 0.4), Math.max(0.2, height), R * 0.55 * (1 - q * 0.4));
        if (q >= 1) {
          e.telegraph.removeFromParent();
          e.column.removeFromParent();
          this.eruptions.splice(i, 1);
        }
      }
    }
    // Glutwellen
    const speed = this.param('ringSpeed', 18);
    const range = this.param('ringRange', 140);
    const d = Math.hypot(s.x - this.x, s.z - this.z);
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i]!;
      const prev = ring.radius;
      ring.radius += speed * dt;
      const k = ring.radius / range;
      const height = 2.4 * (1 - k * 0.5);
      ring.mesh.scale.set(ring.radius, height, ring.radius);
      ring.mesh.position.y = ctx.world.heightAt(this.x, this.z) + height * 0.5 - 0.8;
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k * 0.6);
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
