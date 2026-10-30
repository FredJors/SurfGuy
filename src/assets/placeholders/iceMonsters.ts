/**
 * Platzhalter für die Monster des Eismeers (Kapitel 3): Eisbär, Seeleopard, Narwal.
 * Alle schauen nach +Z.
 *
 * - Eisbär: Ursprung = Fußsohlen (steht auf seiner Scholle). Teile: 'head', 'legFL'/'legFR'/
 *   'legBL'/'legBR' (Gelenk oben, für Ducken/Springen)
 * - Seeleopard: Ursprung = Körpermitte an der Wasserlinie. Teile: 'jaw' (Unterkiefer klappt auf),
 *   'finL'/'finR' (Vorderflossen), 'tail' (Hinterflossen)
 * - Narwal: Ursprung = Körpermitte an der Wasserlinie. Teile: 'horn' (leuchtet vor dem Angriff),
 *   'tail' (Fluke), 'finL'/'finR'
 */
import * as THREE from 'three';
import { toonMaterial } from '../../fx/toon';
import type { PlaceholderParams } from './index';
import { angryEye, finShape, paint } from './seaMonsters';

type Colors = { body: string; accent: string; eye: string };

function colorsOf(params: PlaceholderParams, fallback: Colors): Colors {
  return (params.colors as Colors | undefined) ?? fallback;
}

/** Ellipsoid aus einer Kugel, nach hinten verjüngt. */
function bodyGeo(a: number, b: number, l: number, taper = 0.5): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 32, 20);
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * a;
    let y = p.getY(i) * b;
    const z = p.getZ(i) * l;
    if (z < 0) {
      const t = Math.pow(-z / l, 1.3);
      x *= 1 - taper * t;
      y *= 1 - taper * t;
    }
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildPolarBear(params: PlaceholderParams = {}): THREE.Object3D {
  const c = colorsOf(params, { body: '#f4efe1', accent: '#d9cfb8', eye: '#1a1626' });
  const fur = toonMaterial('#ffffff', { vertexColors: true, gloss: 0.2 });
  const furPlain = toonMaterial(c.body, { gloss: 0.2 });
  const dark = toonMaterial('#1a1626');
  const root = new THREE.Group();
  const furCol = new THREE.Color(c.body);
  const shade = new THREE.Color(c.accent);

  // Rumpf: kräftig, Schultern höher als das Hinterteil
  const body = bodyGeo(1.05, 0.95, 1.75, 0.25);
  paint(body, (x, y, z, out) => {
    out.copy(furCol).lerp(shade, Math.max(0, -y) * 0.6 + (Math.sin(x * 9) * Math.sin(z * 7) > 0.7 ? 0.15 : 0));
  });
  const torso = new THREE.Mesh(body, fur);
  torso.position.set(0, 1.75, 0);
  torso.rotation.x = -0.08;
  root.add(torso);

  // Kopf mit Schnauze, Ohren, Nase
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 2.35, 1.75);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14), furPlain);
  skull.scale.set(1, 0.9, 1.05);
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.7, 14), furPlain);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.15, 0.6);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), dark);
  nose.position.set(0, -0.05, 0.95);
  nose.userData.noOutline = true;
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 12, Math.PI), dark);
  mouth.rotation.set(Math.PI, 0, 0);
  mouth.position.set(0, -0.32, 0.86);
  mouth.userData.noOutline = true;
  head.add(skull, snout, nose, mouth);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), furPlain);
    ear.scale.set(1, 1, 0.6);
    ear.position.set(side * 0.42, 0.45, -0.1);
    const eye = angryEye(side, 0.13, c.eye, furPlain);
    eye.position.set(side * 0.28, 0.12, 0.5);
    eye.rotation.y = side * 0.35;
    head.add(ear, eye);
  }
  root.add(head);

  // Beine (Gelenk oben) mit dunklen Krallen
  const legs: [string, number, number, number][] = [
    ['legFL', -0.6, 1.0, 0.36],
    ['legFR', 0.6, 1.0, 0.36],
    ['legBL', -0.6, -1.05, 0.33],
    ['legBR', 0.6, -1.05, 0.33],
  ];
  for (const [name, x, z, r] of legs) {
    const leg = new THREE.Group();
    leg.name = name;
    leg.position.set(x, 1.45, z);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, 1.35, 12), furPlain);
    upper.position.y = -0.7;
    const paw = new THREE.Mesh(new THREE.SphereGeometry(r * 1.15, 12, 8), furPlain);
    paw.scale.set(1, 0.55, 1.3);
    paw.position.set(0, -1.35, 0.08);
    const claws = new THREE.Mesh(new THREE.BoxGeometry(r * 1.6, 0.08, 0.12), dark);
    claws.position.set(0, -1.42, 0.42);
    claws.userData.noOutline = true;
    leg.add(upper, paw, claws);
    root.add(leg);
  }
  // Stummelschwanz
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), furPlain);
  tail.position.set(0, 2.0, -1.7);
  root.add(tail);
  return root;
}

export function buildLeopardSeal(params: PlaceholderParams = {}): THREE.Object3D {
  const c = colorsOf(params, { body: '#8a95a6', accent: '#d8dee8', eye: '#e8302c' });
  const vc = toonMaterial('#ffffff', { vertexColors: true, gloss: 0.55 });
  const plain = toonMaterial(c.body, { gloss: 0.5 });
  const mouthMat = toonMaterial('#c23a4a');
  const teethMat = toonMaterial('#fffdf2');
  const bodyCol = new THREE.Color(c.body);
  const belly = new THREE.Color(c.accent);
  const spot = new THREE.Color('#3a4252');
  const root = new THREE.Group();

  // Langer, schlanker Körper mit Leopardenflecken
  const geo = bodyGeo(0.62, 0.55, 1.9, 0.65);
  paint(geo, (x, y, z, out) => {
    out.copy(y < -0.18 ? belly : bodyCol);
    const n = Math.sin(x * 11.3 + z * 2.1) * Math.sin(z * 6.7 - y * 5.3) * Math.sin(y * 9.1 + x * 3.7);
    if (n > 0.38) out.lerp(spot, 0.8);
  });
  root.add(new THREE.Mesh(geo, vc));

  // Großer, reptilienhafter Kopf mit Kiefer
  const head = new THREE.Group();
  head.position.set(0, 0.12, 1.85);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), plain);
  skull.scale.set(0.95, 0.72, 1.25);
  const upperJaw = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), plain);
  upperJaw.scale.set(0.82, 0.42, 1.2);
  upperJaw.position.set(0, -0.05, 0.42);
  head.add(skull, upperJaw);
  const jaw = new THREE.Group();
  jaw.name = 'jaw';
  jaw.position.set(0, -0.2, 0.05);
  const lower = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), plain);
  lower.scale.set(0.78, 0.32, 1.25);
  lower.position.set(0, -0.06, 0.42);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), mouthMat);
  tongue.scale.set(0.7, 0.2, 1.1);
  tongue.position.set(0, 0.04, 0.42);
  tongue.userData.noOutline = true;
  jaw.add(lower, tongue);
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 5), teethMat);
      t.position.set(side * (0.12 + k * 0.06), 0.08, 0.72 - k * 0.14);
      t.userData.noOutline = true;
      jaw.add(t);
      const u = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 5), teethMat);
      u.rotation.x = Math.PI;
      u.position.set(side * (0.12 + k * 0.06), -0.2, 0.92 - k * 0.14);
      u.userData.noOutline = true;
      head.add(u);
    }
    const eye = angryEye(side, 0.11, c.eye, plain);
    eye.position.set(side * 0.3, 0.2, 0.32);
    eye.rotation.y = side * 0.5;
    head.add(eye);
  }
  head.add(jaw);
  root.add(head);

  // Vorderflossen und Hinterflossen
  for (const side of [-1, 1]) {
    const fin = new THREE.Group();
    fin.name = side < 0 ? 'finL' : 'finR';
    fin.position.set(side * 0.5, -0.2, 0.7);
    const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape(1.1, 0.42), { depth: 0.08, bevelEnabled: false }), plain);
    blade.geometry.rotateX(Math.PI / 2);
    blade.rotation.y = side < 0 ? Math.PI * 0.85 : Math.PI * 0.15;
    fin.add(blade);
    root.add(fin);
  }
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(0, 0, -1.75);
  for (const side of [-1, 1]) {
    const flip = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape(0.9, 0.5), { depth: 0.07, bevelEnabled: false }), plain);
    flip.geometry.rotateX(Math.PI / 2);
    flip.rotation.y = -Math.PI / 2 + side * 0.35;
    tail.add(flip);
  }
  root.add(tail);
  return root;
}

export function buildNarwhal(params: PlaceholderParams = {}): THREE.Object3D {
  const c = colorsOf(params, { body: '#9aa8b8', accent: '#eef3f8', eye: '#1d2140' });
  const vc = toonMaterial('#ffffff', { vertexColors: true, gloss: 0.55 });
  const plain = toonMaterial(c.body, { gloss: 0.5 });
  const bodyCol = new THREE.Color(c.body);
  const belly = new THREE.Color(c.accent);
  const mottle = new THREE.Color('#4f5d70');
  const root = new THREE.Group();

  const geo = bodyGeo(1.0, 0.9, 2.5, 0.62);
  paint(geo, (x, y, z, out) => {
    out.copy(y < -0.25 ? belly : bodyCol);
    // Rücken dunkel gesprenkelt
    if (y > -0.1 && Math.sin(x * 7.1 + z * 3.3) * Math.sin(z * 5.9 + y * 4.1) > 0.45) out.lerp(mottle, 0.75);
  });
  root.add(new THREE.Mesh(geo, vc));

  // Langer, gedrehter Stoßzahn
  const horn = new THREE.Group();
  horn.name = 'horn';
  horn.position.set(0.1, 0.05, 2.35);
  const hornMat = toonMaterial('#f5edd6', { gloss: 0.7, emissive: '#7fd6ff', emissiveIntensity: 0 });
  const shaft = new THREE.Mesh(new THREE.ConeGeometry(0.14, 3.0, 10), hornMat);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 1.5;
  const spiralPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const r = 0.14 * (1 - t) + 0.01;
    spiralPts.push(new THREE.Vector3(Math.cos(t * Math.PI * 14) * r, Math.sin(t * Math.PI * 14) * r, t * 2.9));
  }
  const spiral = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiralPts), 120, 0.025, 4, false), toonMaterial('#c9b88f'));
  spiral.userData.noOutline = true;
  horn.add(shaft, spiral);
  root.add(horn);

  for (const side of [-1, 1]) {
    const eye = angryEye(side, 0.14, c.eye, plain);
    eye.position.set(side * 0.62, 0.15, 1.75);
    eye.rotation.y = side * 0.6;
    root.add(eye);
    const fin = new THREE.Group();
    fin.name = side < 0 ? 'finL' : 'finR';
    fin.position.set(side * 0.85, -0.35, 1.0);
    const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape(1.0, 0.45), { depth: 0.1, bevelEnabled: false }), plain);
    blade.geometry.rotateX(Math.PI / 2);
    blade.rotation.y = side < 0 ? Math.PI * 0.9 : Math.PI * 0.1;
    fin.add(blade);
    root.add(fin);
  }
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(0, 0, -2.35);
  for (const side of [-1, 1]) {
    const fluke = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape(1.2, 0.6), { depth: 0.1, bevelEnabled: false }), plain);
    fluke.geometry.rotateX(Math.PI / 2);
    fluke.rotation.y = -Math.PI / 2 + side * 0.9;
    tail.add(fluke);
  }
  root.add(tail);
  return root;
}
