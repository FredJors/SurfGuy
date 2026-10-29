/**
 * Platzhalter-Surfer im Comic-Look aus Grundformen. Gelenke sind benannte Gruppen
 * (siehe JointId), damit die prozedurale Animation sie über denselben Weg findet
 * wie Knochen eines echten glTF-Modells.
 *
 * Koordinaten: Füße bei y = 0, Figur schaut nach +Z, +X ist ihre linke Seite.
 */
import * as THREE from 'three';
import { toonMaterial } from '../../fx/toon';
import type { PlaceholderParams } from './index';

export interface SurferColors {
  skin: string;
  hair: string;
  shirt: string;
  shorts: string;
}

const DEFAULT_COLORS: SurferColors = { skin: '#f2b58a', hair: '#3b2a1e', shirt: '#ff4f6d', shorts: '#2d6cdf' };

function capsule(radius: number, length: number, mat: THREE.Material, y: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), mat);
  m.position.y = y;
  return m;
}

function joint(name: string, x: number, y: number, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  return g;
}

export function buildSurferFigure(params: PlaceholderParams = {}): THREE.Object3D {
  const colors = { ...DEFAULT_COLORS, ...((params.colors as Partial<SurferColors>) ?? {}) };
  const skin = toonMaterial(colors.skin);
  const hair = toonMaterial(colors.hair);
  const shirt = toonMaterial(colors.shirt);
  const shorts = toonMaterial(colors.shorts);
  const dark = new THREE.MeshBasicMaterial({ color: '#1b1b2f' });
  const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });

  const root = new THREE.Group();
  root.name = 'surferRoot';

  const hips = joint('hips', 0, 0.9);
  root.add(hips);
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), shorts);
  pelvis.scale.set(1.25, 0.85, 0.95);
  hips.add(pelvis);

  const spine = joint('spine', 0, 0.06);
  hips.add(spine);
  const torso = capsule(0.19, 0.24, shirt, 0.24);
  torso.scale.set(1.18, 1, 0.88);
  spine.add(torso);
  // Shirt-Detail: Streifen auf der Brust
  const badge = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), white);
  badge.position.set(0.07, 0.3, 0.165);
  badge.scale.set(1, 1, 0.35);
  badge.userData.noOutline = true;
  spine.add(badge);

  const head = joint('head', 0, 0.48);
  spine.add(head);
  head.add(capsule(0.06, 0.06, skin, 0.03));
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.23, 18, 14), skin);
  skull.position.y = 0.22;
  skull.scale.set(1, 1.03, 0.98);
  head.add(skull);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.245, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairCap.position.set(0, 0.24, -0.02);
  hairCap.rotation.x = -0.25;
  head.add(hairCap);
  const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 8), hair);
  tuft.position.set(0.05, 0.45, 0.06);
  tuft.rotation.set(0.6, 0, -0.4);
  head.add(tuft);
  for (const side of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), white);
    eye.position.set(0.085 * side, 0.24, 0.195);
    eye.scale.set(1, 1.25, 0.6);
    eye.userData.noOutline = true;
    head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), dark);
    pupil.position.set(0.085 * side, 0.235, 0.222);
    pupil.userData.noOutline = true;
    head.add(pupil);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), skin);
    ear.position.set(0.225 * side, 0.21, 0);
    ear.scale.set(0.6, 1, 0.8);
    head.add(ear);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), skin);
  nose.position.set(0, 0.19, 0.225);
  head.add(nose);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 12, Math.PI), dark);
  mouth.position.set(0, 0.13, 0.205);
  mouth.rotation.set(0.1, 0, Math.PI);
  mouth.userData.noOutline = true;
  head.add(mouth);

  for (const [side, s] of [['L', 1], ['R', -1]] as const) {
    const arm = joint(`arm${side}`, 0.25 * s, 0.4);
    spine.add(arm);
    const sleeve = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), shirt);
    sleeve.position.y = -0.03;
    arm.add(sleeve);
    arm.add(capsule(0.06, 0.18, skin, -0.15));
    const fore = joint(`forearm${side}`, 0, -0.29);
    arm.add(fore);
    fore.add(capsule(0.055, 0.17, skin, -0.12));
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), skin);
    hand.position.y = -0.28;
    fore.add(hand);

    const leg = joint(`leg${side}`, 0.1 * s, -0.05);
    hips.add(leg);
    leg.add(capsule(0.095, 0.24, shorts, -0.18));
    const shin = joint(`shin${side}`, 0, -0.41);
    leg.add(shin);
    shin.add(capsule(0.075, 0.26, skin, -0.2));
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.12, 4, 8), skin);
    foot.rotation.x = Math.PI / 2;
    foot.position.set(0, -0.42, 0.05);
    shin.add(foot);
  }
  return root;
}
