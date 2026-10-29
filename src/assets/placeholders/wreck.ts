/**
 * Platzhalter: halb versunkenes Schiffswrack. Lokale Achsen: Heck-Kante des Decks im Ursprung,
 * Bug Richtung +Z, Deckoberfläche bei y = 0. Die Spielwelt kippt das Modell so, dass das Deck
 * eine Rampe bildet (Heck unter Wasser, Bug in der Luft).
 */
import * as THREE from 'three';
import { Rng } from '../../core/Rng';
import { toonMaterial } from '../../fx/toon';

let mats: Record<'hull' | 'hullDark' | 'deck' | 'plank' | 'mast' | 'sail' | 'gold' | 'barrel', THREE.Material> | null = null;

function materials() {
  if (mats) return mats;
  mats = {
    hull: toonMaterial('#7a4422'),
    hullDark: toonMaterial('#4a2814'),
    deck: toonMaterial('#c8925a'),
    plank: toonMaterial('#9c6a3c'),
    mast: toonMaterial('#6b3d1f'),
    sail: toonMaterial('#f1e6cf', { side: THREE.DoubleSide }),
    gold: toonMaterial('#ffd23f', { emissive: '#b8860b', emissiveIntensity: 0.3 }),
    barrel: toonMaterial('#a0682f'),
  };
  return mats;
}

export function buildWreck(params: { length?: number; width?: number; seed?: number } = {}): THREE.Object3D {
  const D = params.length ?? 24;
  const W = params.width ?? 7;
  const rng = new Rng(params.seed ?? 1);
  const m = materials();
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    g.add(mesh);
    return mesh;
  };

  // Rumpf unter dem Deck, Bug als Keil
  const hullDepth = 3.2;
  add(new THREE.BoxGeometry(W, hullDepth, D), m.hull, 0, -hullDepth / 2 - 0.05, D / 2);
  const bow = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, W * 0.85)]);
  const bowGeo = new THREE.ExtrudeGeometry(bow, { depth: hullDepth, bevelEnabled: false });
  bowGeo.rotateX(Math.PI / 2);
  add(bowGeo, m.hull, 0, -0.05, D);
  // Dunkle Planken-Streifen und Löcher an den Seiten
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(0.12, 0.35, D * 0.96), m.hullDark, side * (W / 2 + 0.02), -1.1, D / 2);
    add(new THREE.BoxGeometry(0.12, 0.35, D * 0.96), m.hullDark, side * (W / 2 + 0.02), -2.2, D / 2);
    for (let i = 0; i < 2; i++) {
      add(new THREE.BoxGeometry(0.14, rng.range(0.7, 1.2), rng.range(1, 1.8)), m.hullDark, side * (W / 2 + 0.03), -1.6, rng.range(D * 0.2, D * 0.8));
    }
  }

  // Deck mit Planken
  add(new THREE.BoxGeometry(W - 0.3, 0.2, D), m.deck, 0, -0.1, D / 2);
  for (let i = 1; i < 5; i++) add(new THREE.BoxGeometry(0.08, 0.04, D * 0.98), m.plank, -W / 2 + (i * W) / 5, 0.01, D / 2);

  // Reling (an manchen Stellen abgebrochen)
  for (const side of [-1, 1]) {
    let z = 0.5;
    while (z < D - 1) {
      const len = rng.range(2.5, 5);
      if (rng.chance(0.75)) add(new THREE.BoxGeometry(0.22, 0.55, Math.min(len, D - 1 - z)), m.hull, side * (W / 2 - 0.1), 0.27, z + len / 2);
      z += len + rng.range(0.5, 1.5);
    }
  }

  // Abgebrochener Maststumpf am Rand, nach außen gekippt; das Segel hängt außenbords
  // (nichts davon ragt über das Deck – freie Sicht beim Hochfahren)
  const side = rng.chance(0.5) ? 1 : -1;
  const mastX = side * (W / 2 - 0.45);
  const mastZ = D * rng.range(0.35, 0.55);
  const lean = 0.65;
  const mastH = 5;
  const mast = add(new THREE.CylinderGeometry(0.26, 0.34, mastH, 8), m.mast, mastX + side * Math.sin(lean) * mastH * 0.5, Math.cos(lean) * mastH * 0.5, mastZ, 0, 0, -side * lean);
  mast.name = 'mast';
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.8, 3, 2), m.sail);
  const pos = sail.geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 1.6) * 0.3 + (pos.getY(i) < 0 ? rng.range(-0.3, 0.3) : 0));
  sail.geometry.computeVertexNormals();
  sail.position.set(mastX + side * (Math.sin(lean) * mastH + 0.2), Math.cos(lean) * mastH - 1.5, mastZ + 0.3);
  sail.rotation.set(0.1, Math.PI / 2, side * 0.25);
  sail.userData.noOutline = true;
  g.add(sail);

  // Fässer und eine kleine Goldtruhe am Heck
  for (let i = 0; i < 3; i++) {
    add(new THREE.CylinderGeometry(0.45, 0.45, 1.0, 10), m.barrel, -W / 2 + 1 + i * 0.95, 0.5, 1.6 + rng.range(-0.3, 0.3));
  }
  add(new THREE.BoxGeometry(1.1, 0.7, 0.8), m.gold, W / 2 - 1.2, 0.35, 2.2);

  g.name = 'wreck';
  return g;
}
