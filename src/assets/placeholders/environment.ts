/** Platzhalter aus Grundformen für Umgebungsobjekte: Palme, Fels, Vulkaninsel, Perle. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../config/gameConfig';
import { Rng } from '../../core/Rng';
import { scaleFog, toonMaterial } from '../../fx/toon';

// Gemeinsame Materialien → Palmen/Felsen lassen sich zu einem Mesh zusammenfassen
let palmTrunkMat: THREE.Material | null = null;
let palmLeafMat: THREE.Material | null = null;
const rockMats = new Map<string, THREE.Material>();

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
  const fronds = 7;
  for (let i = 0; i < fronds; i++) {
    const g = new THREE.PlaneGeometry(0.55, 0.13, 8, 2);
    g.translate(0.275, 0, 0);
    const p = g.getAttribute('position');
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k);
      const y = p.getY(k);
      const taper = 1 - Math.pow(x / 0.55, 2) * 0.85;
      // V-förmig gefaltet und nach unten hängend
      p.setXYZ(k, x, -x * x * 1.4 + Math.abs(y) * 0.5, y * taper);
    }
    g.rotateX(Math.PI / 2);
    g.rotateZ(rng.range(0.15, 0.45));
    g.rotateY((i / fronds) * Math.PI * 2 + rng.range(-0.2, 0.2));
    g.translate(top.x, top.y, top.z);
    leafGeos.push(colorize(g, i % 2 ? CONFIG.colors.palmLeaf : new THREE.Color(CONFIG.colors.palmLeaf).multiplyScalar(0.85)));
  }
  for (let i = 0; i < 3; i++) {
    const c = new THREE.SphereGeometry(0.035, 6, 5);
    const a = (i / 3) * Math.PI * 2;
    c.translate(top.x + Math.cos(a) * 0.04, top.y - 0.04, top.z + Math.sin(a) * 0.04);
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

/** Runder Comic-Fels (ca. 1 m). */
export function buildRock(params: { seed?: number; color?: string } = {}): THREE.Object3D {
  const rng = new Rng(params.seed ?? 3);
  const geo = new THREE.IcosahedronGeometry(0.5, 1);
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const f = 1 + rng.range(-0.12, 0.12);
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.8, p.getZ(i) * f);
  }
  geo.computeVertexNormals();
  const color = params.color ?? CONFIG.colors.rock;
  let mat = rockMats.get(color);
  if (!mat) {
    mat = scaleFog(toonMaterial(color), 0.5);
    rockMats.set(color, mat);
  }
  return new THREE.Mesh(geo, mat);
}

/** Perle: schimmernde Kugel mit Glanzpunkt. */
export function buildPearl(params: { gold?: boolean } = {}): THREE.Object3D {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(params.gold ? 0.45 : 0.32, 16, 12),
    params.gold
      ? toonMaterial('#ffe066', { emissive: '#ffb000', emissiveIntensity: 0.55 })
      : toonMaterial('#fff4fb', { emissive: '#ffb6e6', emissiveIntensity: 0.45 }),
  );
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  shine.position.set(-0.12, 0.14, 0.2);
  shine.userData.noOutline = true;
  group.add(body, shine);
  return group;
}

/** Vulkaninsel aus Lathe-Profil mit Strand, Dschungel, Fels und Krater (Einheit: Meter). */
export function buildVolcano(): THREE.Object3D {
  const rng = new Rng(11);
  const R = CONFIG.world.islandRadius;
  const H = CONFIG.world.volcanoHeight;
  // Profil (Radius, Höhe) relativ zu Inselradius/Vulkanhöhe
  const profile: [number, number][] = [
    [1.3, -0.06],
    [1.06, 0.003],
    [0.98, 0.015],
    [0.84, 0.025],
    [0.76, 0.05],
    [0.68, 0.11],
    [0.58, 0.21],
    [0.47, 0.38],
    [0.36, 0.6],
    [0.26, 0.82],
    [0.2, 0.96],
    [0.175, 1.0],
    [0.14, 0.97],
    [0.1, 0.9],
    [0, 0.89],
  ];
  const pts = profile.map(([r, y]) => new THREE.Vector2(r * R, y * H));
  const geo = new THREE.LatheGeometry(pts, 72);
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(CONFIG.colors.sand);
  const grass = new THREE.Color(CONFIG.colors.grass);
  const grassDark = grass.clone().multiplyScalar(0.75);
  const rock = new THREE.Color(CONFIG.colors.rock);
  const rockDark = new THREE.Color(CONFIG.colors.rockDark);
  const crater = new THREE.Color('#3a2320');
  const c = new THREE.Color();
  const phases = [rng.range(0, 6), rng.range(0, 6), rng.range(0, 6)];
  const wobAt = (a: number, yn: number) =>
    yn > 0.03 ? 1 + 0.07 * Math.sin(5 * a + phases[0]! + yn * 4) + 0.04 * Math.sin(11 * a + phases[1]!) + 0.025 * Math.sin(23 * a + yn * 9) : 1;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    const yn = y / H;
    // organische Unregelmäßigkeit (Strand bleibt rund)
    const wob = wobAt(a, yn);
    pos.setXYZ(i, x * wob, y * (1 + 0.04 * Math.sin(7 * a + phases[2]!) * (yn > 0.1 ? 1 : 0)), z * wob);
    const rn = r / R;
    if (rn > 0.8 && yn < 0.04) c.copy(sand);
    else if (yn < 0.22) c.copy(grass).lerp(grassDark, Math.sin(a * 13) * 0.5 + 0.5);
    else if (yn < 0.42) c.copy(grassDark).lerp(rock, (yn - 0.22) / 0.2);
    else if (rn < 0.17 && yn < 0.995) c.copy(crater);
    else c.copy(rock).lerp(rockDark, Math.min(1, (yn - 0.42) / 0.5) * 0.8 + (Math.sin(a * 9 + yn * 20) > 0.7 ? 0.2 : 0));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const group = new THREE.Group();
  const mat = scaleFog(toonMaterial('#ffffff', { vertexColors: true }), 0.35);
  group.add(new THREE.Mesh(geo, mat));

  // Lava im Krater
  const lavaMat = scaleFog(new THREE.MeshBasicMaterial({ color: CONFIG.colors.lava }), 0.2);
  const lava = new THREE.Mesh(new THREE.CircleGeometry(0.15 * R, 24), lavaMat);
  lava.rotation.x = -Math.PI / 2;
  lava.position.y = 0.905 * H;
  group.add(lava);

  // Lavaströme an den Hängen
  for (let k = 0; k < 3; k++) {
    const a0 = rng.range(0, Math.PI * 2);
    const streamPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const yn = 0.995 - t * 0.5;
      // Radius aus dem Profil interpolieren
      let r = 0.175;
      for (let j = 0; j < 11; j++) {
        const [r0, y0] = profile[j]!;
        const [r1, y1] = profile[j + 1]!;
        if (yn <= y1 && yn >= y0) r = r0 + ((yn - y0) / (y1 - y0)) * (r1 - r0);
        else if (yn >= y1 && yn <= y0) r = r1 + ((yn - y1) / (y0 - y1)) * (r0 - r1);
      }
      const a = a0 + Math.sin(t * 5 + k) * 0.06;
      const rr = r * R * wobAt(a, yn) + 0.8;
      streamPts.push(new THREE.Vector3(Math.cos(a) * rr, yn * H, Math.sin(a) * rr));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(streamPts), 24, 1.6 - k * 0.3, 5, false);
    group.add(new THREE.Mesh(tube, lavaMat));
  }
  return group;
}
