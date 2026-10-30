/**
 * Platzhalter: Lava-Titan (Peles Wächter). Ein Riese aus glühendem Magma, gepanzert mit
 * Basaltplatten – durch die Spalten leuchtet die Lava. Schaut nach +Z, Ursprung = Lava-
 * oberfläche in der Körpermitte (der Unterleib steckt im See).
 * Mit `style: 'ice'` derselbe Riese als Frostkoloss (Poliʻahus Wächter): Eisplatten statt
 * Basalt, ein leuchtend blauer Kern und eine Krone aus Eiszapfen.
 *
 * Benannte Teile: 'torso' (Oberkörper, kann sich neigen), darin 'head' (mit 'eyes', 'mouth'),
 * 'armL'/'armR' (Schulter), 'forearmL'/'forearmR' (Ellbogen), 'fistL'/'fistR' (Faust), 'core'
 * (glühender Kern in der Brust).
 */
import * as THREE from 'three';
import { noise3 } from '../../core/noise';
import { Rng } from '../../core/Rng';
import { mergeChildMeshes } from '../../fx/merge';
import { toonMaterial } from '../../fx/toon';

type Colors = { body: string; accent: string; eye: string };

type Style = 'lava' | 'ice';

/** Farben je Stil: Facetten der Platten (dunkel → hell), Material der Platten und der Krone */
const STYLES: Record<Style, { dark: string; mid: string; plate: () => THREE.Material; crown: () => THREE.Material }> = {
  lava: {
    dark: '#231a20',
    mid: '#463339',
    plate: () => toonMaterial('#ffffff', { vertexColors: true, gloss: 0.25 }),
    crown: () => toonMaterial('#17121f', { gloss: 1, rim: 0.6 }),
  },
  ice: {
    dark: '#7fb4dc',
    mid: '#eaf7ff',
    plate: () => toonMaterial('#ffffff', { vertexColors: true, gloss: 0.7, rim: 0.4 }),
    crown: () => toonMaterial('#bff0ff', { gloss: 1, rim: 0.7, emissive: '#3a8fd8', emissiveIntensity: 0.35 }),
  },
};
const materials = new Map<Style, { plate: THREE.Material; crown: THREE.Material }>();

/** Grober Felsbrocken (verbeult, flach schattiert, Vertexfarben). */
function rock(r: number, seed: number, sx = 1, sy = 1, sz = 1, style: Style = 'lava'): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(r, 1);
  const p = geo.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = noise3(v.x * 0.6 + seed, v.y * 0.6, v.z * 0.6, seed) - 0.5;
    v.multiplyScalar(1 + n * 0.45);
    p.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  const flat = geo.index ? geo.toNonIndexed() : geo;
  flat.computeVertexNormals();
  const fp = flat.getAttribute('position');
  const col = new Float32Array(fp.count * 3);
  const c = new THREE.Color();
  const dark = new THREE.Color(STYLES[style].dark);
  const mid = new THREE.Color(STYLES[style].mid);
  for (let i = 0; i < fp.count; i += 3) {
    // je Dreieck eine Farbe (Facetten)
    const k = noise3(fp.getX(i) * 0.9, fp.getY(i) * 0.9, fp.getZ(i) * 0.9, seed + 3);
    c.copy(dark).lerp(mid, k);
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (i + j) * 3);
  }
  flat.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (flat.getAttribute('uv')) flat.deleteAttribute('uv');
  return flat;
}

function magma(color: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.7) });
}

/** Glied: Magma-Kern (zylindrisch) + Basaltplatten ringsum. Länge entlang -Y. */
function limb(len: number, radius: number, seed: number, glow: THREE.Material, plateMat: THREE.Material, style: Style): THREE.Group {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CapsuleGeometry(radius * 0.82, len, 4, 10), glow);
  core.position.y = -len / 2;
  core.userData.noOutline = true;
  g.add(core);
  const rng = new Rng(seed);
  const rings = Math.max(2, Math.round(len / (radius * 0.9)));
  for (let i = 0; i < rings; i++) {
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + i * 0.7 + rng.range(-0.2, 0.2);
      const plate = new THREE.Mesh(rock(radius * 0.62, seed + i * 7 + k, 1.1, 1.25, 0.6, style), plateMat);
      plate.position.set(Math.cos(a) * radius * 0.78, -((i + 0.5) / rings) * len, Math.sin(a) * radius * 0.78);
      plate.rotation.y = -a + Math.PI / 2;
      g.add(plate);
    }
  }
  return g;
}

export function buildTitan(params: { colors?: Colors; style?: Style } = {}): THREE.Object3D {
  const style = params.style ?? 'lava';
  const c = params.colors ?? { body: '#2b2026', accent: '#ff6a1a', eye: '#ffe066' };
  let mats = materials.get(style);
  if (!mats) {
    mats = { plate: STYLES[style].plate(), crown: STYLES[style].crown() };
    materials.set(style, mats);
  }
  const basalt = mats.plate;
  const obsidian = mats.crown;
  const R = (r: number, seed: number, sx = 1, sy = 1, sz = 1) => rock(r, seed, sx, sy, sz, style);
  const glow = magma(c.accent);
  const root = new THREE.Group();

  // Unterleib im See (nur der obere Rand schaut heraus) + Lava-Wulst an der Oberfläche
  const hips = new THREE.Mesh(R(7.5, 3, 1.2, 0.6, 1), basalt);
  hips.position.y = -1.5;
  root.add(hips);

  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 3;
  root.add(torso);

  // Brust: Magma-Körper mit Basaltpanzer
  const chestCore = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), glow);
  chestCore.scale.set(6.6, 7.4, 4.8);
  chestCore.position.y = 6;
  chestCore.userData.noOutline = true;
  torso.add(chestCore);
  const plates = new THREE.Group();
  const rng = new Rng(9);
  for (let i = 0; i < 26; i++) {
    // Kugelkoordinaten auf dem Brustkörper, Lücken lassen
    const u = rng.range(-0.95, 0.95);
    const a = rng.range(0, Math.PI * 2);
    const ring = Math.sqrt(1 - u * u);
    const nx = Math.cos(a) * ring;
    const nz = Math.sin(a) * ring;
    const plate = new THREE.Mesh(R(rng.range(2.1, 3.1), 20 + i, 1.15, 1, 0.55), basalt);
    plate.position.set(nx * 6.4, 6 + u * 7.1, nz * 4.6);
    plate.lookAt(nx * 20, 6 + u * 20, nz * 20);
    plates.add(plate);
  }
  mergeChildMeshes(plates);
  torso.add(plates);
  // Glühender Kern in der Brust (Trefferpunkt, pulsiert)
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(2, 1), magma(c.eye));
  core.name = 'core';
  core.position.set(0, 7, 4.3);
  core.userData.noOutline = true;
  torso.add(core);

  // Kopf
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 14.6, 0.6);
  const skull = new THREE.Mesh(R(3.6, 41, 1, 1.05, 0.95), basalt);
  skull.position.y = 2;
  const brow = new THREE.Mesh(R(1.6, 43, 2.6, 0.55, 0.8), basalt);
  brow.position.set(0, 3.1, 2.9);
  brow.rotation.x = 0.25;
  const jawRock = new THREE.Mesh(R(2.4, 47, 1.25, 0.6, 1), basalt);
  jawRock.position.set(0, 0.1, 1.2);
  head.add(skull, brow, jawRock);
  const eyes = new THREE.Group();
  eyes.name = 'eyes';
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8), magma(c.eye));
    eye.scale.set(1.3, 0.7, 0.6);
    eye.position.set(side * 1.35, 2.5, 3.25);
    eye.rotation.z = side * -0.35;
    eye.userData.noOutline = true;
    eyes.add(eye);
  }
  head.add(eyes);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.35, 0.6), magma(c.accent));
  mouth.name = 'mouth';
  mouth.position.set(0, 0.9, 3.2);
  mouth.userData.noOutline = true;
  head.add(mouth);
  // Obsidian-Krone
  for (let i = 0; i < 7; i++) {
    const a = -1.2 + (i / 6) * 2.4;
    const h = 2.4 + (i === 3 ? 1.8 : i % 2 === 0 ? 0.6 : 1.2);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.55, h, 5), obsidian);
    spike.position.set(Math.sin(a) * 2.6, 4.6 + h / 2 - 0.6, Math.cos(a) * 1.4 - 0.4);
    spike.rotation.set(-0.15 + Math.cos(a) * 0.2, 0, -Math.sin(a) * 0.45);
    head.add(spike);
  }
  torso.add(head);

  // Arme: Schulter → Oberarm → Ellbogen → Unterarm → Faust
  for (const side of [-1, 1]) {
    const s = side < 0 ? 'L' : 'R';
    const shoulder = new THREE.Mesh(R(3.2, 60 + side, 1.1, 0.9, 1.1), basalt);
    shoulder.position.set(side * 7.4, 11.4, 0);
    torso.add(shoulder);
    const arm = new THREE.Group();
    arm.name = `arm${s}`;
    arm.position.set(side * 8.4, 11, 0);
    arm.add(limb(7, 2.1, 70 + side, glow, basalt, style));
    torso.add(arm);
    const fore = new THREE.Group();
    fore.name = `forearm${s}`;
    fore.position.y = -7;
    fore.add(limb(6.5, 1.9, 80 + side, glow, basalt, style));
    arm.add(fore);
    const fist = new THREE.Group();
    fist.name = `fist${s}`;
    fist.position.y = -7;
    const knuckles = new THREE.Mesh(R(2.8, 90 + side, 1.1, 0.95, 1.05), basalt);
    knuckles.position.y = -1.6;
    const fistGlow = new THREE.Mesh(new THREE.SphereGeometry(2.1, 12, 10), glow);
    fistGlow.position.y = -1.6;
    fistGlow.userData.noOutline = true;
    fist.add(fistGlow, knuckles);
    fore.add(fist);
    // Obsidian-Dornen auf der Schulter
    for (let k = 0; k < 3; k++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6 - k * 0.5, 5), obsidian);
      spike.position.set(side * (7.6 + k * 0.9), 13.6 - k * 0.6, -0.6 + k * 0.8);
      spike.rotation.z = -side * (0.5 + k * 0.15);
      torso.add(spike);
    }
  }
  return root;
}
