/**
 * Platzhalter: Eisberg als Rampe (Kapitel 3) – eine schräg im Wasser liegende Eisplatte mit
 * Schneedecke, blauen Spalten, gezackten Eiskanten und Eiszapfen-Spitzen am Rand.
 * Gleiche Achsen wie Wrack und Trümmer: Heck-Kante der Oberseite im Ursprung, hohes Ende
 * Richtung +Z, Oberseite bei y = 0 (die Welt kippt das Modell zur Rampe).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { noise2, noise3 } from '../../core/noise';
import { Rng } from '../../core/Rng';
import { toonMaterial } from '../../fx/toon';
import { cells } from './debris';

let iceMat: THREE.Material | null = null;

const SNOW = new THREE.Color('#f7fcff');
const SNOW_SHADE = new THREE.Color('#dcecf8');
const CRACK = new THREE.Color('#5fb4e0');
const EDGE = new THREE.Color('#bfe8fa');
const ICE_TOP = new THREE.Color('#a8dcf4');
const ICE_DEEP = new THREE.Color('#2f7fc4');
const ICE_DARK = new THREE.Color('#1a5a9a');

export function buildIceberg(params: { length?: number; width?: number; seed?: number } = {}): THREE.Object3D {
  const D = params.length ?? 22;
  const W = params.width ?? 7;
  const seed = params.seed ?? 1;
  const rng = new Rng(seed * 31 + 5);
  iceMat ??= toonMaterial('#ffffff', { vertexColors: true, gloss: 0.55, rim: 0.35 });
  const g = new THREE.Group();

  // Halbe Breite: kantiger als Basalt (Eis bricht in Facetten)
  const halfW = (u: number) => {
    const ends = Math.min(1, u / 1.4, (D - u) / 2);
    const round = Math.sqrt(Math.max(0, ends));
    const facet = Math.floor(u / 2.2);
    return (W / 2) * (0.92 + (noise2(facet * 0.9, 7.3, seed) - 0.5) * 0.3) * (0.55 + 0.45 * round);
  };

  // Oberseite: Schneedecke mit Spalten (Zellränder) und blau schimmernden Kanten
  const nu = Math.ceil(D / 0.5);
  const nx = 14;
  const topPos: number[] = [];
  const topCol: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i <= nu; i++) {
    const u = (i / nu) * D;
    const w = halfW(u);
    for (let j = 0; j <= nx; j++) {
      const x = -w + (j / nx) * 2 * w;
      const edge = Math.abs(x) / Math.max(0.01, w);
      const y = (noise2(x * 0.6, u * 0.6, seed + 13) - 0.5) * 0.1 - Math.pow(edge, 5) * 0.4;
      topPos.push(x, y, u);
      const cell = cells(x, u, 3.2, seed + 40);
      c.copy(SNOW).lerp(SNOW_SHADE, noise2(x * 0.3, u * 0.3, seed + 2) * 0.9);
      if (cell.edge < 0.12) c.lerp(CRACK, 0.75);
      if (edge > 0.82) c.lerp(EDGE, (edge - 0.82) * 4);
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

  // Eiskörper: Umriss der Oberseite, 4 m tief, unten breiter und facettiert
  const outline: THREE.Vector2[] = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) outline.push(new THREE.Vector2(halfW((i / steps) * D) - 0.05, (i / steps) * D));
  for (let i = steps; i >= 0; i--) outline.push(new THREE.Vector2(-halfW((i / steps) * D) + 0.05, (i / steps) * D));
  const body = new THREE.ExtrudeGeometry(new THREE.Shape(outline), { depth: 4, bevelEnabled: false, steps: 3 });
  body.rotateX(Math.PI / 2);
  body.translate(0, -0.35, 0);
  const p = body.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    if (v.y < -0.6) {
      const f = (noise3(v.x * 0.35, v.y * 0.35, v.z * 0.35, seed + 3) - 0.5) * 2;
      const spread = 1 + Math.min(1, -v.y / 4) * 0.25;
      p.setXYZ(i, v.x * spread + f * 0.5, v.y + f * 0.4, v.z + f * 0.5);
    }
  }
  body.deleteAttribute('uv');
  body.deleteAttribute('normal');
  const bodyFlat = body.index ? body.toNonIndexed() : body;
  const bp = bodyFlat.getAttribute('position');
  const bodyCol = new Float32Array(bp.count * 3);
  for (let i = 0; i < bp.count; i++) {
    const y = bp.getY(i);
    const n = noise3(bp.getX(i) * 0.4, y * 0.4, bp.getZ(i) * 0.4, seed + 9);
    // Über der Wasserlinie hell, darunter tiefblau
    c.copy(ICE_TOP).lerp(ICE_DEEP, Math.min(1, Math.max(0, (-y - 0.6) / 2.2)));
    c.lerp(ICE_DARK, n * 0.25);
    if (y > -0.95 && y < -0.55) c.lerp(SNOW, 0.35);
    bodyCol.set([c.r, c.g, c.b], i * 3);
  }
  bodyFlat.setAttribute('color', new THREE.BufferAttribute(bodyCol, 3));
  bodyFlat.computeVertexNormals();

  // Eisspitzen und Schollen am Rand (außerhalb der Fahrfläche), Zapfen am hohen Ende
  const shards: THREE.BufferGeometry[] = [];
  const shard = (r: number, h: number, x: number, y: number, z: number, tilt: number) => {
    const geo = new THREE.ConeGeometry(r, h, 5, 1);
    geo.translate(0, h / 2, 0);
    geo.rotateZ(tilt);
    geo.rotateY(rng.range(0, Math.PI));
    geo.translate(x, y, z);
    geo.deleteAttribute('uv');
    const flat = geo.toNonIndexed();
    const pos = flat.getAttribute('position');
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const k = Math.min(1, Math.max(0, (pos.getY(i) - y) / h));
      c.copy(ICE_DEEP).lerp(EDGE, 0.35 + k * 0.6);
      col.set([c.r, c.g, c.b], i * 3);
    }
    flat.setAttribute('color', new THREE.BufferAttribute(col, 3));
    shards.push(flat);
  };
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const u = rng.range(1.2, D * 0.8);
    const r = rng.range(0.6, 1.2);
    shard(r, rng.range(1.6, 3.6), side * (halfW(u) + r * 0.3), -0.6, u, side * rng.range(0.15, 0.45));
  }
  for (const side of [-1, 1]) shard(rng.range(0.35, 0.55), rng.range(1.4, 2.2), side * (halfW(D - 1.1) - 0.15), -0.1, D - 1.1, side * 0.25);

  const ice = mergeGeometries([top.toNonIndexed(), bodyFlat, ...shards].map((geo) => {
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    return geo;
  }));
  g.add(new THREE.Mesh(ice, iceMat));
  g.name = 'iceberg';
  return g;
}
