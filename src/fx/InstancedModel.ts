/**
 * Viele gleiche Objekte (z. B. Perlen) mit wenigen Draw-Calls: Jedes Teil-Mesh eines Modells
 * wird zu einem InstancedMesh. Konturen (Inverted Hull) werden mit-instanziert.
 */
import * as THREE from 'three';
import { addOutline } from './toon';

interface Part {
  mesh: THREE.InstancedMesh;
  local: THREE.Matrix4;
}

export class InstancedModel {
  readonly group = new THREE.Group();
  private readonly parts: Part[] = [];
  private count = 0;
  private readonly tmp = new THREE.Matrix4();

  constructor(
    model: THREE.Object3D,
    readonly capacity: number,
    outline?: number,
  ) {
    model.updateMatrixWorld(true);
    const inv = model.matrixWorld.clone().invert();
    model.traverse((o) => {
      const src = o as THREE.Mesh;
      if (!src.isMesh || src.userData.isOutline) return;
      const mesh = new THREE.InstancedMesh(src.geometry, src.material, capacity);
      mesh.frustumCulled = false;
      mesh.userData.noOutline = src.userData.noOutline;
      this.parts.push({ mesh, local: new THREE.Matrix4().multiplyMatrices(inv, src.matrixWorld) });
      this.group.add(mesh);
    });
    if (outline !== undefined) addOutline(this.group, outline);
    // Konturen teilen sich die Instanz-Matrizen, brauchen aber denselben Zähler
    this.group.traverse((o) => {
      const m = o as THREE.InstancedMesh;
      if (!m.isInstancedMesh) return;
      m.frustumCulled = false;
      m.count = 0;
    });
  }

  /** Beginnt ein neues Bild (alle Instanzen verwerfen). */
  begin(): void {
    this.count = 0;
  }

  /** Fügt eine Instanz hinzu. Gibt false zurück, wenn die Kapazität erschöpft ist. */
  add(matrix: THREE.Matrix4): boolean {
    if (this.count >= this.capacity) return false;
    for (const p of this.parts) p.mesh.setMatrixAt(this.count, this.tmp.multiplyMatrices(matrix, p.local));
    this.count++;
    return true;
  }

  /** Schließt das Bild ab (Zähler setzen, Matrizen hochladen). */
  end(): void {
    this.group.traverse((o) => {
      const m = o as THREE.InstancedMesh;
      if (!m.isInstancedMesh) return;
      m.count = this.count;
      m.instanceMatrix.needsUpdate = true;
    });
  }
}
