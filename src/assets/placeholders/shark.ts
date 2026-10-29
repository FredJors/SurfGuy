/**
 * Platzhalter-Hai im Comic-Look. Schaut nach +Z, Ursprung = Körpermitte (Wasserlinie).
 * Benannte Teile: 'tail' (Schwanzflosse, wird zum Schwimmen geschwenkt), 'dorsal' (Rückenflosse).
 */
import * as THREE from 'three';
import { mergeStatic } from '../../fx/merge';
import { toonMaterial } from '../../fx/toon';
import type { PlaceholderParams } from './index';

function finShape(w: number, hgt: number, sweep: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.quadraticCurveTo(-w * 0.1 - sweep * 0.3, hgt * 0.6, -sweep, hgt);
  s.quadraticCurveTo(w * 0.15, hgt * 0.45, w / 2, 0);
  s.lineTo(-w / 2, 0);
  return s;
}

export function buildShark(params: PlaceholderParams = {}): THREE.Object3D {
  const colors = (params.colors as { body: string; accent: string; eye: string } | undefined) ?? {
    body: '#6e8fb5',
    accent: '#f4f6fb',
    eye: '#ffe066',
  };
  const body = toonMaterial(colors.body);
  const belly = toonMaterial(colors.accent);
  const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const dark = new THREE.MeshBasicMaterial({ color: '#15121f' });

  const root = new THREE.Group();
  const torso = new THREE.Group();

  const main = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 14), body);
  main.scale.set(0.95, 0.8, 2.6);
  const under = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), belly);
  under.scale.set(0.85, 0.55, 2.35);
  under.position.set(0, -0.28, 0.1);
  // Maul mit Zähnen
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 8), dark);
  mouth.scale.set(1.25, 0.45, 0.6);
  mouth.position.set(0, -0.32, 2.05);
  mouth.userData.noOutline = true;
  torso.add(main, under, mouth);
  for (let i = 0; i < 7; i++) {
    const a = -0.9 + (i / 6) * 1.8;
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 5), white);
    tooth.position.set(Math.sin(a) * 0.42, -0.22, 2.05 + Math.cos(a) * 0.2);
    tooth.rotation.x = Math.PI;
    tooth.userData.noOutline = true;
    torso.add(tooth);
  }
  for (const side of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), white);
    eye.position.set(0.55 * side, 0.22, 1.55);
    eye.userData.noOutline = true;
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), toonMaterial(colors.eye));
    iris.position.set(0.66 * side, 0.21, 1.62);
    iris.userData.noOutline = true;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), dark);
    pupil.position.set(0.72 * side, 0.21, 1.66);
    pupil.userData.noOutline = true;
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.32, 4, 6), body);
    brow.position.set(0.58 * side, 0.42, 1.55);
    brow.rotation.set(0, 0, Math.PI / 2 - 0.45 * side);
    torso.add(eye, iris, pupil, brow);
    // Brustflossen
    const pec = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape(0.9, 0.9, 0.5), { depth: 0.08, bevelEnabled: false }), body);
    pec.rotation.set(Math.PI / 2, 0, side * 1.1);
    pec.position.set(0.75 * side, -0.35, 0.7);
    torso.add(pec);
  }
  root.add(mergeStatic(torso));

  const dorsal = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape(1.3, 1.4, 0.7), { depth: 0.14, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 }), body);
  dorsal.geometry.rotateY(Math.PI / 2);
  dorsal.geometry.translate(-0.07, 0, 0);
  dorsal.position.set(0, 0.62, 0.2);
  dorsal.name = 'dorsal';
  root.add(dorsal);

  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(0, 0.05, -2.3);
  const upper = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape(0.7, 1.4, -0.9), { depth: 0.12, bevelEnabled: false }), body);
  upper.geometry.rotateY(Math.PI / 2);
  upper.geometry.rotateX(-0.35);
  const lower = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape(0.6, 0.9, -0.6), { depth: 0.12, bevelEnabled: false }), body);
  lower.geometry.rotateY(Math.PI / 2);
  lower.geometry.rotateX(Math.PI + 0.45);
  const stem = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), body);
  stem.scale.set(0.8, 0.9, 1.6);
  stem.position.z = 0.25;
  tail.add(stem, upper, lower);
  root.add(tail);
  return root;
}
