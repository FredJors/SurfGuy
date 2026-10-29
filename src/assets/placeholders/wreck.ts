/**
 * Platzhalter: halb versunkenes Schiffswrack. Lokale Achsen: Heck-Kante des Decks im Ursprung,
 * Bug Richtung +Z, Deckoberfläche bei y = 0. Die Spielwelt kippt das Modell so, dass das Deck
 * eine Rampe bildet (Heck unter Wasser, Bug in der Luft).
 */
import * as THREE from 'three';
import { Rng } from '../../core/Rng';
import { toonMaterial } from '../../fx/toon';

let mats: Record<'hullVc' | 'deckVc' | 'hole' | 'iron' | 'mast' | 'sail' | 'gold' | 'barrel' | 'hoop', THREE.Material> | null = null;

function materials() {
  if (mats) return mats;
  mats = {
    hullVc: toonMaterial('#ffffff', { vertexColors: true, side: THREE.DoubleSide, gloss: 0.2 }),
    deckVc: toonMaterial('#ffffff', { vertexColors: true, gloss: 0.15 }),
    hole: new THREE.MeshBasicMaterial({ color: '#1a0d06' }),
    iron: toonMaterial('#2c2f3a', { gloss: 0.8 }),
    mast: toonMaterial('#6b3d1f'),
    sail: toonMaterial('#f1e6cf', { side: THREE.DoubleSide }),
    gold: toonMaterial('#ffd23f', { emissive: '#b8860b', emissiveIntensity: 0.1, gloss: 0.35 }),
    barrel: toonMaterial('#a0682f', { gloss: 0.3 }),
    hoop: toonMaterial('#3a3d48', { gloss: 0.6 }),
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

  // Rumpf: Querschnitte entlang des Schiffs (U-Form), zum Bug spitz und höher, Planken-Streifen
  const hullDepth = 3.2;
  // Der Bug liegt innerhalb der Decklänge D: Am Bug endet die Rampe (dort hebt man ab)
  const bowLen = W * 0.7;
  const straight = D - bowLen;
  const total = D;
  const uSteps = 40;
  const pSteps = 22;
  const halfW = (u: number) =>
    u <= straight ? (W / 2) * (0.88 + 0.12 * Math.min(1, u / (D * 0.3))) : (W / 2) * Math.max(0.12, 1 - Math.pow((u - straight) / bowLen, 1.6));
  const depth = (u: number) => hullDepth * (u <= straight ? 1 : 1 - 0.55 * Math.pow((u - straight) / bowLen, 2));
  const sheer = (u: number) => 0.55 + 0.9 * Math.pow(Math.max(0, (u - D * 0.5) / (D * 0.5)), 2);
  const hullPos: number[] = [];
  const hullCol: number[] = [];
  const cHull = new THREE.Color('#8a4e27');
  const cDark = new THREE.Color('#5a3018');
  const cKeel = new THREE.Color('#3c2010');
  for (let ui = 0; ui <= uSteps; ui++) {
    const u = (ui / uSteps) * total;
    const w = Math.max(0.02, halfW(u));
    const d = depth(u);
    const top = sheer(u);
    for (let pi = 0; pi <= pSteps; pi++) {
      // Profil: Reling links oben → Boden → Reling rechts oben
      const t = pi / pSteps;
      let x: number;
      let y: number;
      if (t < 0.08) {
        x = -w;
        y = top * (1 - t / 0.08);
      } else if (t > 0.92) {
        x = w;
        y = top * ((t - 0.92) / 0.08);
      } else {
        const th = ((t - 0.08) / 0.84) * Math.PI;
        x = -Math.cos(th) * w;
        y = -Math.sin(th) * d;
      }
      hullPos.push(x, y, u);
      const band = Math.floor((y + d + 10) / 0.42) % 2 === 0;
      const c = y < -d * 0.92 ? cKeel : band ? cHull : cDark;
      hullCol.push(c.r, c.g, c.b);
    }
  }
  const hullIdx: number[] = [];
  for (let ui = 0; ui < uSteps; ui++) {
    for (let pi = 0; pi < pSteps; pi++) {
      const a = ui * (pSteps + 1) + pi;
      const b = a + pSteps + 1;
      hullIdx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  // Heckspiegel (flache Rückwand)
  const sternStart = hullPos.length / 3;
  hullPos.push(0, -hullDepth * 0.5, 0);
  hullCol.push(cDark.r, cDark.g, cDark.b);
  for (let pi = 0; pi < pSteps; pi++) hullIdx.push(sternStart, pi + 1, pi);
  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(hullPos, 3));
  hullGeo.setAttribute('color', new THREE.Float32BufferAttribute(hullCol, 3));
  hullGeo.setIndex(hullIdx);
  hullGeo.computeVertexNormals();
  g.add(new THREE.Mesh(hullGeo, m.hullVc));

  // Deck mit Plankenmuster (flach bei y = 0, folgt der Rumpfbreite)
  const deckPos: number[] = [];
  const deckCol: number[] = [];
  const planks = 9;
  const cDeck = new THREE.Color('#d39a62');
  const cDeck2 = new THREE.Color('#b77f4c');
  const cGap = new THREE.Color('#6b4426');
  for (let ui = 0; ui <= uSteps; ui++) {
    const u = (ui / uSteps) * total;
    const w = Math.max(0.01, halfW(u) - 0.18);
    for (let k = 0; k <= planks * 2; k++) {
      const x = -w + (k / (planks * 2)) * 2 * w;
      deckPos.push(x, 0.001, u);
      const pl = Math.floor(k / 2);
      const seam = k % 2 === 0;
      const c = seam ? cGap : (pl + Math.floor(u / 3.5)) % 2 ? cDeck : cDeck2;
      deckCol.push(c.r, c.g, c.b);
    }
  }
  const deckIdx: number[] = [];
  const row = planks * 2 + 1;
  for (let ui = 0; ui < uSteps; ui++) {
    for (let k = 0; k < planks * 2; k++) {
      const a = ui * row + k;
      const b = a + row;
      deckIdx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const deckGeo = new THREE.BufferGeometry();
  deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(deckPos, 3));
  deckGeo.setAttribute('color', new THREE.Float32BufferAttribute(deckCol, 3));
  deckGeo.setIndex(deckIdx);
  deckGeo.computeVertexNormals();
  const deck = new THREE.Mesh(deckGeo, m.deckVc);
  deck.userData.noOutline = true;
  g.add(deck);

  // Lecks und abgerissene Planken an den Seiten
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const u = rng.range(D * 0.15, D * 0.85);
      const hole = add(new THREE.CircleGeometry(rng.range(0.4, 0.8), 7), m.hole, side * (halfW(u) + 0.03), -rng.range(0.8, 2), u, 0, side * Math.PI / 2, rng.range(0, 3));
      hole.scale.set(1, rng.range(0.6, 1.2), 1);
      hole.userData.noOutline = true;
    }
    // Kanonen an der Reling, nach außen gerichtet
    for (let i = 0; i < 2; i++) {
      const u = D * (0.3 + i * 0.28);
      const cannon = add(new THREE.CylinderGeometry(0.16, 0.24, 1.3, 12), m.iron, side * (halfW(u) + 0.15), 0.35, u, 0, 0, side * Math.PI / 2);
      cannon.name = 'cannon';
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

  // Fässer mit Eisenreifen am Rand
  for (let i = 0; i < 3; i++) {
    const x = -W / 2 + 1 + i * 0.95;
    const z = 1.6 + rng.range(-0.3, 0.3);
    add(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 16), m.barrel, x, 0.5, z);
    for (const hy of [0.18, 0.82]) add(new THREE.TorusGeometry(0.43, 0.035, 6, 16), m.hoop, x, hy, z, Math.PI / 2);
  }

  g.name = 'wreck';
  return g;
}
