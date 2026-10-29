/**
 * Platzhalter-Kopf des Kraken (Mantel mit großen Augen). Die Tentakel werden
 * prozedural als Kugelketten erzeugt (monsters/Tentacles.ts).
 * Ursprung = Wasserlinie, Kopf schaut nach +Z.
 */
import * as THREE from 'three';
import { mergeStatic } from '../../fx/merge';
import { toonMaterial } from '../../fx/toon';
import type { PlaceholderParams } from './index';

export function buildKrakenHead(params: PlaceholderParams = {}): THREE.Object3D {
  const colors = (params.colors as { body: string; accent: string; eye: string } | undefined) ?? {
    body: '#a54bd8',
    accent: '#ff8ad8',
    eye: '#fff36b',
  };
  const body = toonMaterial(colors.body);
  const accent = toonMaterial(colors.accent);
  const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const pupilMat = new THREE.MeshBasicMaterial({ color: '#15121f' });
  const irisMat = toonMaterial(colors.eye, { emissive: colors.eye, emissiveIntensity: 0.4 });

  const root = new THREE.Group();
  const mantleGeo = new THREE.SphereGeometry(2.4, 28, 20);
  const p = mantleGeo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    // nach oben spitz zulaufender Mantel
    const k = y > 0 ? 1 + (y / 2.4) * 0.55 : 1;
    p.setY(i, y * k);
    const taper = y > 0 ? 1 - (y / 2.4) * 0.18 : 1;
    p.setX(i, p.getX(i) * taper);
    p.setZ(i, p.getZ(i) * taper);
  }
  mantleGeo.computeVertexNormals();
  const mantle = new THREE.Mesh(mantleGeo, body);
  mantle.position.y = 1.7;
  mantle.name = 'mantle';
  root.add(mantle);

  // Flecken
  const spotGeo = new THREE.SphereGeometry(0.32, 10, 8);
  const spots: [number, number, number, number][] = [
    [1.4, 3.6, -1.0, 1],
    [-1.2, 4.0, -1.2, 0.8],
    [0.3, 4.8, -0.9, 0.7],
    [-1.8, 2.6, -0.8, 0.9],
    [1.9, 2.4, -0.6, 0.75],
    [0.9, 5.3, 0.2, 0.6],
  ];
  for (const [x, y, z, s] of spots) {
    const spot = new THREE.Mesh(spotGeo, accent);
    spot.position.set(x, y, z);
    spot.scale.set(s, s, s * 0.45);
    spot.lookAt(0, y - 0.5, 0);
    spot.userData.noOutline = true;
    root.add(spot);
  }

  for (const side of [1, -1]) {
    const eye = new THREE.Group();
    eye.position.set(0.95 * side, 2.55, 1.85);
    eye.name = side > 0 ? 'eyeL' : 'eyeR';
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), white);
    ball.scale.set(1, 1.1, 0.75);
    eye.add(ball);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), irisMat);
    iris.position.set(0, -0.02, 0.32);
    iris.scale.set(1, 1, 0.5);
    iris.userData.noOutline = true;
    eye.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), pupilMat);
    pupil.position.set(0, -0.02, 0.45);
    pupil.scale.set(0.55, 1.2, 0.4);
    pupil.userData.noOutline = true;
    eye.add(pupil);
    // böse Augenbraue
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.7, 4, 8), body);
    brow.position.set(-0.05 * side, 0.62, 0.25);
    brow.rotation.z = Math.PI / 2 + 0.38 * side;
    eye.add(brow);
    root.add(eye);
  }
  return mergeStatic(root);
}
