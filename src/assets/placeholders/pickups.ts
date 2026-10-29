/** Platzhalter für Einsammel-Objekte: Schatzkiste, Power-up-Blase. */
import * as THREE from 'three';
import { toonMaterial } from '../../fx/toon';

/** Schatzkiste mit Goldbeschlägen, Deckel einen Spalt offen, Gold glitzert heraus. */
export function buildChest(): THREE.Object3D {
  const g = new THREE.Group();
  const wood = toonMaterial('#a8642e');
  const darkWood = toonMaterial('#7a4520');
  const gold = toonMaterial('#ffd23f', { emissive: '#b8860b', emissiveIntensity: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.1), wood);
  body.position.y = 0.45;
  const lidGroup = new THREE.Group();
  lidGroup.position.set(0, 0.9, -0.55);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.6, 12, 1, false, 0, Math.PI), darkWood);
  lid.rotation.z = Math.PI / 2;
  lid.position.z = 0.55;
  lidGroup.add(lid);
  lidGroup.rotation.x = -0.35;
  // Beschläge
  for (const x of [-0.62, 0.62]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.94, 1.14), gold);
    band.position.set(x, 0.45, 0);
    g.add(band);
  }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.12), gold);
  lock.position.set(0, 0.72, 0.58);
  // Goldmünzen, die herausschauen
  const coins = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), gold);
  coins.scale.set(1.2, 0.45, 0.8);
  coins.position.y = 0.88;
  g.add(body, lidGroup, lock, coins);
  g.name = 'chest';
  return g;
}

/** Power-up: schimmernde Blase mit farbigem Kern und Ring. */
export function buildPowerup(params: { colors?: Record<string, string> } = {}): THREE.Object3D {
  const color = params.colors?.core ?? '#3fe0ff';
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), toonMaterial(color, { emissive: color, emissiveIntensity: 1.2 }));
  core.name = 'core';
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.09, 8, 28), toonMaterial('#ffffff', { emissive: color, emissiveIntensity: 0.4 }));
  ring.rotation.x = Math.PI / 2;
  ring.name = 'ring';
  ring.userData.noOutline = true;
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 20, 14),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  shell.userData.noOutline = true;
  g.add(core, ring, shell);
  return g;
}
