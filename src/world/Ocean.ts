/**
 * Endloses Toon-Meer: ein polares Netz (innen fein, außen grob), das dem Spieler folgt.
 * Die Höhe wird im Shader in Weltkoordinaten berechnet – mit derselben Formel wie WaveField.
 */
import * as THREE from 'three';
import { CONFIG } from '../config/gameConfig';
import type { WaveField } from './WaveField';

const MAX_WAVES = CONFIG.waves.maxActive;
const MAX_SWELL = 6;

const vertexShader = /* glsl */ `
#define MAX_WAVES ${MAX_WAVES}
#define MAX_SWELL ${MAX_SWELL}
uniform float uTime;
uniform vec4 uSwell[MAX_SWELL];      // amp, k, omega, phase
uniform vec2 uSwellDir[MAX_SWELL];
uniform vec4 uWaveCrest[MAX_WAVES];  // crestX, crestZ, dirX, dirZ
uniform vec4 uWaveShape[MAX_WAVES];  // amp, frontWidth, backWidth, halfLength
uniform vec4 uIsland;                // x, z, fadeInner, fadeOuter

varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vFoam;
varying float vHeight;
varying float vReef;

float islandFade(vec2 p) {
  return smoothstep(uIsland.z, uIsland.w, length(p - uIsland.xy));
}

float oceanHeight(vec2 p, out float foam) {
  float h = 0.0;
  for (int i = 0; i < MAX_SWELL; i++) {
    vec4 s = uSwell[i];
    h += s.x * sin(dot(uSwellDir[i], p) * s.y - uTime * s.z + s.w);
  }
  foam = 0.0;
  float fade = islandFade(p);
  for (int i = 0; i < MAX_WAVES; i++) {
    vec4 sh = uWaveShape[i];
    if (sh.x <= 0.001) continue;
    vec4 c = uWaveCrest[i];
    vec2 d = p - c.xy;
    float s = dot(d, c.zw);
    float l = -d.x * c.w + d.y * c.z;
    float b = s > 0.0 ? sh.y : sh.z;
    float q = s / b;
    float lateral = 1.0 - smoothstep(sh.w * 0.7, sh.w, abs(l));
    float prof = exp(-q * q) * lateral;
    float amp = sh.x * fade;
    h += amp * prof;
    // Schaum auf dem Kamm und kurz dahinter (Weißwasser)
    float crest = smoothstep(0.62, 0.97, prof) * smoothstep(0.55, 1.3, amp);
    float trail = smoothstep(-sh.z * 0.9, -1.0, s) * (1.0 - step(1.5, s)) * lateral * smoothstep(0.8, 1.6, amp) * 0.55;
    foam = max(foam, max(crest, trail));
  }
  return h;
}

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float foam;
  float h = oceanHeight(wp.xz, foam);
  float e = clamp(length(position.xz) * 0.01, 0.35, 6.0);
  float f2;
  float hx = oceanHeight(wp.xz + vec2(e, 0.0), f2);
  float hz = oceanHeight(wp.xz + vec2(0.0, e), f2);
  vNormal = normalize(vec3(h - hx, e, h - hz));
  wp.y = h;
  vWorldPos = wp.xyz;
  vFoam = foam;
  vHeight = h;
  float dIsland = length(wp.xz - uIsland.xy);
  vReef = 1.0 - smoothstep(uIsland.z - 20.0, uIsland.w + 40.0, dIsland);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uShadow;
uniform vec3 uFoamColor;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uFoamThreshold;
uniform vec4 uIsland;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vFoam;
varying float vHeight;
varying float vReef;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
// Zellartiges Muster für Toon-Schaum
float cells(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = vec2(hash(i + g), hash(i + g + 17.0));
      o = 0.5 + 0.4 * sin(uTime * 0.6 + 6.2831 * o);
      d = min(d, length(g + o - f));
    }
  }
  return d;
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 toCam = cameraPosition - vWorldPos;
  float dist = length(toCam);
  vec3 V = toCam / dist;

  // Grundfarbe: Täler tiefblau, Kämme türkis
  float hmix = clamp(vHeight * 0.32 + 0.42, 0.0, 1.0);
  vec3 col = mix(uDeep, uShallow, hmix);

  // Toon-Licht in Stufen
  float ndl = dot(n, uSunDir);
  float band = ndl > 0.8 ? 1.0 : (ndl > 0.55 ? 0.9 : 0.78);
  col = mix(uShadow, col, band);

  // Fresnel zum Horizont hin
  float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
  col = mix(col, uHorizon, fres * 0.55);

  // Glitzernde Sonnenreflexe (hart abgestuft)
  vec3 R = reflect(-uSunDir, n);
  float spec = pow(max(dot(R, V), 0.0), 180.0);
  col += step(0.35, spec) * 0.55 * uSunColor * (1.0 - smoothstep(150.0, 600.0, dist));

  // Schaum: Wellenkämme + kleine Schaumflecken auf der Dünung
  float c1 = cells(vWorldPos.xz * 0.22);
  float c2 = noise(vWorldPos.xz * 0.6 + vec2(uTime * 0.15, -uTime * 0.1));
  float foamField = vFoam * (1.15 - c1 * 0.9) + c2 * 0.12;
  float crestFoam = smoothstep(uFoamThreshold, uFoamThreshold + 0.05, foamField);
  float swellFoam = smoothstep(0.92, 0.96, 1.0 - c1) * smoothstep(0.2, 0.42, vHeight) * 0.85;
  // Riff/Sturm: unruhiges, schaumiges Wasser
  float reefFoam = vReef * smoothstep(0.5, 0.55, noise(vWorldPos.xz * 0.18 + uTime * 0.25) * (1.0 - c1 * 0.5));
  float foam = max(crestFoam, max(swellFoam, reefFoam));
  col = mix(col, uFoamColor, foam * (1.0 - smoothstep(500.0, 1100.0, dist)));
  col = mix(col, col * vec3(0.72, 0.8, 0.9), vReef * 0.5 * (1.0 - foam));

  // Nebel zum Horizont
  float fogF = smoothstep(uFogNear, uFogFar, dist);
  col = mix(col, uFogColor, fogF);

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function buildPolarGeometry(radius: number, rings: number, segments: number, inner: number): THREE.BufferGeometry {
  // Geometrisch wachsende Ringabstände: innen fein, außen grob.
  let f = 1.0001;
  for (let lo = 1.0001, hi = 1.5, i = 0; i < 60; i++) {
    f = (lo + hi) / 2;
    const r = (inner * (Math.pow(f, rings) - 1)) / (f - 1);
    if (r > radius) hi = f;
    else lo = f;
  }
  const radii: number[] = [0];
  let r = 0;
  let step = inner;
  for (let i = 0; i < rings; i++) {
    r += step;
    step *= f;
    radii.push(r);
  }

  const positions: number[] = [0, 0, 0];
  for (let i = 1; i < radii.length; i++) {
    const rr = radii[i]!;
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      positions.push(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    }
  }
  const indices: number[] = [];
  // Mitte (Fächer)
  for (let s = 0; s < segments; s++) {
    indices.push(0, 1 + ((s + 1) % segments), 1 + s);
  }
  for (let i = 1; i < radii.length - 1; i++) {
    const a0 = 1 + (i - 1) * segments;
    const b0 = 1 + i * segments;
    for (let s = 0; s < segments; s++) {
      const s1 = (s + 1) % segments;
      indices.push(a0 + s, a0 + s1, b0 + s);
      indices.push(a0 + s1, b0 + s1, b0 + s);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius + 50);
  return geo;
}

export class Ocean {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly crest: THREE.Vector4[];
  private readonly shape: THREE.Vector4[];

  constructor(private readonly field: WaveField) {
    const cfg = CONFIG.ocean;
    const col = CONFIG.colors;
    this.crest = Array.from({ length: MAX_WAVES }, () => new THREE.Vector4());
    this.shape = Array.from({ length: MAX_WAVES }, () => new THREE.Vector4());
    const swell = Array.from({ length: MAX_SWELL }, (_, i) => {
      const c = field.swell[i];
      return c ? new THREE.Vector4(c.amp, c.k, c.omega, c.phase) : new THREE.Vector4(0, 0, 0, 0);
    });
    const swellDir = Array.from({ length: MAX_SWELL }, (_, i) => {
      const c = field.swell[i];
      return c ? new THREE.Vector2(c.dirX, c.dirZ) : new THREE.Vector2(1, 0);
    });
    const sun = new THREE.Vector3(...CONFIG.light.sunDirection).normalize();

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSwell: { value: swell },
        uSwellDir: { value: swellDir },
        uWaveCrest: { value: this.crest },
        uWaveShape: { value: this.shape },
        uIsland: { value: new THREE.Vector4(field.islandX, field.islandZ, field.fadeInner, field.fadeOuter) },
        uDeep: { value: new THREE.Color(col.waterDeep) },
        uShallow: { value: new THREE.Color(col.waterShallow) },
        uShadow: { value: new THREE.Color(col.waterShadow) },
        uFoamColor: { value: new THREE.Color(col.waterFoam) },
        uHorizon: { value: new THREE.Color(col.skyHorizon) },
        uSunDir: { value: sun },
        uSunColor: { value: new THREE.Color(col.sun) },
        uFogColor: { value: new THREE.Color(col.fog) },
        uFogNear: { value: CONFIG.fog.near },
        uFogFar: { value: CONFIG.fog.far },
        uFoamThreshold: { value: cfg.foamThreshold },
      },
    });
    this.mesh = new THREE.Mesh(buildPolarGeometry(cfg.radius, cfg.rings, cfg.segments, cfg.innerRingSpacing), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  update(centerX: number, centerZ: number): void {
    this.mesh.position.set(centerX, 0, centerZ);
    const u = this.material.uniforms;
    u.uTime!.value = this.field.time;
    const waves = this.field.waves;
    for (let i = 0; i < MAX_WAVES; i++) {
      const w = waves[i];
      if (w) {
        this.crest[i]!.set(w.crestX, w.crestZ, w.dirX, w.dirZ);
        this.shape[i]!.set(w.amplitude * w.envelope, w.frontWidth, w.backWidth, w.halfLength);
      } else {
        this.shape[i]!.set(0, 1, 1, 1);
      }
    }
  }
}
