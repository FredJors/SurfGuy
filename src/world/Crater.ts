/**
 * Endgegner-Arena als eigener Ort weit weg von der Insel; der Spieler wird hineinversetzt.
 * Rampen und Geysire werfen ihn Richtung Mitte, wo der Endgegner steht.
 *
 * - 'lava' = Kratersee im Vulkan (Kapitel-2-Finale): Lava-See, zerklüftete Kraterwände mit
 *   Lavafällen und Glut, Basalt-Rampen, Lava-Geysire. Werte in CONFIG.crater.
 * - 'ice' = Gletscherlagune (Kapitel-3-Finale): Eiswände mit Schneekante, gefrorene Wasserfälle,
 *   Eiskristalle, Eisberg-Rampen, Polarlicht am Himmel. Werte in CONFIG.glacier.
 */
import * as THREE from 'three';
import type { AssetLoader } from '../assets/AssetLoader';
import { CONFIG } from '../config/gameConfig';
import type { GameEventBus } from '../core/events';
import { smoothstep } from '../core/math';
import { fbm, noise2 } from '../core/noise';
import { createGlow } from '../fx/Effects';
import { addOutline, enableShadows, toonMaterial } from '../fx/toon';
import { GeyserSystem } from './Geysers';
import type { WaveField } from './WaveField';
import { WreckSystem } from './Wrecks';

const lavaFallVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const lavaFallFragment = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uSpeed;
uniform vec3 uHot;
uniform vec3 uWarm;
varying vec2 vUv;
void main() {
  // Fließende Bänder nach unten (Eis: langsames Schimmern), Ränder dunkler
  float flow = vUv.y * 9.0 + uTime * uSpeed + uSeed;
  float bands = 0.5 + 0.5 * sin(flow + sin(vUv.x * 9.0 + uSeed) * 1.5);
  float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
  vec3 col = mix(uWarm, uHot, bands * edge) * (0.9 + 0.6 * edge);
  float alpha = edge * (0.7 + 0.3 * bands) * smoothstep(1.0, 0.92, vUv.y);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Polarlicht: Vorhang aus Lichtbändern hoch über der Arena */
const auroraFragment = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  float x = vUv.x * 40.0;
  float wave = sin(x * 0.7 + uTime * 0.35) * 0.5 + sin(x * 1.9 - uTime * 0.6) * 0.25;
  float curtain = smoothstep(0.0, 0.35, vUv.y + wave * 0.15) * smoothstep(1.0, 0.45, vUv.y + wave * 0.1);
  float rays = 0.55 + 0.45 * sin(x * 6.0 + uTime * 1.3 + sin(x * 0.5) * 3.0);
  vec3 green = vec3(0.25, 1.0, 0.65);
  vec3 violet = vec3(0.65, 0.4, 1.0);
  vec3 col = mix(green, violet, smoothstep(0.35, 1.0, vUv.y));
  float a = curtain * rays * (0.45 + 0.25 * sin(x * 0.3 + uTime * 0.2));
  gl_FragColor = vec4(col * 1.4, a * 0.55);
}
`;

type ArenaStyle = 'lava' | 'ice';

/** Farben je Stil: Wand (dunkel, Schichten, Kante oben, Glut am Fuß), Fälle, Glühen, Felsnadeln */
const STYLE = {
  lava: { deep: '#2b1d24', strata: '#4a3238', top: '#6a5458', foot: '#ff5a1f', footK: 0.85, band: '#ff5a1a', fallHot: [1, 0.85, 0.35], fallWarm: [1, 0.35, 0.05], fallSpeed: 2.4, pool: '#ff8a3d', core: '#ff7a1a', spire: '#33242b', ramp: 'debris', lavaGeysers: true },
  ice: { deep: '#3f7fbf', strata: '#9fd2f0', top: '#f6fbff', foot: '#dff6ff', footK: 0.5, band: '#7fd6ff', fallHot: [1, 1, 1], fallWarm: [0.45, 0.78, 1], fallSpeed: 0.35, pool: '#9fdcff', core: '#5fc8ff', spire: '#cfeeff', ramp: 'iceberg', lavaGeysers: false },
} as const;

export class Crater {
  readonly group = new THREE.Group();
  readonly style: ArenaStyle;
  private readonly C: typeof CONFIG.crater;
  private aurora: THREE.ShaderMaterial | null = null;
  readonly centerX: number;
  readonly centerZ: number;
  readonly ramps: WreckSystem;
  readonly geysers: GeyserSystem;
  private readonly falls: THREE.ShaderMaterial[] = [];
  private readonly coreGlow: THREE.Mesh;
  private time = 0;

  constructor(bus: GameEventBus, assets: AssetLoader | null, field: WaveField, style: ArenaStyle = 'lava') {
    this.style = style;
    const C = (this.C = style === 'ice' ? CONFIG.glacier : CONFIG.crater);
    const S = STYLE[style];
    const [cx, cz] = C.center;
    this.centerX = cx;
    this.centerZ = cz;
    if (assets) this.group.add(this.buildWalls());
    // Glühender Kern des Sees unter dem Titan
    this.coreGlow = createGlow(C.coreGlow, S.core);
    this.coreGlow.position.set(cx, 0.15, cz);
    this.group.add(this.coreGlow);
    this.ramps = new WreckSystem(assets, style === 'ice' ? 9393 : 9191, S.ramp, C.rampCount, {
      center: C.center,
      ringMin: C.rampRing[0],
      ringMax: C.rampRing[1],
      minSpacing: 45,
      towardCenter: true,
    });
    this.geysers = new GeyserSystem(bus, field, {
      center: C.center,
      count: C.geyserCount,
      ringMin: C.geyserRing[0],
      ringMax: C.geyserRing[1],
      inward: true,
      lava: S.lavaGeysers,
      launchOut: C.geyserLaunchOut,
      seed: style === 'ice' ? 4713 : 4711,
    });
    this.group.add(this.ramps.group, this.geysers.group);
    if (style === 'ice') this.group.add(this.buildAurora());
    this.group.visible = false;
  }

  /** Abstand eines Punkts zur Mitte des Sees. */
  distanceTo(x: number, z: number): number {
    return Math.hypot(x - this.centerX, z - this.centerZ);
  }

  /** Abstoßung an den Kraterwänden: Beschleunigung zur Mitte (m/s²) und Stärke 0..1. */
  boundaryPush(x: number, z: number): { ax: number; az: number; strength: number } {
    const C = this.C;
    const dx = x - this.centerX;
    const dz = z - this.centerZ;
    const d = Math.hypot(dx, dz) || 1;
    const strength = smoothstep(C.arenaRadius - C.pushWidth, C.arenaRadius, d);
    const a = -strength * C.push;
    return { ax: (dx / d) * a, az: (dz / d) * a, strength };
  }

  /** Kraterwände: gezackter Ring, nach oben ausladend, mit Gesteinsschichten und Glut unten. */
  private buildWalls(): THREE.Object3D {
    const C = this.C;
    const S = STYLE[this.style];
    const g = new THREE.Group();
    const seg = 160;
    const rows = 12;
    const pos: number[] = [];
    const col: number[] = [];
    const c = new THREE.Color();
    const basalt = new THREE.Color(S.deep);
    const strata = new THREE.Color(S.strata);
    const ash = new THREE.Color(S.top);
    const ember = new THREE.Color(S.foot);
    const heights: number[] = [];
    // Wandradius an Winkel a und Höhe t (0 = unten, 1 = Rand); auch für die Lavafälle
    const wallR = (a: number, t: number) => {
      const crag = (noise2(a * 14, t * 4, 31) - 0.5) * 9 + (noise2(a * 40, t * 9, 33) - 0.5) * 3;
      return C.wallRadius + t * t * 30 + crag * (0.4 + t);
    };
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const n = fbm(Math.cos(a) * 2.2 + 5, Math.sin(a) * 2.2 + 5, 4, 77);
      heights.push(C.wallHeight[0] + (C.wallHeight[1] - C.wallHeight[0]) * Math.min(1, Math.max(0, n * 1.1 + 0.5)));
    }
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * Math.PI * 2;
        const h = heights[j]!;
        const y = -4 + t * (h + 4);
        // Zerklüftung: Grate und Nischen, oben weiter nach außen
        const r = wallR(a, t);
        pos.push(this.centerX + Math.cos(a) * r, y, this.centerZ + Math.sin(a) * r);
        const band = Math.sin(y * 0.55 + noise2(a * 6, 1.3, 35) * 4) * 0.5 + 0.5;
        c.copy(basalt).lerp(strata, band * 0.8);
        if (t > 0.85) c.lerp(ash, (t - 0.85) / 0.15);
        // Glut am Fuß (Lava leckt an der Wand)
        c.lerp(ember, Math.max(0, 1 - (y + 4) / 9) * S.footK);
        col.push(c.r, c.g, c.b);
      }
    }
    const idx: number[] = [];
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < seg; j++) {
        const a = i * (seg + 1) + j;
        const b = a + seg + 1;
        // Innenseite zeigt zur Mitte
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const walls = new THREE.Mesh(geo, toonMaterial('#ffffff', { vertexColors: true, gloss: 0.15, side: THREE.DoubleSide }));
    walls.frustumCulled = false;
    enableShadows(walls, false, true);
    g.add(walls);

    // Leuchtendes Band, wo die Lava die Wand berührt
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(C.wallRadius - 2, C.wallRadius - 2, 7, 96, 1, true),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(S.band).multiplyScalar(1.5), transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    band.position.set(this.centerX, 1.5, this.centerZ);
    g.add(band);

    // Lavafälle an der Wand
    for (let k = 0; k < C.falls; k++) {
      const a = (k / C.falls) * Math.PI * 2 + 0.35 * Math.sin(k * 2.7);
      const j = Math.round((a / (Math.PI * 2)) * seg) % seg;
      const h = heights[(j + seg) % seg]!;
      const mat = new THREE.ShaderMaterial({
        vertexShader: lavaFallVertex,
        fragmentShader: lavaFallFragment,
        uniforms: {
          uTime: { value: 0 },
          uSeed: { value: k * 1.7 },
          uSpeed: { value: S.fallSpeed },
          uHot: { value: new THREE.Vector3(...S.fallHot) },
          uWarm: { value: new THREE.Vector3(...S.fallWarm) },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.falls.push(mat);
      const w = 10 + (k % 3) * 4;
      // Streifen, der der Wand folgt (etwas davor), vom Rand bis in den See
      const fallPos: number[] = [];
      const fallUv: number[] = [];
      const fallIdx: number[] = [];
      const steps = 14;
      const across = 4;
      for (let i = 0; i <= steps; i++) {
        const t = 1 - i / steps;
        const y = -4 + t * (h + 4);
        for (let q = 0; q <= across; q++) {
          const u = q / across;
          const r = wallR(a, t) - 2.5 - Math.sin(u * Math.PI) * 1.5;
          const aa = a + ((u - 0.5) * w) / r;
          fallPos.push(this.centerX + Math.cos(aa) * r, y, this.centerZ + Math.sin(aa) * r);
          fallUv.push(u, 1 - t);
        }
      }
      for (let i = 0; i < steps; i++) {
        for (let q = 0; q < across; q++) {
          const p0 = i * (across + 1) + q;
          const p1 = p0 + across + 1;
          fallIdx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1);
        }
      }
      const fallGeo = new THREE.BufferGeometry();
      fallGeo.setAttribute('position', new THREE.Float32BufferAttribute(fallPos, 3));
      fallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(fallUv, 2));
      fallGeo.setIndex(fallIdx);
      const fall = new THREE.Mesh(fallGeo, mat);
      fall.frustumCulled = false;
      g.add(fall);
      const r0 = wallR(a, 0) - 4;
      const pool = createGlow(w * 2.6, S.pool);
      pool.position.set(this.centerX + Math.cos(a) * r0, 0.2, this.centerZ + Math.sin(a) * r0);
      g.add(pool);
    }

    // Felsnadeln am Ufer
    const spireMat = this.style === 'ice' ? toonMaterial(S.spire, { gloss: 0.9, rim: 0.6, emissive: '#4f9fe0', emissiveIntensity: 0.25 }) : toonMaterial(S.spire, { gloss: 0.2 });
    const spires = new THREE.Group();
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2 + Math.sin(k * 3.1) * 0.15;
      const r = C.wallRadius - 8 - (k % 4) * 3;
      const h = 8 + ((k * 7) % 5) * 3;
      const spire = new THREE.Mesh(new THREE.ConeGeometry(2.4 + (k % 3), h, 6), spireMat);
      spire.position.set(this.centerX + Math.cos(a) * r, h / 2 - 2, this.centerZ + Math.sin(a) * r);
      spire.rotation.set(Math.sin(k) * 0.2, k, Math.cos(k) * 0.2);
      spires.add(spire);
    }
    addOutline(spires, 0.08);
    g.add(spires);
    return g;
  }

  /** Polarlicht-Vorhang ringsum hoch am Himmel (nur Gletscherlagune). */
  private buildAurora(): THREE.Mesh {
    this.aurora = new THREE.ShaderMaterial({
      vertexShader: lavaFallVertex,
      fragmentShader: auroraFragment,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(420, 520, 170, 96, 1, true), this.aurora);
    mesh.position.set(this.centerX, 210, this.centerZ);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    return mesh;
  }

  update(dt: number): void {
    this.time += dt;
    for (const m of this.falls) m.uniforms.uTime!.value = this.time;
    if (this.aurora) this.aurora.uniforms.uTime!.value = this.time;
    const pulse = 1 + Math.sin(this.time * 1.7) * 0.08;
    this.coreGlow.scale.setScalar(pulse);
  }
}
