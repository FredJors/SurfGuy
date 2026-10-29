/**
 * Platzhalter: Vulkan-Trümmer als Rampe – eine schräg im Wasser liegende Basaltplatte mit
 * Säulen-Muster, glühenden Lava-Adern und Brocken am Rand. Gleiche Achsen wie das Wrack:
 * Heck-Kante der Oberseite im Ursprung, „Bug“ (hohes Ende) Richtung +Z, Oberseite bei y = 0
 * (die Welt kippt das Modell zur Rampe).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { noise2, noise3 } from '../../core/noise';
import { Rng } from '../../core/Rng';
import { toonMaterial } from '../../fx/toon';

let rockMat: THREE.Material | null = null;
let glowMat: THREE.Material | null = null;

const BASALT = ['#3b3138', '#4a3e45', '#2f282e', '#55474c', '#433840'].map((c) => new THREE.Color(c));
const SEAM = new THREE.Color('#17121a');
const OBSIDIAN = new THREE.Color('#1f1a26');
const EMBER = new THREE.Color('#d8541c');

function hash(x: number, y: number, seed: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Nächste und zweitnächste Zelle eines verzerrten Gitters (Basaltsäulen von oben). */
function cells(x: number, z: number, size: number, seed: number): { id: number; edge: number } {
  const gx = Math.floor(x / size);
  const gz = Math.floor(z / size);
  let d1 = Infinity;
  let d2 = Infinity;
  let id = 0;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const cx = gx + i;
      const cz = gz + j;
      const px = (cx + 0.15 + hash(cx, cz, seed) * 0.7) * size;
      const pz = (cz + 0.15 + hash(cz, cx, seed + 3) * 0.7) * size;
      const d = Math.hypot(x - px, z - pz);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = Math.floor(hash(cx * 7, cz * 13, seed) * 1000);
      } else if (d < d2) d2 = d;
    }
  }
  return { id, edge: (d2 - d1) * 0.5 };
}

/** Abstand eines Punkts zu einem Linienzug (für die Glut um die Lava-Adern). */
function distToPath(x: number, z: number, path: THREE.Vector3[]): number {
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz || 1)));
    best = Math.min(best, Math.hypot(x - a.x - abx * t, z - a.z - abz * t));
  }
  return best;
}

export function buildDebris(params: { length?: number; width?: number; seed?: number } = {}): THREE.Object3D {
  const D = params.length ?? 22;
  const W = params.width ?? 7;
  const seed = params.seed ?? 1;
  const rng = new Rng(seed);
  rockMat ??= toonMaterial('#ffffff', { vertexColors: true, gloss: 0.3 });
  glowMat ??= new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6a1a').multiplyScalar(2.6) });
  const g = new THREE.Group();

  // Halbe Breite entlang der Platte: gezackte Ränder, abgerundete Enden
  const halfW = (u: number) => {
    const ends = Math.min(1, u / 1.6, (D - u) / 2.2);
    const round = Math.sqrt(Math.max(0, ends));
    return (W / 2) * (0.9 + (noise2(u * 0.45, 3.1, seed) - 0.5) * 0.28) * (0.55 + 0.45 * round);
  };

  // Lava-Adern (Linienzüge auf der Oberseite)
  const veins: THREE.Vector3[][] = [];
  for (let k = 0; k < 3; k++) {
    const pts: THREE.Vector3[] = [];
    let z = rng.range(1.5, D * 0.3) + k * D * 0.22;
    let x = rng.range(-W * 0.3, W * 0.3);
    const dir = rng.chance(0.5) ? 1 : -1;
    for (let i = 0; i < 7; i++) {
      pts.push(new THREE.Vector3(x, 0.05, z));
      x += dir * rng.range(0.4, 1.3);
      z += rng.range(-0.8, 1.6);
      z = Math.max(0.8, Math.min(D - 0.8, z));
      const w = halfW(z) - 0.5;
      if (Math.abs(x) > w) break;
    }
    if (pts.length >= 3) veins.push(pts);
  }

  // Oberseite: feines Gitter mit Säulen-Muster (Farben pro Zelle, dunkle Fugen, Glut an den Adern)
  const nu = Math.ceil(D / 0.5);
  const nx = 16;
  const topPos: number[] = [];
  const topCol: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i <= nu; i++) {
    const u = (i / nu) * D;
    const w = halfW(u);
    for (let j = 0; j <= nx; j++) {
      const x = -w + (j / nx) * 2 * w;
      // leichte Unebenheit, zum Rand hin abfallend (Oberfläche bleibt im Mittel bei y = 0)
      const edge = Math.abs(x) / Math.max(0.01, w);
      const y = (noise2(x * 0.8, u * 0.8, seed + 11) - 0.5) * 0.12 - Math.pow(edge, 6) * 0.35;
      topPos.push(x, y, u);
      const cell = cells(x, u, 2, seed);
      c.copy(BASALT[cell.id % BASALT.length]!);
      if (cell.id % 11 === 0) c.copy(OBSIDIAN);
      if (cell.edge < 0.2) c.copy(SEAM);
      let heat = 0;
      for (const v of veins) heat = Math.max(heat, 1 - distToPath(x, u, v) / 1.1);
      if (heat > 0) c.lerp(EMBER, heat * heat * 0.85);
      topCol.push(c.r, c.g, c.b);
    }
  }
  const topIdx: number[] = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nx; j++) {
      const a = i * (nx + 1) + j;
      const b = a + nx + 1;
      topIdx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const top = new THREE.BufferGeometry();
  top.setAttribute('position', new THREE.Float32BufferAttribute(topPos, 3));
  top.setAttribute('color', new THREE.Float32BufferAttribute(topCol, 3));
  top.setIndex(topIdx);
  top.computeVertexNormals();

  // Körper: Umriss = Rand der Oberseite, 3 m tief, Seiten und Unterseite zerklüftet
  const outline: THREE.Vector2[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) outline.push(new THREE.Vector2(halfW((i / steps) * D) - 0.05, (i / steps) * D));
  for (let i = steps; i >= 0; i--) outline.push(new THREE.Vector2(-halfW((i / steps) * D) + 0.05, (i / steps) * D));
  const body = new THREE.ExtrudeGeometry(new THREE.Shape(outline), { depth: 3, bevelEnabled: false, steps: 4 });
  // Shape liegt in XY und wird entlang +Z extrudiert → drehen: Shape-Y → Länge (+Z), Tiefe → nach unten
  body.rotateX(Math.PI / 2);
  body.translate(0, -0.3, 0);
  const p = body.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    if (v.y < -0.5) {
      const f = (noise3(v.x * 0.5, v.y * 0.5, v.z * 0.5, seed) - 0.5) * 1.6;
      p.setXYZ(i, v.x * (1 + f * 0.12) + f * 0.3, v.y + f * 0.5, v.z + f * 0.4);
    }
  }
  body.deleteAttribute('uv');
  body.deleteAttribute('normal');
  const bodyCol = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const n = noise3(p.getX(i) * 0.6, p.getY(i) * 0.6, p.getZ(i) * 0.6, seed + 5);
    c.copy(SEAM).lerp(BASALT[3]!, 0.25 + n * 0.6);
    // Wasserlinie: etwas heller (Salzkruste)
    if (p.getY(i) > -0.9 && p.getY(i) < -0.4) c.lerp(new THREE.Color('#6d5e60'), 0.35);
    bodyCol.set([c.r, c.g, c.b], i * 3);
  }
  body.setAttribute('color', new THREE.BufferAttribute(bodyCol, 3));
  const bodyFlat = body.index ? body.toNonIndexed() : body;
  bodyFlat.computeVertexNormals();

  // Brocken am Rand (außerhalb der Fahrfläche) und zwei Scherben am hohen Ende
  const chunks: THREE.BufferGeometry[] = [];
  const chunk = (r: number, x: number, y: number, z: number, sy = 1) => {
    const geo = new THREE.DodecahedronGeometry(r, 0);
    geo.scale(1, sy, 1);
    geo.rotateY(rng.range(0, Math.PI));
    geo.rotateX(rng.range(0, 0.6));
    geo.translate(x, y, z);
    geo.deleteAttribute('uv');
    const col = new Float32Array(geo.getAttribute('position').count * 3);
    const base = BASALT[rng.int(0, BASALT.length - 1)]!;
    for (let i = 0; i < col.length; i += 3) col.set([base.r, base.g, base.b], i);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    chunks.push(geo.index ? geo.toNonIndexed() : geo);
  };
  for (let i = 0; i < 5; i++) {
    const side = i % 2 ? 1 : -1;
    const u = rng.range(1.5, D * 0.75);
    const r = rng.range(0.8, 1.7);
    chunk(r, side * (halfW(u) + r * 0.45), rng.range(-0.9, -0.2), u);
  }
  for (const side of [-1, 1]) chunk(rng.range(0.5, 0.8), side * (halfW(D - 1.2) - 0.1), 0.25, D - 1.2, 1.9);

  const rock = mergeGeometries([top.toNonIndexed(), bodyFlat, ...chunks].map((geo) => {
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    return geo;
  }));
  const rockMesh = new THREE.Mesh(rock, rockMat);
  g.add(rockMesh);

  // Glühende Lava-Adern
  const veinGeos = veins.map((pts) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 5, 0.13, 5, false));
  if (veinGeos.length) {
    const glow = new THREE.Mesh(mergeGeometries(veinGeos), glowMat);
    glow.userData.noOutline = true;
    g.add(glow);
  }
  g.name = 'debris';
  return g;
}
