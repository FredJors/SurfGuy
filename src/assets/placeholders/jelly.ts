/**
 * Platzhalter-Riesenqualle: leuchtende Glocke mit Rüschen, Augen und kurzen Nesselfäden.
 * Ursprung = Wasserlinie. Benannt: 'bell' (pulsiert), 'glow' (leuchtet beim Aufladen).
 */
import * as THREE from 'three';
import { toonMaterial } from '../../fx/toon';
import type { PlaceholderParams } from './index';

export function buildJelly(params: PlaceholderParams = {}): THREE.Object3D {
  const colors = (params.colors as { body: string; accent: string; eye: string } | undefined) ?? {
    body: '#ff7ac8',
    accent: '#ffd1ec',
    eye: '#2b1640',
  };
  const root = new THREE.Group();
  const bell = new THREE.Group();
  bell.name = 'bell';
  root.add(bell);

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(2.1, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
    toonMaterial(colors.body, { transparent: true, opacity: 0.88, emissive: colors.body, emissiveIntensity: 0.35 }),
  );
  shell.scale.set(1, 0.85, 1);
  shell.position.y = 0.35;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1.2, 18, 12), new THREE.MeshBasicMaterial({ color: colors.accent }));
  glow.position.y = 0.9;
  glow.scale.set(1, 0.7, 1);
  glow.name = 'glow';
  glow.userData.noOutline = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.22, 8, 30), toonMaterial(colors.accent));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.45;
  bell.add(shell, glow, rim);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const frill = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), toonMaterial(colors.body));
    frill.position.set(Math.cos(a) * 1.95, 0.3, Math.sin(a) * 1.95);
    frill.scale.set(1, 0.7, 1);
    bell.add(frill);
  }
  for (const side of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    eye.position.set(0.6 * side, 1.25, 1.55);
    eye.scale.set(1, 1.2, 0.5);
    eye.userData.noOutline = true;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshBasicMaterial({ color: colors.eye }));
    pupil.position.set(0.6 * side, 1.2, 1.7);
    pupil.scale.set(1, 1.2, 0.5);
    pupil.userData.noOutline = true;
    bell.add(eye, pupil);
  }
  // Kurze Nesselfäden an der Wasserlinie
  const stringMat = toonMaterial(colors.accent);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 1.1, 4, 6), stringMat);
    s.position.set(Math.cos(a) * 1.3, -0.25, Math.sin(a) * 1.3);
    s.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
    root.add(s);
  }
  return root;
}
