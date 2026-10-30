/** Platzhalter: Pinguin beim Tauchen (ca. 1,1 m, waagrecht, schaut nach +Z). */
import * as THREE from 'three';
import { toonMaterial } from '../../fx/toon';

export function buildPenguin(): THREE.Object3D {
  const back = toonMaterial('#22284a');
  const belly = toonMaterial('#f6f8ff');
  const orange = toonMaterial('#ffa21f');
  const dark = toonMaterial('#0f1330');
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), back);
  torso.scale.set(0.3, 0.29, 0.56);
  const front = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), belly);
  front.scale.set(0.26, 0.23, 0.5);
  front.position.set(0, -0.08, 0.04);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), back);
  head.position.set(0, 0.04, 0.56);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 8), orange);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.0, 0.8);
  g.add(torso, front, head, beak);
  for (const side of [-1, 1]) {
    // Wangen (weiß) und Ohrflecken (orange)
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), belly);
    cheek.scale.set(0.6, 1, 1.2);
    cheek.position.set(side * 0.15, 0.02, 0.6);
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), orange);
    patch.scale.set(0.5, 1, 1.4);
    patch.position.set(side * 0.17, -0.02, 0.44);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), dark);
    eye.position.set(side * 0.13, 0.09, 0.68);
    eye.userData.noOutline = true;
    const flipper = new THREE.Group();
    flipper.name = side < 0 ? 'flipL' : 'flipR';
    flipper.position.set(side * 0.27, 0.02, 0.18);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.16), back);
    blade.position.x = side * 0.16;
    flipper.add(blade);
    g.add(cheek, patch, eye, flipper);
  }
  // Füße hinten (paddeln mit)
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.z = -0.52;
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.16), orange);
    foot.position.set(side * 0.08, -0.04, -0.06);
    tail.add(foot);
  }
  g.add(tail);
  return g;
}
