/**
 * Surfshop am Strand mit Keoni, dem Hawaiianer mit Ukulele. Nach dem Sieg über den Wächter
 * zeigt ein Lichtstrahl den Weg; wer hinläuft, startet das Gespräch (siehe story/).
 */
import * as THREE from 'three';
import type { AssetLoader } from '../assets/AssetLoader';
import { CONFIG } from '../config/gameConfig';
import { mergeStatic } from '../fx/merge';
import { addOutline, enableShadows, toonMaterial } from '../fx/toon';
import { JointRig } from '../player/rig/CharacterRig';
import type { JointId } from '../data/types';
import { islandHeight } from './islandTerrain';

const D2R = Math.PI / 180;

function signTexture(text: string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2ec4b6';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#1d2140';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 118);
  ctx.font = '900 72px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.strokeText(text, 256, 68);
  ctx.fillStyle = '#ffe066';
  ctx.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildUkulele(): THREE.Object3D {
  const g = new THREE.Group();
  const wood = toonMaterial('#d08a4a', { gloss: 0.6 });
  const dark = toonMaterial('#5a3218');
  const lower = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), wood);
  lower.scale.set(1, 1, 0.35);
  const upper = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), wood);
  upper.scale.set(1, 1, 0.35);
  upper.position.y = 0.17;
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), new THREE.MeshBasicMaterial({ color: '#2a160a' }));
  hole.position.set(0, 0.09, 0.05);
  hole.userData.noOutline = true;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.32, 0.03), dark);
  neck.position.y = 0.4;
  const headstock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.03), dark);
  headstock.position.y = 0.6;
  g.add(lower, upper, hole, neck, headstock);
  return g;
}

export class Hut {
  readonly group = new THREE.Group();
  /** Weltposition von Keoni (Gesprächspunkt) */
  readonly keoniPos = new THREE.Vector3();
  private readonly rig: JointRig;
  private readonly beacon: THREE.Mesh;
  private readonly marker: THREE.Object3D;
  private readonly flames: THREE.Mesh[] = [];
  private time = 0;
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  /** Lichtstrahl/Ausrufezeichen zeigen (Weg zum Laden) */
  guiding = false;

  constructor(assets: AssetLoader) {
    const I = CONFIG.island;
    const R = CONFIG.world.islandRadius;
    const a = (I.hutAngle * Math.PI) / 180;
    const [ix, iz] = CONFIG.world.islandPosition;
    const hx = Math.cos(a) * I.hutDistance * R;
    const hz = Math.sin(a) * I.hutDistance * R;
    const ground = islandHeight(hx, hz);
    // Teil der Inselgruppe (lokale Koordinaten), damit er mit der Insel mitwandert
    this.group.position.set(hx, ground, hz);
    // Front zeigt aufs Meer hinaus
    this.group.rotation.y = Math.atan2(hx, hz);

    const wood = toonMaterial('#b8763c', { gloss: 0.15 });
    const woodDark = toonMaterial('#7d4a22', { gloss: 0.1 });
    const straw = toonMaterial('#e3c070', { gloss: 0.05 });
    const strawDark = toonMaterial('#b8913f');
    const hut = new THREE.Group();
    // Plattform auf Stelzen
    const deck = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 6), wood);
    deck.position.y = 0.7;
    hut.add(deck);
    for (const x of [-3.7, 0, 3.7]) {
      for (const z of [-2.7, 2.7]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.6, 8), woodDark);
        post.position.set(x, 0.1, z);
        hut.add(post);
      }
    }
    // Rück- und Seitenwände aus Brettern
    for (let i = 0; i < 10; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.78, 2.6, 0.12), i % 2 ? wood : woodDark);
      plank.position.set(-3.6 + i * 0.8, 2.15, -2.8);
      hut.add(plank);
    }
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 5.4), wood);
      wall.position.set(side * 3.95, 2.15, -0.1);
      hut.add(wall);
    }
    // Theke vorne
    const counter = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.1, 0.7), woodDark);
    counter.position.set(0, 1.4, 2.3);
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.14, 1.0), wood);
    top.position.set(0, 2.0, 2.3);
    hut.add(counter, top);
    // Strohdach mit Fransen
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.3, 2.6, 4, 1), straw);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 0.85);
    roof.position.y = 4.75;
    const fringe = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.9, 0.6, 4, 1, true), strawDark);
    fringe.rotation.y = Math.PI / 4;
    fringe.scale.set(1, 1, 0.85);
    fringe.position.y = 3.35;
    hut.add(roof, fringe);
    // Surfbretter an der Seite
    const boardColors = [
      { base: '#ff5d73', stripe: '#ffd23f', rail: '#ffffff' },
      { base: '#2ec4b6', stripe: '#1d2140', rail: '#ffffff' },
      { base: '#ffd23f', stripe: '#ff6b35', rail: '#ffffff' },
    ];
    boardColors.forEach((colors, i) => {
      const b = assets.create('board', { colors });
      b.scale.setScalar(1.3);
      b.rotation.set(-Math.PI / 2 + 0.25, 0, 0.1 * (i - 1));
      b.position.set(4.6 + i * 0.05, 1.4, -1.6 + i * 1.1);
      b.rotation.y = Math.PI / 2;
      hut.add(b);
    });
    addOutline(hut, 0.05);
    const merged = mergeStatic(hut);
    enableShadows(merged, true, true);
    this.group.add(merged);

    // Schild „SURF SHOP“
    const tex = signTexture('SURF SHOP');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: tex, color: tex ? '#ffffff' : '#2ec4b6' }));
    sign.position.set(0, 3.55, 2.95);
    sign.rotation.x = -0.12;
    this.group.add(sign);

    // Fackeln am Eingang
    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 8), woodDark);
      pole.position.set(side * 4.6, 1.2, 4.2);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb347').multiplyScalar(2.2) }));
      flame.position.set(side * 4.6, 2.6, 4.2);
      this.flames.push(flame);
      this.group.add(pole, flame);
    }

    // Keoni: Hawaii-Hemd, Strohhut, Blumenkette, Ukulele
    const figure = assets.create('surfer', {
      colors: { skin: '#b9763f', hair: '#1b1b1b', shirt: '#ff7f3f', shorts: '#2e8b57' },
      accessories: ['strawhat', 'lei'],
      pattern: 'hawaii',
    });
    addOutline(figure, CONFIG.render.characterOutline);
    this.rig = new JointRig(figure);
    const spine = figure.getObjectByName('spine');
    if (spine) {
      const uke = buildUkulele();
      uke.position.set(-0.02, 0.18, 0.2);
      uke.rotation.set(0.1, 0, 1.0);
      addOutline(uke, 0.012);
      spine.add(uke);
    }
    this.rig.object.position.set(0, 0.85, 3.2);
    this.rig.object.scale.setScalar(1.05);
    enableShadows(this.rig.object, true, false);
    this.group.add(this.rig.object);
    this.group.updateMatrixWorld(true);
    this.rig.object.getWorldPosition(this.keoniPos);
    this.keoniPos.x += ix;
    this.keoniPos.z += iz;

    // Lichtstrahl (Weg zum Laden) und Ausrufezeichen über Keoni
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.6, 70, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    // Erst über dem Dach beginnen (aus der Nähe nicht blenden)
    this.beacon.position.set(0, 7 + 35, 1);
    this.group.add(this.beacon);
    const mark = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.45, 4, 8), toonMaterial('#ffd23f', { emissive: '#ffb000', emissiveIntensity: 0.4 }));
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), toonMaterial('#ffd23f', { emissive: '#ffb000', emissiveIntensity: 0.4 }));
    dot.position.y = -0.5;
    mark.add(bar, dot);
    addOutline(mark, 0.03);
    mark.position.set(0, 3.4, 3.2);
    this.marker = mark;
    this.group.add(mark);
  }

  private setJoint(id: JointId, x: number, y: number, z: number): void {
    this.e.set(x * D2R, y * D2R, z * D2R);
    this.rig.setJointRotation(id, this.q.setFromEuler(this.e));
  }

  update(dt: number): void {
    this.time += dt;
    const t = this.time;
    // Keoni spielt Ukulele und wippt im Takt
    const strum = Math.sin(t * 9) * 10;
    this.setJoint('spine', 4, Math.sin(t * 1.5) * 5, Math.sin(t * 3) * 2);
    this.setJoint('head', -6 + Math.sin(t * 3) * 4, Math.sin(t * 1.5) * 10, Math.sin(t * 1.5) * 3);
    this.setJoint('armR', -35 + strum, 20, -10);
    this.setJoint('forearmR', -70, 0, 0);
    this.setJoint('armL', -60, -30, 35);
    this.setJoint('forearmL', -80, 0, 0);
    this.setJoint('legL', Math.max(0, Math.sin(t * 3)) * -8, 0, 4);
    this.setJoint('legR', 0, 0, -4);
    for (const f of this.flames) f.scale.set(1 + Math.sin(t * 13 + f.position.x) * 0.12, 1 + Math.sin(t * 17) * 0.18, 1);
    this.beacon.visible = this.guiding;
    this.marker.visible = this.guiding;
    if (this.guiding) {
      (this.beacon.material as THREE.MeshBasicMaterial).opacity = 0.25 + Math.sin(t * 2) * 0.1;
      this.marker.position.y = 3.4 + Math.sin(t * 3) * 0.15;
      this.marker.rotation.y = t * 1.5;
    }
  }
}
