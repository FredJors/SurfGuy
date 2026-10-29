/**
 * Platzhalter-Surfer im Comic-Look, aus fein unterteilten, runden Formen gebaut:
 * großer Kopf mit Comic-Augen, Haarsträhnen, T-Shirt mit Ärmeln und Print, Boardshorts,
 * Hände mit Daumen, nackte Füße. Gelenke sind benannte Gruppen (siehe JointId), damit die
 * prozedurale Animation sie über denselben Weg findet wie Knochen eines echten glTF-Modells.
 *
 * Koordinaten: Füße bei y = 0, Figur schaut nach +Z, +X ist ihre linke Seite.
 * Die Gelenkpositionen sind auf die Posen in data/poses.ts abgestimmt – beim Umbauen beibehalten.
 */
import * as THREE from 'three';
import { mergeChildMeshes } from '../../fx/merge';
import { toonMaterial } from '../../fx/toon';
import type { PlaceholderParams } from './index';

export interface SurferColors {
  skin: string;
  hair: string;
  shirt: string;
  shorts: string;
}

const DEFAULT_COLORS: SurferColors = { skin: '#f2b58a', hair: '#3b2a1e', shirt: '#ff4f6d', shorts: '#2d6cdf' };

function shade(color: string, k: number): THREE.Color {
  return new THREE.Color(color).multiplyScalar(k);
}

function joint(name: string, x: number, y: number, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  return g;
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Konische Kapsel (oben Radius r0, unten r1) entlang -Y, Länge len, oben bei y = 0. */
function limb(r0: number, r1: number, len: number, mat: THREE.Material, radial = 14): THREE.Mesh {
  const steps = 6;
  const pts: THREE.Vector2[] = [];
  // Unten: Viertelkreis von der Spitze bis zur Flanke, dann oben zurück zur Mitte
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.sin(a) * r1, -len + r1 - Math.cos(a) * r1));
  }
  for (let i = 0; i <= steps; i++) {
    const b = (i / steps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(b) * r0, -r0 + Math.sin(b) * r0));
  }
  return new THREE.Mesh(new THREE.LatheGeometry(pts, radial), mat);
}

/** Körper aus einem Profil (Radius über Höhe), danach in X/Z skaliert. */
function lathe(profile: [number, number][], mat: THREE.Material, sx: number, sz: number, radial = 28): THREE.Mesh {
  const geo = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    radial,
  );
  geo.scale(sx, 1, sz);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

export function buildSurferFigure(params: PlaceholderParams = {}): THREE.Object3D {
  const colors = { ...DEFAULT_COLORS, ...((params.colors as Partial<SurferColors>) ?? {}) };
  const skin = toonMaterial(colors.skin, { gloss: 0.25 });
  const skinDark = toonMaterial(shade(colors.skin, 0.78), { gloss: 0.1 });
  const hair = toonMaterial(colors.hair, { gloss: 0.7, rim: 0.4 });
  const shirt = toonMaterial(colors.shirt, { gloss: 0.15 });
  const shirtDark = toonMaterial(shade(colors.shirt, 0.72), { gloss: 0.1 });
  const shorts = toonMaterial(colors.shorts, { gloss: 0.2 });
  const shortsDark = toonMaterial(shade(colors.shorts, 0.7), { gloss: 0.1 });
  const accent = toonMaterial('#ffffff', { gloss: 0.3 });
  const eyeWhite = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const iris = new THREE.MeshBasicMaterial({ color: '#4a2c17' });
  const pupil = new THREE.MeshBasicMaterial({ color: '#120a12' });
  const lip = toonMaterial('#7a2a2a');

  const root = new THREE.Group();
  root.name = 'surferRoot';

  // --- Becken / Boardshorts ---------------------------------------------------
  const hips = joint('hips', 0, 0.9);
  root.add(hips);
  const pelvis = lathe(
    [
      [0.0, -0.14],
      [0.1, -0.135],
      [0.165, -0.1],
      [0.185, -0.02],
      [0.18, 0.08],
      [0.17, 0.12],
      [0.0, 0.125],
    ],
    shorts,
    1.12,
    0.8,
  );
  hips.add(pelvis);
  const waistband = mesh(new THREE.TorusGeometry(0.172, 0.022, 8, 32), shortsDark, 0, 0.1, 0);
  waistband.rotation.x = Math.PI / 2;
  waistband.scale.set(1.12, 0.8, 1);
  hips.add(waistband);
  // Kordel
  for (const side of [-1, 1]) {
    const cord = mesh(new THREE.CapsuleGeometry(0.008, 0.06, 3, 6), accent, side * 0.022, 0.05, 0.142);
    cord.rotation.z = side * 0.25;
    cord.userData.noOutline = true;
    hips.add(cord);
  }

  // --- Oberkörper mit T-Shirt -------------------------------------------------
  const spine = joint('spine', 0, 0.06);
  hips.add(spine);
  const torso = lathe(
    [
      [0.0, -0.02],
      [0.165, -0.02],
      [0.17, 0.08],
      [0.185, 0.2],
      [0.195, 0.3],
      [0.18, 0.37],
      [0.13, 0.42],
      [0.07, 0.445],
      [0.0, 0.45],
    ],
    shirt,
    1.18,
    0.74,
  );
  spine.add(torso);
  const hem = mesh(new THREE.TorusGeometry(0.168, 0.016, 8, 32), shirtDark, 0, 0.0, 0);
  hem.rotation.x = Math.PI / 2;
  hem.scale.set(1.18, 0.74, 1);
  spine.add(hem);
  const collar = mesh(new THREE.TorusGeometry(0.066, 0.016, 8, 24), shirtDark, 0, 0.432, 0.004);
  collar.rotation.x = Math.PI / 2 - 0.15;
  spine.add(collar);
  // Brust-Print: Kreis mit Welle
  const badge = mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.012, 24), accent, 0.06, 0.25, 0.138);
  badge.rotation.x = Math.PI / 2 - 0.08;
  badge.userData.noOutline = true;
  spine.add(badge);
  const wave = mesh(new THREE.TorusGeometry(0.03, 0.009, 6, 16, Math.PI), shirtDark, 0.06, 0.245, 0.146);
  wave.rotation.z = Math.PI;
  wave.userData.noOutline = true;
  spine.add(wave);
  // Hawaii-Hemd: Blüten rundum (statt Print)
  if (params.pattern === 'hawaii') {
    badge.visible = wave.visible = false;
    const petals = [toonMaterial('#ffffff'), toonMaterial('#ffe066'), toonMaterial('#ff9ad5')];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + (i % 2) * 0.3;
      const y = 0.06 + ((i * 7) % 5) * 0.075;
      const flower = mesh(new THREE.SphereGeometry(0.03, 8, 6), petals[i % 3]!, Math.sin(a) * 0.205, y, Math.cos(a) * 0.152);
      flower.scale.set(1, 1, 0.4);
      flower.lookAt(Math.sin(a) * 2, y, Math.cos(a) * 2);
      flower.userData.noOutline = true;
      spine.add(flower);
    }
  }

  // --- Kopf -------------------------------------------------------------------
  const head = joint('head', 0, 0.48);
  spine.add(head);
  head.add(mesh(new THREE.CylinderGeometry(0.052, 0.06, 0.12, 14), skin, 0, 0.0, 0));
  const skull = mesh(new THREE.SphereGeometry(0.24, 32, 24), skin, 0, 0.24, 0);
  skull.scale.set(1, 1.04, 0.98);
  head.add(skull);
  const jaw = mesh(new THREE.SphereGeometry(0.19, 24, 16), skin, 0, 0.165, 0.035);
  jaw.scale.set(0.98, 0.82, 0.95);
  head.add(jaw);
  // Ohren
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.055, 14, 10), skin, side * 0.232, 0.22, -0.01);
    ear.scale.set(0.42, 1, 0.75);
    const inner = mesh(new THREE.SphereGeometry(0.03, 10, 8), skinDark, side * 0.245, 0.22, 0.0);
    inner.scale.set(0.3, 0.9, 0.6);
    inner.userData.noOutline = true;
    head.add(ear, inner);
  }
  // Augen: Weiß, Iris, Pupille, Glanzlicht
  for (const side of [-1, 1]) {
    const x = side * 0.085;
    const white = mesh(new THREE.SphereGeometry(0.06, 20, 14), eyeWhite, x, 0.255, 0.198);
    white.scale.set(0.82, 1.1, 0.5);
    const ir = mesh(new THREE.SphereGeometry(0.036, 16, 12), iris, x, 0.25, 0.222);
    ir.scale.set(1, 1.15, 0.45);
    const pu = mesh(new THREE.SphereGeometry(0.02, 12, 8), pupil, x, 0.25, 0.232);
    pu.scale.set(1, 1.15, 0.45);
    const shine = mesh(new THREE.SphereGeometry(0.01, 8, 6), eyeWhite, x + 0.012, 0.265, 0.24);
    for (const m of [white, ir, pu, shine]) m.userData.noOutline = true;
    head.add(white, ir, pu, shine);
    // Augenbraue
    const brow = mesh(new THREE.CapsuleGeometry(0.013, 0.055, 4, 8), toonMaterial(shade(colors.hair, 0.8)), x, 0.335, 0.215);
    brow.rotation.set(0.25, 0, Math.PI / 2 + side * 0.12);
    brow.userData.noOutline = true;
    head.add(brow);
  }
  const nose = mesh(new THREE.SphereGeometry(0.03, 14, 10), skin, 0, 0.205, 0.235);
  nose.scale.set(0.95, 0.85, 1.15);
  head.add(nose);
  // Lächeln
  const smile = new THREE.TubeGeometry(
    new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.055, 0.15, 0.205), new THREE.Vector3(0, 0.118, 0.225), new THREE.Vector3(0.055, 0.15, 0.205)),
    12,
    0.009,
    6,
  );
  const mouth = mesh(smile, lip);
  mouth.userData.noOutline = true;
  head.add(mouth);
  // Haare: Grundkappe + weiche Strähnen-Bündel (gestauchte Kugeln), Pony nach vorn
  const cap = mesh(new THREE.SphereGeometry(0.252, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.56), hair, 0, 0.245, -0.018);
  cap.rotation.x = -0.28;
  head.add(cap);
  const clumps: [number, number, number, number, number, number, number, number, number][] = [
    // x, y, z, rotX, rotY, rotZ, Größe x, y, z
    [0.0, 0.44, 0.02, 0.5, 0, 0, 0.13, 0.085, 0.17],
    [0.11, 0.42, 0.0, 0.4, 0.3, -0.5, 0.11, 0.075, 0.15],
    [-0.11, 0.42, 0.0, 0.4, -0.3, 0.5, 0.11, 0.075, 0.15],
    [0.07, 0.43, -0.12, -0.5, 0.2, -0.3, 0.12, 0.08, 0.15],
    [-0.07, 0.43, -0.12, -0.5, -0.2, 0.3, 0.12, 0.08, 0.15],
    [0.0, 0.36, -0.2, -1.0, 0, 0, 0.13, 0.08, 0.13],
    [0.17, 0.34, -0.1, -0.5, 0.5, -0.9, 0.08, 0.06, 0.12],
    [-0.17, 0.34, -0.1, -0.5, -0.5, 0.9, 0.08, 0.06, 0.12],
    // Pony: nach vorn gestrichen, leicht seitlich
    [0.06, 0.4, 0.15, 1.1, 0.3, -0.3, 0.08, 0.05, 0.12],
    [-0.04, 0.41, 0.16, 1.15, -0.2, 0.25, 0.085, 0.05, 0.12],
    [0.14, 0.37, 0.12, 0.9, 0.6, -0.8, 0.06, 0.045, 0.1],
  ];
  for (const [x, y, z, rx, ry, rz, sx, sy, sz] of clumps) {
    const c = mesh(new THREE.SphereGeometry(1, 18, 12), hair, x, y, z);
    c.rotation.set(rx, ry, rz);
    c.scale.set(sx, sy, sz);
    head.add(c);
  }
  // Koteletten
  for (const side of [-1, 1]) {
    const burn = mesh(new THREE.SphereGeometry(1, 12, 8), hair, side * 0.21, 0.3, 0.04);
    burn.scale.set(0.03, 0.07, 0.05);
    head.add(burn);
  }

  // --- Arme -------------------------------------------------------------------
  for (const [side, s] of [['L', 1], ['R', -1]] as const) {
    const arm = joint(`arm${side}`, 0.25 * s, 0.4);
    spine.add(arm);
    // Schulter + Ärmel
    const shoulder = mesh(new THREE.SphereGeometry(0.088, 18, 12), shirt, 0, -0.01, 0);
    arm.add(shoulder);
    const sleeve = limb(0.086, 0.078, 0.15, shirt);
    sleeve.position.y = -0.01;
    arm.add(sleeve);
    const cuff = mesh(new THREE.TorusGeometry(0.076, 0.012, 8, 20), shirtDark, 0, -0.155, 0);
    cuff.rotation.x = Math.PI / 2;
    arm.add(cuff);
    const upper = limb(0.058, 0.052, 0.26, skin);
    upper.position.y = -0.04;
    arm.add(upper);

    const fore = joint(`forearm${side}`, 0, -0.29);
    arm.add(fore);
    const forearm = limb(0.052, 0.042, 0.2, skin);
    fore.add(forearm);
    // Hand: Handfläche, Finger als Fäustling, Daumen
    const palm = mesh(new THREE.SphereGeometry(0.05, 16, 12), skin, 0, -0.245, 0);
    palm.scale.set(0.75, 1.0, 1.05);
    fore.add(palm);
    const fingers = mesh(new THREE.CapsuleGeometry(0.034, 0.05, 6, 12), skin, 0, -0.3, 0.008);
    fingers.scale.set(0.85, 1, 1.25);
    fore.add(fingers);
    const thumb = mesh(new THREE.CapsuleGeometry(0.016, 0.04, 4, 8), skin, -0.0 * s, -0.25, 0.05);
    thumb.rotation.set(0.7, 0, s * 0.3);
    fore.add(thumb);
  }

  // --- Beine ------------------------------------------------------------------
  for (const [side, s] of [['L', 1], ['R', -1]] as const) {
    const leg = joint(`leg${side}`, 0.1 * s, -0.05);
    hips.add(leg);
    // Hosenbein (weit, bis übers Knie) mit Saum und Seitenstreifen
    const pant = limb(0.118, 0.112, 0.33, shorts);
    pant.position.y = 0.03;
    leg.add(pant);
    const pantHem = mesh(new THREE.TorusGeometry(0.108, 0.014, 8, 24), shortsDark, 0, -0.31, 0);
    pantHem.rotation.x = Math.PI / 2;
    leg.add(pantHem);
    const stripe = mesh(new THREE.BoxGeometry(0.012, 0.3, 0.05), accent, s * 0.116, -0.14, 0);
    stripe.userData.noOutline = true;
    leg.add(stripe);
    const thigh = limb(0.075, 0.068, 0.36, skin);
    thigh.position.y = -0.02;
    leg.add(thigh);

    const shin = joint(`shin${side}`, 0, -0.41);
    leg.add(shin);
    const knee = mesh(new THREE.SphereGeometry(0.068, 14, 10), skin, 0, 0.0, 0.01);
    shin.add(knee);
    const calf = limb(0.066, 0.045, 0.34, skin);
    shin.add(calf);
    // Fuß: Ferse, Fußrücken, Zehenpartie
    const heel = mesh(new THREE.SphereGeometry(0.045, 14, 10), skin, 0, -0.395, -0.02);
    shin.add(heel);
    const foot = mesh(new THREE.CapsuleGeometry(0.042, 0.12, 6, 12), skin, 0, -0.405, 0.06);
    foot.rotation.x = Math.PI / 2;
    foot.scale.set(1.15, 1, 0.8);
    shin.add(foot);
    for (let t = 0; t < 4; t++) {
      const toe = mesh(new THREE.SphereGeometry(0.015 - t * 0.0015, 8, 6), skin, s * (0.03 - t * 0.018), -0.42, 0.145 - Math.abs(t - 1) * 0.006);
      toe.userData.noOutline = true;
      shin.add(toe);
    }
  }
  addAccessories(head, (params.accessories as readonly string[] | undefined) ?? [], colors);

  // Teile pro Gelenk zusammenfassen (weniger Draw-Calls, Gelenke bleiben beweglich)
  mergeChildMeshes(root);
  return root;
}

/** Zubehör am Kopf (Skins): Cap, Sonnenbrille, Bandana, Stirnband, Blüte, Strohhut, Blumenkette. */
function addAccessories(head: THREE.Object3D, list: readonly string[], colors: SurferColors): void {
  for (const item of list) {
    switch (item) {
      case 'cap': {
        const mat = toonMaterial(colors.shorts, { gloss: 0.3 });
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.262, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), mat);
        crown.position.set(0, 0.285, -0.01);
        crown.scale.set(1, 0.82, 1.02);
        const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.025, 24, 1, false, -Math.PI / 2, Math.PI), mat);
        visor.position.set(0, 0.3, 0.18);
        visor.scale.set(1.15, 1, 1.25);
        visor.rotation.x = 0.12;
        const button = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), toonMaterial('#ffffff'));
        button.position.set(0, 0.5, -0.01);
        head.add(crown, visor, button);
        break;
      }
      case 'sunglasses': {
        const mat = new THREE.MeshBasicMaterial({ color: '#15151f' });
        const glint = new THREE.MeshBasicMaterial({ color: '#7fd8ff' });
        for (const side of [1, -1]) {
          const lens = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10), mat);
          lens.position.set(0.088 * side, 0.255, 0.222);
          lens.scale.set(1.15, 0.8, 0.35);
          lens.userData.noOutline = true;
          const shine = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), glint);
          shine.position.set(0.088 * side + 0.025, 0.272, 0.245);
          shine.scale.set(1.4, 0.6, 0.3);
          shine.userData.noOutline = true;
          head.add(lens, shine);
        }
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.015), mat);
        bridge.position.set(0, 0.265, 0.235);
        bridge.userData.noOutline = true;
        head.add(bridge);
        break;
      }
      case 'bandana': {
        const mat = toonMaterial('#d62828');
        const band = new THREE.Mesh(new THREE.SphereGeometry(0.258, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), mat);
        band.position.set(0, 0.25, -0.012);
        band.rotation.x = -0.2;
        const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), mat);
        knot.position.set(0, 0.29, -0.255);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 8), mat);
        tail.position.set(0.04, 0.2, -0.28);
        tail.rotation.set(0.4, 0, 0.6);
        head.add(band, knot, tail);
        break;
      }
      case 'headband': {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.028, 8, 32), toonMaterial('#ffffff'));
        band.position.set(0, 0.32, 0);
        band.rotation.x = Math.PI / 2 - 0.15;
        head.add(band);
        break;
      }
      case 'strawhat': {
        const straw = toonMaterial('#e8c779', { gloss: 0.1 });
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.03, 32), straw);
        brim.position.set(0, 0.36, 0);
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.2, 24), straw);
        crown.position.set(0, 0.47, 0);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.252, 0.252, 0.05, 24), toonMaterial('#d62828'));
        band.position.set(0, 0.4, 0);
        band.userData.noOutline = true;
        head.add(brim, crown, band);
        break;
      }
      case 'lei': {
        const colorsLei = [toonMaterial('#ff6fae'), toonMaterial('#ffd23f'), toonMaterial('#ff8a3d'), toonMaterial('#ffffff')];
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), colorsLei[i % 4]!);
          f.position.set(Math.sin(a) * 0.17, -0.06 - Math.max(0, Math.cos(a)) * 0.06, Math.cos(a) * 0.14);
          head.add(f);
        }
        break;
      }
      case 'flower': {
        const petal = toonMaterial('#ff6fae');
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const p = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), petal);
          p.position.set(0.25, 0.31 + Math.sin(a) * 0.045, Math.cos(a) * 0.045);
          p.scale.set(0.5, 1, 1);
          head.add(p);
        }
        const center = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), toonMaterial('#ffd23f'));
        center.position.set(0.262, 0.31, 0);
        head.add(center);
        break;
      }
    }
  }
}
