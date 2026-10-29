/** Platzhalter für Einsammel-Objekte: Schatzkiste, Power-up-Blase. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toonMaterial } from '../../fx/toon';

/** Schatzkiste: abgerundeter Holzkasten mit Planken, gewölbter Deckel, Goldbeschläge, Schloss und Edelstein. */
export function buildChest(): THREE.Object3D {
  const g = new THREE.Group();
  const wood = toonMaterial('#b06a32', { gloss: 0.2 });
  const woodDark = toonMaterial('#7a4520', { gloss: 0.15 });
  const gold = toonMaterial('#ffd23f', { emissive: '#b8860b', emissiveIntensity: 0.1, gloss: 0.35 });
  const gem = toonMaterial('#ff4f8b', { emissive: '#ff4f8b', emissiveIntensity: 0.5, gloss: 0.6 });
  // Kasten
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.9, 1.1, 4, 0.08), wood);
  body.position.y = 0.45;
  g.add(body);
  // Plankenfugen
  for (let i = 1; i < 3; i++) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.025, 1.12), woodDark);
    seam.position.y = i * 0.3;
    seam.userData.noOutline = true;
    g.add(seam);
  }
  // Gewölbter Deckel, leicht geöffnet
  const lidGroup = new THREE.Group();
  lidGroup.position.set(0, 0.9, -0.55);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.6, 24, 1, false, 0, Math.PI), wood);
  lid.rotation.z = Math.PI / 2;
  lid.position.z = 0.55;
  lidGroup.add(lid);
  for (const x of [-0.62, 0.62]) {
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 8, 24, Math.PI), gold);
    strap.rotation.y = Math.PI / 2;
    strap.position.set(x, 0, 0.55);
    lidGroup.add(strap);
  }
  lidGroup.rotation.x = -0.38;
  g.add(lidGroup);
  // Eckbeschläge und Bänder
  for (const x of [-0.62, 0.62]) {
    const band = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.94, 1.15, 2, 0.04), gold);
    band.position.set(x, 0.45, 0);
    g.add(band);
  }
  for (const x of [-0.8, 0.8]) {
    for (const z of [-0.55, 0.55]) {
      const stud = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), gold);
      stud.position.set(x, 0.85, z);
      g.add(stud);
    }
  }
  // Schloss mit Edelstein
  const lock = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.36, 0.12, 2, 0.04), gold);
  lock.position.set(0, 0.72, 0.6);
  const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), gem);
  jewel.position.set(0, 0.74, 0.68);
  jewel.scale.set(1, 1.3, 0.6);
  // Gold, das herausquillt
  const coins = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold);
  coins.scale.set(1.2, 0.5, 0.8);
  coins.position.y = 0.88;
  for (let i = 0; i < 6; i++) {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.025, 14), gold);
    coin.position.set(-0.5 + i * 0.2, 1.05 + (i % 2) * 0.06, -0.1 + (i % 3) * 0.08);
    coin.rotation.set(0.6 * (i % 2 ? 1 : -1), 0, 0.3 * i);
    g.add(coin);
  }
  g.add(lock, jewel, coins);
  g.name = 'chest';
  return g;
}

/** Power-up: schimmernde Blase mit farbigem Kern und Ring. */
export function buildPowerup(params: { colors?: Record<string, string> } = {}): THREE.Object3D {
  const color = params.colors?.core ?? '#3fe0ff';
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), toonMaterial(color, { emissive: color, emissiveIntensity: 0.6 }));
  core.name = 'core';
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.09, 8, 28), toonMaterial('#ffffff', { emissive: color, emissiveIntensity: 0.2 }));
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
