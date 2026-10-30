/**
 * Platzhalter für die Monster des Feuermeers (Kapitel 2): Seeschlange, Wal, Riesenmuschel.
 * Alle schauen nach +Z, Ursprung = Wasserlinie in der Körpermitte (Schlange: Kopf).
 *
 * Benannte Teile:
 * - Seeschlange: 'head' (darin 'jaw'), 'seg0' … 'segN' (Körpersegmente, die das Verhalten
 *   einzeln entlang der Schwimmbahn setzt)
 * - Wal: 'tail' (Fluke), 'finL'/'finR' (Brustflossen)
 * - Muschel: 'lid' (Deckel, klappt um die Scharnier-Achse x auf), 'pearl' (leuchtende Perle)
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mergeChildMeshes } from '../../fx/merge';
import { toonMaterial } from '../../fx/toon';
import type { PlaceholderParams } from './index';

type Colors = { body: string; accent: string; eye: string };

function colorsOf(params: PlaceholderParams, fallback: Colors): Colors {
  return (params.colors as Colors | undefined) ?? fallback;
}

/** Färbt jede Ecke einer Geometrie nach ihrer Position (für einfarbige Toon-Materialien mit Vertexfarben). */
export function paint(geo: THREE.BufferGeometry, fn: (x: number, y: number, z: number, out: THREE.Color) => void): THREE.BufferGeometry {
  const p = geo.getAttribute('position');
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    fn(p.getX(i), p.getY(i), p.getZ(i), c);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (geo.getAttribute('uv')) geo.deleteAttribute('uv');
  return geo;
}

/** Auge im Comic-Stil mit böser Braue (schaut nach +Z, leicht zur Seite). */
export function angryEye(side: number, size: number, iris: string, brow: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const dark = new THREE.MeshBasicMaterial({ color: '#15121f' });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(size, 14, 10), white);
  const ir = new THREE.Mesh(new THREE.SphereGeometry(size * 0.58, 12, 8), toonMaterial(iris));
  ir.position.set(side * size * 0.25, -size * 0.05, size * 0.5);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(size * 0.3, 10, 8), dark);
  pupil.scale.set(0.55, 1.2, 1);
  pupil.position.set(side * size * 0.32, -size * 0.05, size * 0.82);
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(size * 0.22, size * 1.4, 4, 6), brow);
  b.position.set(0, size * 0.95, size * 0.3);
  b.rotation.set(0, 0, Math.PI / 2 + side * 0.5);
  for (const m of [ball, ir, pupil]) m.userData.noOutline = true;
  g.add(ball, ir, pupil, b);
  return g;
}

export function finShape(len: number, width: number, notches = 0): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, -width / 2);
  s.quadraticCurveTo(len * 0.6, -width * 0.7, len, -width * 0.1);
  if (notches > 0) {
    for (let i = 1; i <= notches; i++) {
      const t = 1 - i / (notches + 1);
      s.lineTo(len * t + len * 0.04, width * (0.1 + 0.4 * (1 - t)) - width * 0.12);
      s.lineTo(len * t, width * (0.1 + 0.4 * (1 - t)));
    }
  }
  s.quadraticCurveTo(len * 0.4, width * 0.7, 0, width / 2);
  s.lineTo(0, -width / 2);
  return s;
}

// ---------------------------------------------------------------------------
// Seeschlange
// ---------------------------------------------------------------------------

export function buildSerpent(params: PlaceholderParams = {}): THREE.Object3D {
  const c = colorsOf(params, { body: '#1fa37f', accent: '#ffd166', eye: '#ff3b30' });
  const segments = (params.segments as number | undefined) ?? 9;
  const body = toonMaterial(c.body, { gloss: 0.7 });
  const accent = toonMaterial(c.accent, { gloss: 0.4 });
  const vc = toonMaterial('#ffffff', { vertexColors: true, gloss: 0.7 });
  const mouthMat = toonMaterial('#5a0f1e');
  const toothMat = toonMaterial('#fffbe8', { gloss: 0.5 });
  const root = new THREE.Group();
  const bodyCol = new THREE.Color(c.body);
  const dark = bodyCol.clone().multiplyScalar(0.62);
  const belly = new THREE.Color(c.accent);

  // Kopf (Ursprung = Nacken, Schnauze Richtung +Z)
  const head = new THREE.Group();
  head.name = 'head';
  const skullGeo = paint(new THREE.SphereGeometry(1, 26, 18), (x, y, z, out) => {
    out.copy(y < -0.45 ? belly : bodyCol);
    // dunkle Flecken oben
    if (y > 0.3 && Math.sin(x * 7) * Math.sin(z * 5) > 0.55) out.copy(dark);
  });
  const skull = new THREE.Mesh(skullGeo, vc);
  skull.scale.set(0.95, 0.78, 1.4);
  skull.position.set(0, 0.1, 0.55);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), body);
  snout.scale.set(0.6, 0.42, 1.0);
  snout.position.set(0, 0.05, 1.7);
  const inside = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), mouthMat);
  inside.scale.set(0.5, 0.22, 1.05);
  inside.position.set(0, -0.25, 1.45);
  inside.userData.noOutline = true;
  head.add(skull, snout, inside);
  // Obere Zähne
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3 - i * 0.04, 6), toothMat);
      t.rotation.x = Math.PI;
      t.position.set(side * (0.38 - i * 0.05), -0.32, 2.35 - i * 0.32);
      t.userData.noOutline = true;
      head.add(t);
    }
  }
  // Unterkiefer (klappt beim Zubeißen auf)
  const jaw = new THREE.Group();
  jaw.name = 'jaw';
  jaw.position.set(0, -0.32, 0.3);
  const lower = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), accent);
  lower.scale.set(0.52, 0.22, 1.25);
  lower.position.set(0, -0.08, 1.15);
  jaw.add(lower);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 6), toothMat);
      t.position.set(side * (0.34 - i * 0.05), 0.12, 1.95 - i * 0.35);
      t.userData.noOutline = true;
      jaw.add(t);
    }
  }
  // gespaltene Zunge
  const tongue = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.8, 4, 6), toonMaterial('#ff4f7a'));
  tongue.rotation.x = Math.PI / 2;
  tongue.position.set(0, 0.02, 1.5);
  jaw.add(tongue);
  head.add(jaw);
  // Augen, Hörner, Nüstern
  for (const side of [-1, 1]) {
    const eye = angryEye(side, 0.25, c.eye, body);
    eye.position.set(side * 0.62, 0.42, 1.25);
    eye.rotation.y = side * 0.5;
    head.add(eye);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.3, 8), accent);
    horn.position.set(side * 0.5, 0.75, 0.0);
    horn.rotation.set(-1.15, 0, -side * 0.35);
    head.add(horn);
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#0e2a22' }));
    nostril.position.set(side * 0.2, 0.42, 2.45);
    nostril.userData.noOutline = true;
    head.add(nostril);
    // Kiemen-Fächer an den Wangen
    const frill = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape(1.1, 0.9, 3), { depth: 0.06, bevelEnabled: false }), accent);
    frill.position.set(side * 0.82, 0.05, 0.1);
    frill.rotation.set(0, side > 0 ? 0.8 : Math.PI - 0.8, 0);
    head.add(frill);
  }
  // Kamm auf dem Kopf
  const crest = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape(1.8, 0.9, 4), { depth: 0.07, bevelEnabled: false }), accent);
  // Form-x → nach hinten (-z), Form-y → nach oben
  crest.geometry.rotateY(Math.PI / 2);
  crest.geometry.translate(-0.035, 0, 0);
  crest.position.set(0, 0.75, 0.9);
  crest.rotation.x = -0.1;
  head.add(crest);
  // Viele Kleinteile → wenige Draw-Calls (Kiefer und Augen bleiben eigene Gruppen)
  mergeChildMeshes(head);
  root.add(head);

  // Körpersegmente (jedes ein Mesh, Vertexfarben: Bauch, Bänder, Rückenstachel)
  for (let i = 0; i < segments; i++) {
    const k = i / Math.max(1, segments - 1);
    const r = 1.0 * (1 - 0.6 * k);
    const band = i % 2 === 0 ? bodyCol : bodyCol.clone().lerp(dark, 0.45);
    const sphere = new THREE.SphereGeometry(r, 18, 12);
    sphere.scale(1, 0.92, 1.3);
    paint(sphere, (_x, y, _z, out) => out.copy(y < -r * 0.35 ? belly : band));
    const flat = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);
    const parts: THREE.BufferGeometry[] = [flat(sphere)];
    const spike = new THREE.ConeGeometry(r * 0.22, r * 0.95, 7);
    spike.rotateX(-0.55);
    spike.translate(0, r * 1.05, -r * 0.2);
    parts.push(flat(paint(spike, (_x, _y, _z, out) => out.copy(belly))));
    if (i === segments - 1) {
      // Schwanzflosse
      const fin = new THREE.ExtrudeGeometry(finShape(2.2, 1.6, 3), { depth: 0.08, bevelEnabled: false });
      fin.rotateY(Math.PI / 2);
      fin.translate(-0.04, 0, -r * 0.8);
      parts.push(flat(paint(fin, (_x, _y, _z, out) => out.copy(belly))));
    }
    const seg = new THREE.Mesh(mergeGeometries(parts), vc);
    seg.name = `seg${i}`;
    root.add(seg);
  }
  return root;
}

// ---------------------------------------------------------------------------
// Wal
// ---------------------------------------------------------------------------

export function buildWhale(params: PlaceholderParams = {}): THREE.Object3D {
  const c = colorsOf(params, { body: '#34508f', accent: '#e4ebf5', eye: '#ffffff' });
  const vc = toonMaterial('#ffffff', { vertexColors: true, gloss: 0.6 });
  const accent = toonMaterial(c.accent, { gloss: 0.4 });
  const bodyCol = new THREE.Color(c.body);
  const belly = new THREE.Color(c.accent);
  const pleat = belly.clone().lerp(bodyCol, 0.35);
  const root = new THREE.Group();
  const L = 6.2;
  const A = 2.3;
  const B = 2.0;

  // Rumpf: Ellipsoid, nach hinten verjüngt, Kopf oben flacher
  const geo = new THREE.SphereGeometry(1, 40, 24);
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * A;
    let y = p.getY(i) * B;
    const z = p.getZ(i) * L;
    if (z < 0) {
      const t = Math.pow(-z / L, 1.4);
      x *= 1 - 0.62 * t;
      y *= 1 - 0.55 * t;
    } else if (y > 0) {
      y *= 1 - 0.18 * (z / L);
    }
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  paint(geo, (x, y, z, out) => {
    if (y < -0.55) {
      // Kehlfurchen vorne am Bauch
      out.copy(z > -1 && Math.floor((x + 10) * 3.2) % 2 === 0 ? pleat : belly);
    } else {
      out.copy(bodyCol);
      // helle Sprenkel
      if (Math.sin(x * 5.3) * Math.sin(z * 3.1) * Math.sin(y * 4.7) > 0.6) out.lerp(belly, 0.35);
    }
  });
  root.add(new THREE.Mesh(geo, vc));

  // Maul-Linie
  /** Höhe der Rückenlinie (x = 0) an Position z */
  const topY = (z: number) => {
    const y = B * Math.sqrt(Math.max(0, 1 - (z / L) ** 2));
    return z < 0 ? y * (1 - 0.55 * Math.pow(-z / L, 1.4)) : y * (1 - 0.18 * (z / L));
  };
  const surf = (a: number, y: number): THREE.Vector3 => {
    const k = Math.sqrt(Math.max(0, 1 - (y / B) ** 2));
    return new THREE.Vector3(Math.sin(a) * A * k * 1.01, y, Math.cos(a) * L * k * 1.003);
  };
  const mouthPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = -1.25 + (i / 24) * 2.5;
    mouthPts.push(surf(a, -0.55 - 0.18 * Math.cos(a * 1.2)));
  }
  const mouth = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mouthPts), 48, 0.07, 6, false), new THREE.MeshBasicMaterial({ color: '#141026' }));
  mouth.userData.noOutline = true;
  root.add(mouth);
  for (const side of [-1, 1]) {
    const eye = angryEye(side, 0.3, '#3a2a1a', toonMaterial(c.body));
    const pos = surf(side * 1.22, -0.2);
    eye.position.copy(pos);
    eye.rotation.y = side * 1.2;
    root.add(eye);
    // Brustflossen (lang, mit Höckern an der Vorderkante)
    const fin = new THREE.Group();
    fin.name = side < 0 ? 'finL' : 'finR';
    const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape(4.6, 1.1, 5), { depth: 0.18, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 1 }), accent);
    blade.geometry.rotateX(Math.PI / 2);
    blade.rotation.y = side < 0 ? Math.PI : 0;
    fin.add(blade);
    fin.position.set(side * A * 0.82, -0.9, 2.3);
    fin.rotation.set(0, side * 0.5, -side * 0.45);
    root.add(fin);
  }
  // Knubbel auf dem Kopf, Blasloch, kleine Rückenfinne
  const knob = toonMaterial(bodyCol.clone().lerp(belly, 0.25), { gloss: 0.3 });
  for (let i = 0; i < 9; i++) {
    const a = (i % 3 - 1) * 0.35;
    const zz = 4.4 + Math.floor(i / 3) * 0.55;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), knob);
    b.position.set(Math.sin(a) * 0.9, topY(zz) * (1 - 0.06 * Math.abs(a)) - 0.02, zz);
    root.add(b);
  }
  const hole = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6), new THREE.MeshBasicMaterial({ color: '#141026' }));
  hole.scale.set(1, 0.3, 1.6);
  hole.position.set(0, topY(2.2) - 0.03, 2.2);
  hole.userData.noOutline = true;
  root.add(hole);
  const hump = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.8, 10), toonMaterial(c.body));
  hump.scale.set(0.6, 1, 1.6);
  hump.position.set(0, topY(-2.2) + 0.1, -2.2);
  hump.rotation.x = -0.4;
  root.add(hump);

  // Fluke (Schwanzflosse) am Gelenk
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(0, 0.05, -L * 0.92);
  const stem = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), toonMaterial(c.body));
  stem.scale.set(1, 0.8, 2.4);
  stem.position.z = -0.7;
  tail.add(stem);
  const fluke = new THREE.Shape();
  fluke.moveTo(0, 0.3);
  fluke.quadraticCurveTo(-1.4, 0.4, -2.8, -0.6);
  fluke.quadraticCurveTo(-1.6, -1.0, -0.25, -1.1);
  fluke.lineTo(0, -0.8);
  fluke.lineTo(0.25, -1.1);
  fluke.quadraticCurveTo(1.6, -1.0, 2.8, -0.6);
  fluke.quadraticCurveTo(1.4, 0.4, 0, 0.3);
  const flukeGeo = new THREE.ExtrudeGeometry(fluke, { depth: 0.2, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 1 });
  flukeGeo.rotateX(Math.PI / 2);
  flukeGeo.translate(0, 0.1, -1.2);
  tail.add(new THREE.Mesh(flukeGeo, toonMaterial(c.body)));
  root.add(tail);
  mergeChildMeshes(root);
  return root;
}

// ---------------------------------------------------------------------------
// Riesenmuschel
// ---------------------------------------------------------------------------

/**
 * Schalenhälfte einer Riesenmuschel: große Wellenfalten am Rand (passen bei Deckel und Wanne
 * ineinander), feine Rippen. `up` = 1 für den Deckel (Kuppel), -1 für die Wanne.
 * `inner` = Innenseite (Perlmutt): etwas kleiner, Dreiecke nach innen gewendet.
 */
function shellGeometry(R: number, depth: number, up: 1 | -1, outer: THREE.Color, light: THREE.Color, inner = false): THREE.BufferGeometry {
  const rings = 16;
  const seg = 120;
  const folds = 5;
  const ribs = 26;
  const shrink = inner ? 0.94 : 1;
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i <= rings; i++) {
    const r = i / rings;
    for (let j = 0; j <= seg; j++) {
      const phi = (j / seg) * Math.PI * 2;
      const wave = Math.sin(phi * folds);
      const rib = Math.abs(Math.sin((phi * ribs) / 2));
      const rr = R * r * shrink * (1 + 0.06 * wave * r);
      const x = Math.cos(phi) * rr;
      const z = Math.sin(phi) * rr * 0.86;
      // Kuppel; die Falten heben/senken den Rand bei beiden Hälften gleich (Zickzack-Naht)
      const y = (up * (depth * (1 - r * r) + rib * 0.12 * r) + wave * 0.55 * r * r) * shrink;
      pos.push(x, y, z);
      if (inner) {
        c.copy(light).lerp(outer, 0.15 + 0.2 * (1 - r));
      } else {
        // Falten-Kämme heller, Rillen dunkler
        c.copy(outer).lerp(light, Math.max(0, wave) * 0.45 * r + Math.pow(r, 4) * 0.35);
        if (rib < 0.2) c.multiplyScalar(0.72);
      }
      col.push(c.r, c.g, c.b);
    }
  }
  const idx: number[] = [];
  const flip = (up > 0) !== inner;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * (seg + 1) + j;
      const b = a + seg + 1;
      if (flip) idx.push(a, a + 1, b, a + 1, b + 1, b);
      else idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function buildClam(params: PlaceholderParams = {}): THREE.Object3D {
  const c = colorsOf(params, { body: '#8a5cc7', accent: '#3fe0c5', eye: '#fff4c2' });
  const R = 3.2;
  const shellMat = toonMaterial('#ffffff', { vertexColors: true, gloss: 0.5 });
  const nacreMat = toonMaterial('#ffffff', { vertexColors: true, gloss: 1 });
  const outer = new THREE.Color(c.body);
  const light = new THREE.Color('#f6e9ff');
  const root = new THREE.Group();
  const hingeZ = -R * 0.86;

  const bottom = new THREE.Mesh(shellGeometry(R, 1.6, -1, outer, light), shellMat);
  const bottomIn = new THREE.Mesh(shellGeometry(R, 1.6, -1, outer, light, true), nacreMat);
  bottomIn.userData.noOutline = true;
  root.add(bottom, bottomIn);

  // Mantel (bunt gefleckt) und Perle in der Wanne
  const mantle = new THREE.CircleGeometry(R * 0.66, 48, 0, Math.PI * 2);
  mantle.rotateX(-Math.PI / 2);
  mantle.scale(1, 1, 0.86);
  const mp = mantle.getAttribute('position');
  const spotA = new THREE.Color(c.accent);
  const spotB = new THREE.Color('#2a6bff');
  const base = new THREE.Color('#7b3fd1');
  for (let i = 0; i < mp.count; i++) {
    const x = mp.getX(i);
    const z = mp.getZ(i);
    const r = Math.hypot(x, z / 0.86) / (R * 0.66);
    mp.setY(i, -0.55 + Math.sin(Math.atan2(z, x) * 5) * 0.25 * r * r);
  }
  paint(mantle, (x, _y, z, out) => {
    const s = Math.sin(x * 2.3) * Math.sin(z * 2.9);
    out.copy(base).lerp(s > 0.35 ? spotA : spotB, s > 0.35 ? 0.85 : Math.max(0, -s) * 0.7);
  });
  mantle.computeVertexNormals();
  const mantleMesh = new THREE.Mesh(mantle, toonMaterial('#ffffff', { vertexColors: true, gloss: 0.8 }));
  mantleMesh.userData.noOutline = true;
  root.add(mantleMesh);
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 16), toonMaterial(c.eye, { emissive: '#ffb347', emissiveIntensity: 0.35, gloss: 1 }));
  pearl.name = 'pearl';
  pearl.position.set(0, 0.35, -0.2);
  root.add(pearl);
  // Augen auf dem Mantel (vorne), schauen grimmig heraus
  for (const side of [-1, 1]) {
    const eye = angryEye(side, 0.32, '#ff5a3c', toonMaterial('#3a1f5c'));
    eye.position.set(side * 0.95, -0.15, R * 0.42);
    root.add(eye);
  }

  // Deckel am Scharnier hinten
  const lid = new THREE.Group();
  lid.name = 'lid';
  lid.position.set(0, 0, hingeZ);
  const top = new THREE.Mesh(shellGeometry(R, 1.4, 1, outer, light), shellMat);
  const topIn = new THREE.Mesh(shellGeometry(R, 1.4, 1, outer, light, true), nacreMat);
  topIn.userData.noOutline = true;
  top.position.z = topIn.position.z = -hingeZ;
  lid.add(top, topIn);
  root.add(lid);
  // Scharnier-Wulst
  const hinge = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.6, 4, 8), toonMaterial(outer.clone().multiplyScalar(0.7)));
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, 0, hingeZ - 0.1);
  root.add(hinge);
  return root;
}
