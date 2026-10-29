/**
 * Platzhalter: riesige wütende Krabbe (Boss). Schaut nach +Z, steht mit den Beinen bei y = 0.
 * Benannte Gelenke für die Animation: 'body', 'clawL', 'clawR' (Arm), 'pincerL'/'pincerR'
 * (beweglicher Scherenteil), 'legL0..2', 'legR0..2', 'eyes'.
 */
import * as THREE from 'three';
import { toonMaterial } from '../../fx/toon';

export function buildCrab(params: { colors?: Record<string, string> } = {}): THREE.Object3D {
  const shellColor = params.colors?.body ?? '#e8452c';
  const accentColor = params.colors?.accent ?? '#ffb36b';
  const shell = toonMaterial(shellColor);
  const accent = toonMaterial(accentColor);
  const dark = toonMaterial('#2a1020');
  const white = toonMaterial('#ffffff');
  const root = new THREE.Group();

  // Körper (Panzer) auf Beinhöhe
  const body = new THREE.Group();
  body.name = 'body';
  body.position.y = 3.2;
  root.add(body);
  const carapace = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), shell);
  carapace.scale.set(4.6, 2.1, 3.6);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), accent);
  belly.scale.set(4.2, 1.4, 3.2);
  belly.position.y = -0.7;
  body.add(carapace, belly);
  // Panzer-Flecken und Zacken am Rand
  for (let i = 0; i < 5; i++) {
    const spot = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), accent);
    spot.scale.set(0.7, 0.25, 0.55);
    spot.position.set(-2.4 + i * 1.2, 2.0 - Math.abs(i - 2) * 0.12, -0.6 + (i % 2) * 0.8);
    body.add(spot);
  }
  for (let i = 0; i < 7; i++) {
    const a = -1.2 + (i / 6) * 2.4;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 6), shell);
    spike.position.set(Math.sin(a) * 4.4, 0.4, Math.cos(a) * 3.2);
    spike.rotation.set(Math.cos(a) * 1.3, 0, -Math.sin(a) * 1.3);
    body.add(spike);
  }

  // Augen auf Stielen mit wütenden Brauen
  const eyes = new THREE.Group();
  eyes.name = 'eyes';
  eyes.position.set(0, 1.4, 2.6);
  body.add(eyes);
  for (const side of [-1, 1]) {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 8), shell);
    stalk.position.set(side * 1.1, 0.8, 0);
    stalk.rotation.z = side * -0.2;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), white);
    eye.position.set(side * 1.28, 1.75, 0.1);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), dark);
    pupil.position.set(side * 1.22, 1.72, 0.62);
    pupil.userData.noOutline = true;
    const brow = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.24, 0.3), dark);
    brow.position.set(side * 1.15, 2.42, 0.35);
    brow.rotation.z = side * 0.45;
    eyes.add(stalk, eye, pupil, brow);
  }
  // Mund (grimmig)
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 0.3), dark);
  mouth.position.set(0, -0.2, 3.45);
  mouth.rotation.x = 0.2;
  body.add(mouth);

  // Scheren: Arm-Gelenk → Unterarm → Schere mit beweglichem Teil
  for (const side of [-1, 1]) {
    const big = side < 0 ? 1.25 : 1;
    const arm = new THREE.Group();
    arm.name = side < 0 ? 'clawL' : 'clawR';
    arm.position.set(side * 3.6, 0.2, 2.2);
    body.add(arm);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 3, 10), shell);
    upper.rotation.set(Math.PI / 2 - 0.5, 0, side * -0.5);
    upper.position.set(side * 0.8, 0.6, 1.2);
    arm.add(upper);
    const hand = new THREE.Group();
    hand.position.set(side * 1.5, 1.4, 2.7);
    arm.add(hand);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), shell);
    palm.scale.set(1.3 * big, 1.1 * big, 1.6 * big);
    const fixedJaw = new THREE.Mesh(new THREE.ConeGeometry(0.75 * big, 2.4 * big, 10), shell);
    fixedJaw.rotation.x = Math.PI / 2;
    fixedJaw.position.set(0, -0.35 * big, 2.0 * big);
    const pincer = new THREE.Group();
    pincer.name = side < 0 ? 'pincerL' : 'pincerR';
    pincer.position.set(0, 0.45 * big, 0.9 * big);
    const movingJaw = new THREE.Mesh(new THREE.ConeGeometry(0.6 * big, 2.2 * big, 10), accent);
    movingJaw.rotation.x = Math.PI / 2;
    movingJaw.position.set(0, 0, 1.1 * big);
    pincer.add(movingJaw);
    hand.add(palm, fixedJaw, pincer);
  }

  // Beine: drei pro Seite, je zwei Glieder
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Group();
      leg.name = `${side < 0 ? 'legL' : 'legR'}${i}`;
      leg.position.set(side * 3.4, -0.4, 1.2 - i * 1.5);
      body.add(leg);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 2.6, 8), shell);
      upper.rotation.z = side * 1.0;
      upper.position.set(side * 1.1, 0.5, 0);
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.32, 3.4, 8), accent);
      lower.rotation.z = side * -0.35;
      lower.position.set(side * 2.6, -1.3, 0);
      leg.add(upper, lower);
    }
  }
  return root;
}
