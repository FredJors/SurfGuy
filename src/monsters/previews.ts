/**
 * Statische Vorschau-Modelle für das Bestiarium. Fehlt ein Eintrag für ein Verhalten,
 * wird einfach das Modell aus dem Manifest (`MonsterDef.model`) gezeigt.
 */
import * as THREE from 'three';
import type { AssetLoader } from '../assets/AssetLoader';
import type { MonsterDef } from '../data/types';
import { addOutline, toonMaterial } from '../fx/toon';

export type MonsterPreviewBuilder = (def: MonsterDef, assets: AssetLoader) => THREE.Object3D;

/** Kraken: Kopf + vier geschwungene Tentakel aus Kugeln. */
function krakenPreview(def: MonsterDef, assets: AssetLoader): THREE.Object3D {
  const g = new THREE.Group();
  const head = assets.create(def.model, { colors: def.colors });
  head.scale.setScalar(0.8);
  g.add(head);
  const body = toonMaterial(def.colors.body);
  const accent = toonMaterial(def.colors.accent);
  const sphere = new THREE.SphereGeometry(1, 10, 8);
  for (let t = 0; t < 4; t++) {
    const a = -1.2 + (t / 3) * 2.4;
    const base = new THREE.Vector3(Math.sin(a) * 2.2, -0.2, Math.cos(a) * 2.2);
    const out = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    for (let i = 0; i < 16; i++) {
      const u = i / 15;
      const p = base.clone().addScaledVector(out, u * 3.2).add(new THREE.Vector3(0, Math.sin(u * Math.PI) * 3.2 + u * 1.2, 0));
      const s = new THREE.Mesh(sphere, i % 3 === 0 && i > 2 ? accent : body);
      s.position.copy(p);
      s.scale.setScalar(0.62 * (1 - 0.7 * u));
      g.add(s);
    }
  }
  addOutline(g, 0.06);
  return g;
}

/** Seeschlange: Segmente als S-Kurve hinter dem Kopf, Maul offen. */
function serpentPreview(def: MonsterDef, assets: AssetLoader): THREE.Object3D {
  const obj = assets.create(def.model, { colors: def.colors, segments: def.behaviorParams?.segments ?? 9 });
  const head = obj.getObjectByName('head');
  if (head) head.position.y = 1.6;
  const jaw = obj.getObjectByName('jaw');
  if (jaw) jaw.rotation.x = 0.5;
  const prev = new THREE.Vector3(0, 1.6, 0);
  for (let i = 0; i < 20; i++) {
    const seg = obj.getObjectByName(`seg${i}`);
    if (!seg) break;
    seg.position.set(Math.sin(i * 0.75) * 1.8, 0.8 * Math.cos(i * 0.9) - i * 0.05, -1.3 - i * 1.4);
    seg.lookAt(prev);
    prev.copy(seg.position);
  }
  addOutline(obj, 0.05);
  return obj;
}

/** Muschel: halb geöffnet, damit man Perle und Augen sieht. */
function clamPreview(def: MonsterDef, assets: AssetLoader): THREE.Object3D {
  const obj = assets.create(def.model, { colors: def.colors });
  const lid = obj.getObjectByName('lid');
  if (lid) lid.rotation.x = -0.65;
  addOutline(obj, 0.05);
  return obj;
}

/** Seeleopard: Maul weit auf (Zähne zeigen). */
function sealPreview(def: MonsterDef, assets: AssetLoader): THREE.Object3D {
  const obj = assets.create(def.model, { colors: def.colors });
  const jaw = obj.getObjectByName('jaw');
  if (jaw) jaw.rotation.x = 0.6;
  addOutline(obj, 0.05);
  return obj;
}

function defaultPreview(def: MonsterDef, assets: AssetLoader): THREE.Object3D {
  const obj = assets.create(def.model, { colors: def.colors });
  addOutline(obj, 0.05);
  return obj;
}

/** Vorschau je Verhalten (behavior-id). */
export const MONSTER_PREVIEWS: Record<string, MonsterPreviewBuilder> = {
  kraken: krakenPreview,
  serpent: serpentPreview,
  clam: clamPreview,
  seal: sealPreview,
};

export function buildMonsterPreview(def: MonsterDef, assets: AssetLoader): THREE.Object3D {
  return (MONSTER_PREVIEWS[def.behavior] ?? defaultPreview)(def, assets);
}
