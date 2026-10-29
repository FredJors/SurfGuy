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
    const n = 20;
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
    bevelSegments: 3,
    curveSegments: 4,
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
  const body = new THREE.Mesh(bodyGeo, toonMaterial(colors.base));
  group.add(body);

  // Zierstreifen oben
  const stripeGeo = new THREE.ShapeGeometry(outline(0.35));
  stripeGeo.rotateX(-Math.PI / 2);
  stripeGeo.rotateY(Math.PI);
  const sp = stripeGeo.getAttribute('position');
  for (let i = 0; i < sp.count; i++) {
    const z = sp.getZ(i);
    const rocker = Math.pow(Math.max(0, z - 0.45) / (half - 0.45), 2) * 0.18 + Math.pow(Math.max(0, -z - 0.7) / (half - 0.7), 2) * 0.05;
    sp.setY(i, 0.049 + rocker);
  }
  const stripe = new THREE.Mesh(stripeGeo, toonMaterial(colors.stripe));
  stripe.userData.noOutline = true;
  group.add(stripe);

  // Finne
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.16, 0);
  finShape.quadraticCurveTo(0.02, -0.05, -0.02, -0.17);
  finShape.lineTo(0, 0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.015, bevelEnabled: false });
  finGeo.rotateY(-Math.PI / 2);
  finGeo.translate(0.0075, -0.05, -0.85);
  const fin = new THREE.Mesh(finGeo, toonMaterial(colors.rail));
  fin.userData.noOutline = true;
  group.add(fin);
  return group;
}
