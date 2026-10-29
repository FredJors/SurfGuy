/** Posen als Quaternionen: Vorberechnen, Mischen, auf ein Rig anwenden. */
import * as THREE from 'three';
import type { JointId, PoseDef, Vec3Tuple } from '../../data/types';
import type { CharacterRig } from './CharacterRig';
import { JOINT_IDS } from './CharacterRig';

const D2R = Math.PI / 180;

export class Pose {
  readonly joints: Record<JointId, THREE.Quaternion>;
  readonly bodyOffset = new THREE.Vector3();
  readonly bodyRotation = new THREE.Quaternion();

  constructor() {
    this.joints = {} as Record<JointId, THREE.Quaternion>;
    for (const id of JOINT_IDS) this.joints[id] = new THREE.Quaternion();
  }

  static fromDef(def: PoseDef): Pose {
    const p = new Pose();
    for (const id of JOINT_IDS) {
      const e = def.joints[id];
      if (e) setEuler(p.joints[id], e);
    }
    if (def.bodyOffset) p.bodyOffset.set(...def.bodyOffset);
    if (def.bodyRotation) setEuler(p.bodyRotation, def.bodyRotation);
    return p;
  }

  copy(o: Pose): this {
    for (const id of JOINT_IDS) this.joints[id].copy(o.joints[id]);
    this.bodyOffset.copy(o.bodyOffset);
    this.bodyRotation.copy(o.bodyRotation);
    return this;
  }

  /** this = mix(this, target, t) */
  blendTo(target: Pose, t: number): this {
    for (const id of JOINT_IDS) this.joints[id].slerp(target.joints[id], t);
    this.bodyOffset.lerp(target.bodyOffset, t);
    this.bodyRotation.slerp(target.bodyRotation, t);
    return this;
  }

  /** this = mix(a, b, t) */
  mix(a: Pose, b: Pose, t: number): this {
    for (const id of JOINT_IDS) this.joints[id].slerpQuaternions(a.joints[id], b.joints[id], t);
    this.bodyOffset.lerpVectors(a.bodyOffset, b.bodyOffset, t);
    this.bodyRotation.slerpQuaternions(a.bodyRotation, b.bodyRotation, t);
    return this;
  }

  setJointEuler(id: JointId, x: number, y: number, z: number): this {
    setEuler(this.joints[id], [x, y, z]);
    return this;
  }

  applyTo(rig: CharacterRig): void {
    for (const id of JOINT_IDS) rig.setJointRotation(id, this.joints[id]);
    rig.setBodyTransform(this.bodyOffset, this.bodyRotation);
  }
}

const tmpEuler = new THREE.Euler();
function setEuler(q: THREE.Quaternion, e: Vec3Tuple): void {
  tmpEuler.set(e[0] * D2R, e[1] * D2R, e[2] * D2R, 'XYZ');
  q.setFromEuler(tmpEuler);
}
