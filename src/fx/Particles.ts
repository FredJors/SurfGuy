/**
 * Leichtgewichtiges Partikelsystem (ein Draw-Call): Gischt, Spritzer, Treffer-Funken, Blasen.
 * Weiche, runde Sprites mit Größe/Farbe/Transparenz pro Partikel.
 */
import * as THREE from 'three';

const vertex = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
uniform float uScale;
uniform float uMaxSize;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float size = aSize * uScale / max(0.1, -mv.z);
  // Sehr nahe Partikel nicht riesig werden lassen; dafür etwas durchsichtiger
  gl_PointSize = min(size, uMaxSize);
  vAlpha *= mix(1.0, 0.55, smoothstep(uMaxSize * 0.6, uMaxSize * 1.6, size));
  gl_Position = projectionMatrix * mv;
}
`;

const fragment = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  // Weicher Tropfen: heller Kern mit Glanz, zum Rand hin auslaufend
  float edge = smoothstep(0.5, 0.18, d);
  float shade = smoothstep(-0.35, 0.3, -c.y - c.x * 0.4);
  vec3 col = vColor * (0.86 + 0.14 * shade);
  col += vec3(0.25) * smoothstep(0.16, 0.0, length(c - vec2(-0.12, -0.14)));
  gl_FragColor = vec4(col, vAlpha * edge);
  #include <colorspace_fragment>
}
`;

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface EmitOptions {
  position: Vec3Like;
  count: number;
  /** Grundgeschwindigkeit */
  velocity?: Vec3Like;
  /** Zufällige Streuung der Geschwindigkeit */
  spread?: number;
  /** Zusätzlich nach oben */
  up?: number;
  life?: [number, number];
  size?: [number, number];
  color?: THREE.ColorRepresentation;
  gravity?: number;
  drag?: number;
  /** Positionsstreuung */
  jitter?: number;
  /** Partikel wachsen (+) oder schrumpfen (−) über die Lebenszeit */
  grow?: number;
}

export class Particles {
  readonly points: THREE.Points;
  private readonly max: number;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly color: Float32Array;
  private readonly size: Float32Array;
  private readonly baseSize: Float32Array;
  private readonly alpha: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly gravity: Float32Array;
  private readonly drag: Float32Array;
  private readonly grow: Float32Array;
  private cursor = 0;
  private readonly geo: THREE.BufferGeometry;
  private readonly tmpColor = new THREE.Color();
  private readonly material: THREE.ShaderMaterial;

  constructor(max = 1500) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.color = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      uniforms: { uScale: { value: 300 }, uMaxSize: { value: 48 } },
    });
    this.points = new THREE.Points(this.geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  /** Passt die Partikelgröße an die Bildschirmhöhe an. */
  setViewportHeight(px: number, fovDeg: number): void {
    this.material.uniforms.uScale!.value = px / (2 * Math.tan((fovDeg * Math.PI) / 360));
    this.material.uniforms.uMaxSize!.value = Math.max(16, px * 0.07);
  }

  emit(o: EmitOptions): void {
    const c = this.tmpColor.set(o.color ?? '#ffffff');
    const spread = o.spread ?? 1;
    const jitter = o.jitter ?? 0;
    const [l0, l1] = o.life ?? [0.5, 1];
    const [s0, s1] = o.size ?? [0.2, 0.4];
    for (let n = 0; n < o.count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const i3 = i * 3;
      this.pos[i3] = o.position.x + (Math.random() - 0.5) * jitter;
      this.pos[i3 + 1] = o.position.y + (Math.random() - 0.5) * jitter * 0.5;
      this.pos[i3 + 2] = o.position.z + (Math.random() - 0.5) * jitter;
      this.vel[i3] = (o.velocity?.x ?? 0) + (Math.random() - 0.5) * 2 * spread;
      this.vel[i3 + 1] = (o.velocity?.y ?? 0) + (o.up ?? 0) * (0.5 + Math.random() * 0.5) + (Math.random() - 0.5) * spread;
      this.vel[i3 + 2] = (o.velocity?.z ?? 0) + (Math.random() - 0.5) * 2 * spread;
      this.color[i3] = c.r;
      this.color[i3 + 1] = c.g;
      this.color[i3 + 2] = c.b;
      const life = l0 + Math.random() * (l1 - l0);
      this.life[i] = life;
      this.maxLife[i] = life;
      this.baseSize[i] = s0 + Math.random() * (s1 - s0);
      this.size[i] = this.baseSize[i]!;
      this.alpha[i] = 1;
      this.gravity[i] = o.gravity ?? 9;
      this.drag[i] = o.drag ?? 0.5;
      this.grow[i] = o.grow ?? -0.6;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i]! <= 0) continue;
      const l = (this.life[i]! -= dt);
      const i3 = i * 3;
      if (l <= 0) {
        this.alpha[i] = 0;
        this.size[i] = 0;
        continue;
      }
      const k = Math.exp(-this.drag[i]! * dt);
      this.vel[i3]! *= k;
      this.vel[i3 + 2]! *= k;
      this.vel[i3 + 1] = this.vel[i3 + 1]! * k - this.gravity[i]! * dt;
      this.pos[i3]! += this.vel[i3]! * dt;
      this.pos[i3 + 1]! += this.vel[i3 + 1]! * dt;
      this.pos[i3 + 2]! += this.vel[i3 + 2]! * dt;
      const t = 1 - l / this.maxLife[i]!;
      this.size[i] = this.baseSize[i]! * Math.max(0.05, 1 + this.grow[i]! * t);
      this.alpha[i] = Math.min(1, (l / this.maxLife[i]!) * 3);
    }
    for (const name of ['position', 'aColor', 'aSize', 'aAlpha']) this.geo.getAttribute(name).needsUpdate = true;
  }

  clear(): void {
    this.life.fill(0);
    this.alpha.fill(0);
    this.size.fill(0);
  }
}
