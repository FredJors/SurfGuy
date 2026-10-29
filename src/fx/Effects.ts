/**
 * „Juice“: Gischt am Brett, Spritzer beim Landen, Treffer-Funken, Blasen, Perlen-Glitzer,
 * weicher Blob-Schatten unter dem Surfer. Hängt sich an Spielereignisse.
 */
import * as THREE from 'three';
import type { GameEventBus } from '../core/events';
import type { Surfer } from '../player/Surfer';
import type { UI } from '../ui/UI';
import type { World } from '../world/World';
import { Particles } from './Particles';

let shadowTexture: THREE.CanvasTexture | null = null;
function getShadowTexture(): THREE.CanvasTexture | null {
  if (shadowTexture) return shadowTexture;
  if (typeof document === 'undefined') return null; // z. B. in Tests ohne Browser
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, 'rgba(10,30,80,0.55)');
  g.addColorStop(0.6, 'rgba(10,30,80,0.3)');
  g.addColorStop(1, 'rgba(10,30,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  shadowTexture = new THREE.CanvasTexture(c);
  return shadowTexture;
}

let glowTexture: THREE.CanvasTexture | null = null;
function getGlowTexture(): THREE.CanvasTexture | null {
  if (glowTexture) return glowTexture;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

/** Leuchtender Fleck auf dem Wasser (additiv), z. B. Quallen-Vorwarnung. */
export function createGlow(size: number, color: THREE.ColorRepresentation): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: getGlowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

/** Weicher Schatten-Fleck auf dem Wasser. */
export function createBlobShadow(size: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: getShadowTexture(), transparent: true, depthWrite: false, fog: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

/** Halbtransparente Seifenblase mit hellem Rand (Fresnel). */
function createBubble(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color('#9be8ff') } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        float shine = step(0.93, dot(normalize(vN), normalize(vec3(-0.4, 0.6, 0.7))));
        gl_FragColor = vec4(mix(uColor, vec3(1.0), shine), 0.12 + rim * 0.6 + shine * 0.6);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), mat);
  m.visible = false;
  m.renderOrder = 6;
  return m;
}

const CONFETTI = ['#ff4f6d', '#ffd23f', '#3fe0ff', '#7dee8a', '#ff8ad8', '#ffffff'];

interface Shockwave {
  mesh: THREE.Mesh;
  t: number;
  dur: number;
  size: number;
}

export class Effects {
  readonly particles = new Particles(2400);
  private readonly shadow: THREE.Mesh;
  private readonly shockwaves: Shockwave[] = [];
  private readonly shockGeo = new THREE.RingGeometry(0.82, 1, 40);
  /** Letzte Surfer-Position (für Effekte an Events ohne Position) */
  private readonly surferPos = new THREE.Vector3();
  private readonly bubble: THREE.Mesh;
  private sprayAcc = 0;
  private readonly v = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();
  private readonly offs: (() => void)[] = [];
  private trailAcc = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    readonly ui: UI,
    bus: GameEventBus,
    private readonly world: World,
  ) {
    scene.add(this.particles.points);
    this.shadow = createBlobShadow(2.6);
    scene.add(this.shadow);
    this.bubble = createBubble();
    scene.add(this.bubble);

    this.offs.push(
      bus.on('landed', (e) => this.splash(this.v.set(e.position.x, this.world.heightAt(e.position.x, e.position.z), e.position.z), 1 + e.airtime)),
      bus.on('jump', (e) => this.splash(this.v.set(e.position.x, this.world.heightAt(e.position.x, e.position.z), e.position.z), 0.6)),
      bus.on('waveCaught', () => {
        /* Gischt kommt über update() */
      }),
      bus.on('pearlCollected', (e) => this.sparkle(this.v.set(e.position.x, e.position.y, e.position.z), '#ffd6f0')),
      bus.on('monsterHit', (e) => this.hitSparks(this.v.set(e.position.x, e.position.y, e.position.z), e.weakness ? '#ffd23f' : '#ffffff', e.weakness ? 1.6 : 1)),
      bus.on('trickLanded', (e) => {
        if (e.quality === 'okay') return;
        this.confetti(this.surferPos, e.quality === 'perfect' ? 1.4 : 0.8);
        this.shockwave(this.surferPos, e.quality === 'perfect' ? '#ffd23f' : '#ffffff', e.quality === 'perfect' ? 12 : 8);
      }),
      bus.on('monsterDefeated', (e) => {
        const p = this.v.set(e.position.x, this.world.heightAt(e.position.x, e.position.z) + 2, e.position.z);
        this.confetti(p, 1.6);
        this.shockwave(p, '#ff8ad8', 16);
      }),
      bus.on('launched', (e) => {
        const p = this.v.set(e.position.x, this.world.heightAt(e.position.x, e.position.z), e.position.z);
        this.splash(p, 1.4 + e.power);
        this.shockwave(p, '#ffffff', 7 + e.power * 4);
      }),
    );
  }

  /** Wasserspritzer (Stärke ~0.5–3). */
  splash(pos: THREE.Vector3, strength = 1): void {
    this.particles.emit({
      position: pos,
      count: Math.round(18 * strength),
      spread: 2.2 * strength,
      up: 4 + 2.5 * strength,
      life: [0.5, 1.1],
      size: [0.25, 0.55],
      color: '#ffffff',
      gravity: 14,
      drag: 1.2,
      jitter: 0.8,
      grow: -0.5,
    });
    this.particles.emit({
      position: pos,
      count: Math.round(8 * strength),
      spread: 1.2 * strength,
      up: 1,
      life: [0.6, 1.2],
      size: [0.4, 0.8],
      color: '#bff3ff',
      gravity: 2,
      drag: 2,
      jitter: 1.2,
      grow: 0.6,
    });
  }

  hitSparks(pos: THREE.Vector3, color = '#ffffff', strength = 1): void {
    this.particles.emit({ position: pos, count: Math.round(26 * strength), spread: 6 * strength, up: 3, life: [0.3, 0.7], size: [0.25, 0.6], color, gravity: 6, drag: 3, grow: -0.8 });
    this.particles.emit({ position: pos, count: 10, spread: 3, up: 1, life: [0.4, 0.8], size: [0.6, 1.1], color: '#ffffff', gravity: 0, drag: 4, grow: -0.9 });
  }

  bubbles(pos: THREE.Vector3, count = 4, radius = 3): void {
    this.particles.emit({ position: pos, count, spread: 0.4, up: 2.2, life: [0.5, 1.1], size: [0.2, 0.55], color: '#d8f7ff', gravity: -1, drag: 1, jitter: radius, grow: 0.3 });
  }

  sparkle(pos: THREE.Vector3, color: string): void {
    this.particles.emit({ position: pos, count: 16, spread: 2.5, up: 2, life: [0.35, 0.7], size: [0.15, 0.35], color, gravity: 3, drag: 2, grow: -0.8 });
  }

  /** Bunte Konfetti-Explosion. */
  confetti(pos: THREE.Vector3, strength = 1): void {
    for (const color of CONFETTI) {
      this.particles.emit({ position: pos, count: Math.round(7 * strength), spread: 7 * strength, up: 6 * strength, life: [0.7, 1.4], size: [0.22, 0.42], color, gravity: 9, drag: 1.6, jitter: 0.6, grow: -0.3 });
    }
  }

  /** Ring, der sich auf dem Wasser ausbreitet. */
  shockwave(pos: THREE.Vector3, color: THREE.ColorRepresentation, size = 10, duration = 0.6): void {
    let sw = this.shockwaves.find((s) => s.t >= s.dur);
    if (!sw) {
      const mesh = new THREE.Mesh(this.shockGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 2;
      this.scene.add(mesh);
      sw = { mesh, t: 0, dur: 0, size: 1 };
      this.shockwaves.push(sw);
    }
    sw.t = 0;
    sw.dur = duration;
    sw.size = size;
    sw.mesh.visible = true;
    sw.mesh.position.set(pos.x, this.world.heightAt(pos.x, pos.z) + 0.15, pos.z);
    (sw.mesh.material as THREE.MeshBasicMaterial).color.set(color);
  }

  /** Einsammel-Effekt für Kisten und Power-ups. */
  pickupBurst(pos: THREE.Vector3, color: string): void {
    this.confetti(pos, 1);
    this.particles.emit({ position: pos, count: 30, spread: 8, up: 4, life: [0.4, 0.9], size: [0.3, 0.7], color, gravity: 4, drag: 2.5, grow: -0.7 });
    this.shockwave(pos, color, 12);
  }

  /** Schutzblase um den Surfer (Blasenschild); remaining = verbleibende Sekunden. */
  updateShield(remaining: number, s: Surfer, time: number): void {
    this.bubble.visible = remaining > 0 && (remaining > 2 || Math.floor(time * 8) % 2 === 0);
    if (!this.bubble.visible) return;
    this.bubble.position.set(s.x, s.y + 0.95, s.z);
    const k = 1 + Math.sin(time * 5) * 0.04;
    this.bubble.scale.set(1.35 * k, 1.25 / k, 1.35 * k);
  }

  /** Projiziert eine Weltposition auf den Bildschirm (Pixel). */
  toScreen(pos: THREE.Vector3): { x: number; y: number; visible: boolean } {
    this.v2.copy(pos).project(this.camera);
    return {
      x: (this.v2.x * 0.5 + 0.5) * window.innerWidth,
      y: (-this.v2.y * 0.5 + 0.5) * window.innerHeight,
      visible: this.v2.z < 1,
    };
  }

  update(dt: number, realDt: number, s: Surfer, world: World): void {
    this.particles.update(dt);
    this.surferPos.set(s.x, s.y + 1, s.z);
    // Partikelspur des laufenden Tricks (Flammen, Funken …)
    const trail = s.fsm.is('TrickPerforming') ? s.trick?.def.trail : undefined;
    if (trail) {
      this.trailAcc += dt * trail.rate;
      const n = Math.floor(this.trailAcc);
      this.trailAcc -= n;
      if (n > 0) {
        const sz = trail.size ?? 0.5;
        this.particles.emit({ position: this.surferPos, count: n, spread: 0.8, up: 1, life: [0.2, 0.45], size: [sz * 0.6, sz * 1.3], color: trail.color, gravity: -2, drag: 3, jitter: 1.2 });
      }
    }

    for (const sw of this.shockwaves) {
      if (sw.t >= sw.dur) continue;
      sw.t += realDt;
      const k = Math.min(1, sw.t / sw.dur);
      const r = sw.size * (0.2 + 0.8 * (1 - (1 - k) * (1 - k)));
      sw.mesh.scale.setScalar(r);
      (sw.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k);
      if (k >= 1) sw.mesh.visible = false;
    }

    // Blob-Schatten unter dem Surfer
    const water = world.heightAt(s.x, s.z);
    const height = Math.max(0, s.y - water);
    this.shadow.position.set(s.x, water + 0.06, s.z);
    const k = Math.max(0.35, 1 - height * 0.12);
    this.shadow.scale.set(k, k * 1.4, k);
    this.shadow.rotation.set(-Math.PI / 2, 0, -s.heading);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.25, 1 - height * 0.15);

    // Gischt am Brett, abhängig vom Tempo
    if (!s.isAirborne && !s.fsm.is('Walking') && s.speed > 2.5 && dt > 0) {
      this.sprayAcc += dt * (s.speed * 2.2 + (s.rideWaveId !== null ? 16 : 0));
      const fx = s.forwardX;
      const fz = s.forwardZ;
      while (this.sprayAcc >= 1) {
        this.sprayAcc -= 1;
        const side = Math.random() < 0.5 ? -1 : 1;
        const back = -0.6 - Math.random() * 0.6;
        this.v.set(s.x + fx * back + fz * side * 0.35, water + 0.1, s.z + fz * back - fx * side * 0.35);
        const sp = Math.min(1, s.speed / 15);
        this.v2.set(fz * side * (1.5 + sp * 2.5) - fx * 1.5, 0, -fx * side * (1.5 + sp * 2.5) - fz * 1.5);
        this.particles.emit({
          position: this.v,
          velocity: this.v2,
          count: 1,
          spread: 0.6,
          up: 1.5 + sp * 3.5,
          life: [0.35, 0.75],
          size: [0.18, 0.4 + sp * 0.25],
          color: '#ffffff',
          gravity: 12,
          drag: 1.5,
          grow: 0.2,
        });
      }
    }
  }

  dispose(): void {
    this.offs.forEach((o) => o());
  }
}
