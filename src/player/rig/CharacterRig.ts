/**
 * Charakter-Rig-Schnittstelle: Die prozedurale Animation dreht nur benannte Gelenke und
 * verschiebt/dreht den Körper. Platzhalter-Figur und echtes glTF-Modell implementieren
 * dieselbe Schnittstelle (JointRig findet Gelenke über Namen bzw. die boneMap im Manifest).
 */
import * as THREE from 'three';
import type { JointId } from '../../data/types';

export const JOINT_IDS: readonly JointId[] = [
  'hips',
  'spine',
  'head',
  'armL',
  'forearmL',
  'armR',
  'forearmR',
  'legL',
  'shinL',
  'legR',
  'shinR',
];

export interface CharacterRig {
  /** Wurzel der Figur (wird in die Szene gehängt) */
  readonly object: THREE.Object3D;
  hasJoint(id: JointId): boolean;
  /** Rotation relativ zur Ruhelage des Gelenks */
  setJointRotation(id: JointId, rotation: THREE.Quaternion): void;
  /** Verschiebung/Drehung des ganzen Körpers relativ zum Brett */
  setBodyTransform(offset: THREE.Vector3, rotation: THREE.Quaternion): void;
  /** Für Treffer-Blinken o. Ä. */
  setVisible(visible: boolean): void;
}

export class JointRig implements CharacterRig {
  readonly object = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly joints = new Map<JointId, { node: THREE.Object3D; rest: THREE.Quaternion }>();

  /**
   * @param figure Platzhalter-Figur oder geladenes glTF
   * @param boneMap optionale Zuordnung Gelenk → Knochenname (für glTF)
   */
  constructor(figure: THREE.Object3D, boneMap?: Partial<Record<JointId, string>>) {
    this.object.name = 'characterRig';
    this.object.add(this.body);
    this.body.add(figure);
    for (const id of JOINT_IDS) {
      const name = boneMap?.[id] ?? id;
      const node = figure.getObjectByName(name) ?? (boneMap ? figure.getObjectByName(id) : undefined);
      if (node) this.joints.set(id, { node, rest: node.quaternion.clone() });
    }
    if (this.joints.size === 0) console.warn('[Rig] Keine Gelenke gefunden – Figur bleibt statisch.');
  }

  hasJoint(id: JointId): boolean {
    return this.joints.has(id);
  }

  setJointRotation(id: JointId, rotation: THREE.Quaternion): void {
    const j = this.joints.get(id);
    if (j) j.node.quaternion.copy(j.rest).multiply(rotation);
  }

  setBodyTransform(offset: THREE.Vector3, rotation: THREE.Quaternion): void {
    this.body.position.copy(offset);
    this.body.quaternion.copy(rotation);
  }

  setVisible(visible: boolean): void {
    this.object.visible = visible;
  }
}
