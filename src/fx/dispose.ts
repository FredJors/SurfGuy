import * as THREE from 'three';

/** Gibt Geometrien und Materialien eines Objekts frei (nicht geteilte Ressourcen vorausgesetzt). */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    // Materialien können geteilt sein (Konturen, Toon-Verlauf) – nur eigene freigeben
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) if (m && !m.userData.shared) m.dispose();
  });
}
