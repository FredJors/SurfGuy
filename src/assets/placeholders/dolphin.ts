/** Platzhalter: Delfin (ca. 2,4 m, schaut nach +Z). */
import * as THREE from 'three';
import { toonMaterial } from '../../fx/toon';

export function buildDolphin(params: { colors?: Record<string, string> } = {}): THREE.Object3D {
  const body = toonMaterial(params.colors?.body ?? '#5f86c4');
  const belly = toonMaterial(params.colors?.belly ?? '#eaf3ff');
  const dark = toonMaterial('#1d2140');
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), body);
  torso.scale.set(0.5, 0.48, 1.25);
  const under = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), belly);
  under.scale.set(0.42, 0.34, 1.05);
  under.position.set(0, -0.14, 0.08);
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.5, 10), body);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.08, 1.35);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 4), body);
  fin.scale.set(0.35, 1, 1);
  fin.position.set(0, 0.55, -0.1);
  fin.rotation.x = -0.45;
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.z = -1.15;
  const stock = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, 0.7, 8), body);
  stock.rotation.x = Math.PI / 2;
  stock.position.z = -0.25;
  const fluke = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.32), body);
  fluke.position.z = -0.62;
  tail.add(stock, fluke);
  for (const side of [-1, 1]) {
    const pec = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.22), body);
    pec.position.set(side * 0.45, -0.22, 0.35);
    pec.rotation.set(0, side * -0.5, side * -0.4);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), dark);
    eye.position.set(side * 0.3, 0.05, 0.92);
    eye.userData.noOutline = true;
    g.add(pec, eye);
  }
  g.add(torso, under, snout, fin, tail);
  return g;
}
