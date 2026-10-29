/** Platzhalter aus Grundformen für Umgebungsobjekte: Palme, Fels, Vulkaninsel, Perle. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../config/gameConfig';
import { Rng } from '../../core/Rng';
import { scaleFog, toonMaterial } from '../../fx/toon';
import { fbm, noise3 } from '../../core/noise';
import { islandBiome, islandHeight } from '../../world/islandTerrain';

// Gemeinsame Materialien → Palmen/Felsen lassen sich zu einem Mesh zusammenfassen
let palmTrunkMat: THREE.Material | null = null;
let palmLeafMat: THREE.Material | null = null;

function colorize(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const n = geo.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Palme (ca. 1 m hoch, wird beim Platzieren skaliert). Stamm nach +Y, leicht gebogen. */
export function buildPalm(params: { seed?: number } = {}): THREE.Object3D {
  const rng = new Rng(params.seed ?? 7);
  const lean = rng.range(0.08, 0.2);
  const leanDir = rng.range(0, Math.PI * 2);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const off = lean * t * t;
    pts.push(new THREE.Vector3(Math.cos(leanDir) * off, t, Math.sin(leanDir) * off));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const trunkGeo = new THREE.TubeGeometry(curve, 10, 0.045, 7, false);
  // Verjüngung + Ringe
  const pos = trunkGeo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const dark = new THREE.Color(CONFIG.colors.palmTrunk).multiplyScalar(0.75);
  const light = new THREE.Color(CONFIG.colors.palmTrunk);
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    tmp.fromBufferAttribute(pos, i);
    const t = THREE.MathUtils.clamp(tmp.y, 0, 1);
    const center = curve.getPointAt(t);
    const taper = 1.25 - t * 0.5;
    tmp.sub(center).multiplyScalar(taper).add(center);
    pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
    const ring = Math.sin(t * 60) > 0.2 ? dark : light;
    colors.set([ring.r, ring.g, ring.b], i * 3);
  }
  trunkGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  trunkGeo.computeVertexNormals();

  const top = curve.getPointAt(1);
  const leafGeos: THREE.BufferGeometry[] = [];
  const fronds = 9;
  const leafDark = new THREE.Color(CONFIG.colors.palmLeaf).multiplyScalar(0.7);
  const leafLight = new THREE.Color(CONFIG.colors.palmLeaf).lerp(new THREE.Color('#c8f06a'), 0.35);
  for (let i = 0; i < fronds; i++) {
    const len = rng.range(0.55, 0.68);
    const g = new THREE.PlaneGeometry(len, 0.17, 12, 2);
    g.translate(len / 2, 0, 0);
    const p = g.getAttribute('position');
    const col = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k);
      const y = p.getY(k);
      const t = x / len;
      // Zur Spitze schmaler, gezackte Fiederblätter am Rand, V-förmig gefaltet, hängend
      const taper = 1 - Math.pow(t, 2) * 0.85;
      const saw = Math.abs(y) > 0.04 ? 0.55 + 0.45 * Math.abs(Math.sin(t * 38)) : 1;
      const yy = y * taper * saw;
      p.setXYZ(k, x, -x * x * 1.6 + Math.abs(yy) * 0.55, yy);
      c.copy(leafDark).lerp(leafLight, t * 0.8 + (i % 2) * 0.1);
      col.set([c.r, c.g, c.b], k * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.rotateX(Math.PI / 2);
    g.rotateZ(rng.range(0.1, 0.5));
    g.rotateY((i / fronds) * Math.PI * 2 + rng.range(-0.2, 0.2));
    g.translate(top.x, top.y, top.z);
    leafGeos.push(g);
  }
  for (let i = 0; i < 4; i++) {
    const c = new THREE.SphereGeometry(0.042, 6, 5);
    const a = (i / 4) * Math.PI * 2;
    c.translate(top.x + Math.cos(a) * 0.045, top.y - 0.05, top.z + Math.sin(a) * 0.045);
    leafGeos.push(colorize(c, '#6b3f1f'));
  }
  const leaves = mergeGeometries(leafGeos.map((g) => g.toNonIndexed()));
  leaves.computeVertexNormals();

  const group = new THREE.Group();
  palmTrunkMat ??= scaleFog(toonMaterial('#ffffff', { vertexColors: true }), 0.35);
  palmLeafMat ??= scaleFog(toonMaterial('#ffffff', { vertexColors: true, side: THREE.DoubleSide }), 0.35);
  const trunkMesh = new THREE.Mesh(trunkGeo, palmTrunkMat);
  const leafMesh = new THREE.Mesh(leaves, palmLeafMat);
  group.add(trunkMesh, leafMesh);
  return group;
}

let rockMat: THREE.Material | null = null;

/** Fels (ca. 1 m): fein unterteilt, mit Rauschen verformt, unten dunkler, oben teils bemoost. */
export function buildRock(params: { seed?: number; color?: string } = {}): THREE.Object3D {
  const seed = params.seed ?? 3;
  const geo = new THREE.IcosahedronGeometry(0.5, 3);
  const p = geo.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = noise3(v.x * 2.2 + seed, v.y * 2.2, v.z * 2.2, seed) - 0.5;
    const fine = noise3(v.x * 7, v.y * 7 + seed, v.z * 7, seed + 3) - 0.5;
    const f = 1 + n * 0.55 + fine * 0.12;
    p.setXYZ(i, v.x * f, v.y * f * 0.78, v.z * f);
  }
  geo.computeVertexNormals();
  const base = new THREE.Color(params.color ?? CONFIG.colors.rock);
  const dark = base.clone().multiplyScalar(0.62);
  const moss = new THREE.Color('#5aa84a');
  const mossy = seed % 3 === 0;
  const nrm = geo.getAttribute('normal');
  const colors = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    c.copy(dark).lerp(base, Math.min(1, Math.max(0, (y + 0.25) / 0.5)));
    if (mossy && nrm.getY(i) > 0.75) c.lerp(moss, 0.55);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  rockMat ??= scaleFog(toonMaterial('#ffffff', { vertexColors: true, gloss: 0.15 }), 0.5);
  return new THREE.Mesh(geo, rockMat);
}

/** Perle: schimmernde Kugel mit Glanzpunkt. */
export function buildPearl(params: { gold?: boolean } = {}): THREE.Object3D {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(params.gold ? 0.45 : 0.32, 16, 12),
    params.gold
      ? toonMaterial('#ffe066', { emissive: '#ffb000', emissiveIntensity: 1.1, gloss: 1 })
      : toonMaterial('#fff4fb', { emissive: '#ffb6e6', emissiveIntensity: 0.85, gloss: 1 }),
  );
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  shine.position.set(-0.12, 0.14, 0.2);
  shine.userData.noOutline = true;
  group.add(body, shine);
  return group;
}

/** Vulkaninsel als fein aufgelöstes Gelände (siehe world/islandTerrain.ts), mit Lava im Krater. */
export function buildVolcano(): THREE.Object3D {
  const R = CONFIG.world.islandRadius;
  const H = CONFIG.world.volcanoHeight;
  const rings = 96;
  const segments = 220;
  const maxRn = 1.22;
  const positions = new Float32Array((rings * segments + 1) * 3);
  // Mitte
  positions.set([0, islandHeight(0, 0), 0], 0);
  for (let i = 1; i <= rings; i++) {
    // Ringe innen etwas dichter (Krater, steiler Hang)
    const t = i / rings;
    const rn = maxRn * Math.pow(t, 1.15);
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      const x = Math.cos(a) * rn * R;
      const z = Math.sin(a) * rn * R;
      positions.set([x, islandHeight(x, z), z], (1 + (i - 1) * segments + s) * 3);
    }
  }
  const indices: number[] = [];
  for (let s = 0; s < segments; s++) indices.push(0, 1 + ((s + 1) % segments), 1 + s);
  for (let i = 1; i < rings; i++) {
    const a0 = 1 + (i - 1) * segments;
    const b0 = 1 + i * segments;
    for (let s = 0; s < segments; s++) {
      const s1 = (s + 1) % segments;
      indices.push(a0 + s, a0 + s1, b0 + s, a0 + s1, b0 + s1, b0 + s);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // Farben nach Gelände: Sand, Wiese, Dschungel, Fels, Asche, Krater
  const pos = geo.getAttribute('position');
  const nrm = geo.getAttribute('normal');
  const colors = new Float32Array(pos.count * 3);
  const C = CONFIG.colors;
  const palette = {
    sand: new THREE.Color(C.sand),
    wetSand: new THREE.Color(C.sand).multiplyScalar(0.82),
    grass: new THREE.Color(C.grass),
    grassLight: new THREE.Color(C.grass).lerp(new THREE.Color('#d8f56b'), 0.35),
    jungle: new THREE.Color('#1f9a4a'),
    rock: new THREE.Color('#b07a5c'),
    rockDark: new THREE.Color('#4a2f25'),
    ash: new THREE.Color('#7a6668'),
    ashLight: new THREE.Color('#c2b0ae'),
    crater: new THREE.Color('#3a2320'),
    seabed: new THREE.Color('#e9d58e'),
  };
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const slope = 1 - nrm.getY(i);
    const v = fbm(x * 0.06, z * 0.06, 3, 77) * 0.5 + 0.5;
    // Senkrechte Gesteinsstreifen am Kegel
    const streak = Math.min(1, Math.max(0, fbm(Math.atan2(z, x) * 7, Math.hypot(x, z) * 0.015, 3, 91) * 1.6 + 0.5));
    switch (islandBiome(x, z, y, slope)) {
      case 'sand':
        c.copy(palette.wetSand).lerp(palette.sand, Math.min(1, (y + 0.2) / 1.2));
        break;
      case 'grass':
        c.copy(palette.grass).lerp(palette.grassLight, v * 0.8);
        break;
      case 'jungle':
        c.copy(palette.jungle).lerp(palette.grass, v * 0.4);
        break;
      case 'rock':
        // Kräftige senkrechte Streifen: helles und dunkles Gestein im Wechsel
        c.copy(palette.rockDark).lerp(palette.rock, streak);
        c.lerp(palette.rockDark, Math.min(0.5, slope * 0.5));
        break;
      case 'ash':
        c.copy(palette.ash).lerp(palette.ashLight, streak);
        if (v > 0.65) c.lerp(palette.rock, 0.35);
        break;
      case 'crater':
        c.copy(palette.crater);
        break;
      default:
        c.copy(palette.seabed).lerp(palette.wetSand, 0.4);
    }
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const group = new THREE.Group();
  const mat = scaleFog(toonMaterial('#ffffff', { vertexColors: true, gloss: 0.1, rim: 0.2 }), 0.35);
  const terrain = new THREE.Mesh(geo, mat);
  terrain.name = 'terrain';
  group.add(terrain);

  // Lava: Kratersee und Ströme in den Rinnen – überhell, damit sie leuchten (Bloom)
  const lavaColor = new THREE.Color(C.lava).multiplyScalar(2.6);
  const lavaMat = scaleFog(new THREE.MeshBasicMaterial({ color: lavaColor }), 0.2);
  const lava = new THREE.Mesh(new THREE.CircleGeometry(0.13 * R, 48), lavaMat);
  lava.rotation.x = -Math.PI / 2;
  lava.position.y = 0.915 * H;
  lava.name = 'lava';
  group.add(lava);
  const rng = new Rng(11);
  for (let k = 0; k < 3; k++) {
    const a0 = rng.range(0, Math.PI * 2);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const rn = 0.16 + t * 0.26;
      const a = a0 + Math.sin(t * 4 + k) * 0.05;
      const x = Math.cos(a) * rn * R;
      const z = Math.sin(a) * rn * R;
      pts.push(new THREE.Vector3(x, islandHeight(x, z) + 0.6, z));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 1.5 - k * 0.3, 6, false);
    group.add(new THREE.Mesh(tube, lavaMat));
  }
  return group;
}
