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

function defaultPreview(def: MonsterDef, assets: AssetLoader): THREE.Object3D {
  const obj = assets.create(def.model, { colors: def.colors });
  addOutline(obj, 0.05);
  return obj;
}

/** Vorschau je Verhalten (behavior-id). */
export const MONSTER_PREVIEWS: Record<string, MonsterPreviewBuilder> = {
  kraken: krakenPreview,
};

export function buildMonsterPreview(def: MonsterDef, assets: AssetLoader): THREE.Object3D {
  return (MONSTER_PREVIEWS[def.behavior] ?? defaultPreview)(def, assets);
}
