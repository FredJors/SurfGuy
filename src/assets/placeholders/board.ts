/** Platzhalter-Surfbrett: Spitze zeigt nach +Z, Oberseite bei y = 0. */
import * as THREE from 'three';
import { toonMaterial } from '../../fx/toon';
import type { PlaceholderParams } from './index';

export function buildBoard(params: PlaceholderParams = {}): THREE.Object3D {
  const colors = (params.colors as { base: string; stripe: string; rail: string } | undefined) ?? {
    base: '#ffd23f',
    stripe: '#ff6b35',
    rail: '#ffffff',
  };
  const length = 2.15;
  const half = length / 2;

  const outline = (scale: number) => {
    const s = new THREE.Shape();
    const w = (z: number) => {
      // Breite entlang der Länge: schmales Heck, breit in der Mitte, spitze Nase
      const t = (z + half) / length;
      return scale * (0.2 + 0.1 * Math.sin(Math.PI * Math.min(1, t * 1.25)) - 0.29 * Math.pow(Math.max(0, t - 0.55) / 0.45, 1.6));
    };
    const n = 40;
    s.moveTo(-w(-half) * 0.9, -half);
    for (let i = 0; i <= n; i++) {
      const z = -half + (i / n) * length;
      s.lineTo(Math.max(0.005, w(z)), z);
    }
    for (let i = n; i >= 0; i--) {
      const z = -half + (i / n) * length;
      s.lineTo(-Math.max(0.005, w(z)), z);
    }
    return s;
  };

  const bodyGeo = new THREE.ExtrudeGeometry(outline(1), {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.03,
    bevelSegments: 5,
    curveSegments: 8,
  });
  // Shape liegt in XY und wird in Z extrudiert → auf die Brettlage drehen
  bodyGeo.rotateX(Math.PI / 2);
  bodyGeo.translate(0, 0.02, 0);
  // Aufgebogene Nase (Rocker)
  const p = bodyGeo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    const rocker = Math.pow(Math.max(0, z - 0.45) / (half - 0.45), 2) * 0.18 + Math.pow(Math.max(0, -z - 0.7) / (half - 0.7), 2) * 0.05;
    p.setY(i, p.getY(i) + rocker);
  }
  bodyGeo.computeVertexNormals();

  const group = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo, toonMaterial(colors.base, { gloss: 1 }));
  group.add(body);
  const rocker = (z: number) => Math.pow(Math.max(0, z - 0.45) / (half - 0.45), 2) * 0.18 + Math.pow(Math.max(0, -z - 0.7) / (half - 0.7), 2) * 0.05;

  // Grip-Pad am Heck mit Rillen
  const padMat = toonMaterial('#2a2d3e', { gloss: 0 });
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.012, 0.34, 1, 1, 1), padMat);
  pad.position.set(0, 0.07 + rocker(-0.78), -0.78);
  pad.userData.noOutline = true;
  group.add(pad);
  for (let i = 0; i < 4; i++) {
    const groove = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.01, 0.018), toonMaterial('#454a66'));
    groove.position.set(0, 0.077 + rocker(-0.68 - i * 0.06), -0.68 - i * 0.06);
    groove.userData.noOutline = true;
    group.add(groove);
  }
  // Heck-Kick (aufgestellte Kante des Pads)
  const kick = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.24, 4, 8), padMat);
  kick.rotation.z = Math.PI / 2;
  kick.position.set(0, 0.092 + rocker(-0.95), -0.95);
  kick.userData.noOutline = true;
  group.add(kick);

  // Zierstreifen oben
  const stripeGeo = new THREE.ShapeGeometry(outline(0.35));
  stripeGeo.rotateX(-Math.PI / 2);
  stripeGeo.rotateY(Math.PI);
  const sp = stripeGeo.getAttribute('position');
  for (let i = 0; i < sp.count; i++) sp.setY(i, 0.049 + rocker(sp.getZ(i)));
  const stripe = new THREE.Mesh(stripeGeo, toonMaterial(colors.stripe));
  stripe.userData.noOutline = true;
  group.add(stripe);

  // Drei Finnen (Thruster): Mitte hinten, zwei seitlich etwas weiter vorn und angewinkelt
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.16, 0);
  finShape.quadraticCurveTo(0.02, -0.05, -0.02, -0.17);
  finShape.lineTo(0, 0);
  const finMat = toonMaterial(colors.rail, { gloss: 0.8 });
  const fins: [number, number, number, number][] = [
    [0, -0.88, 1, 0],
    [0.1, -0.74, 0.8, 0.12],
    [-0.1, -0.74, 0.8, -0.12],
  ];
  for (const [x, z, s, toe] of fins) {
    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 });
    finGeo.rotateY(-Math.PI / 2);
    finGeo.scale(1, s, s);
    const fin = new THREE.Mesh(finGeo, finMat);
    fin.position.set(x + 0.007, -0.04 + rocker(z) * 0.5, z + 0.05);
    fin.rotation.y = toe;
    fin.userData.noOutline = true;
    group.add(fin);
  }
  return group;
}
