/**
 * Fasst statische Meshes mit gleichem Material zu einem Mesh zusammen (weniger Draw-Calls,
 * wichtig für 60 FPS auf dem Handy). Meshes mit unpassenden Attributen bleiben unverändert.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function mergeStatic(root: THREE.Object3D): THREE.Group {
  root.updateMatrixWorld(true);
  const inverseRoot = root.matrixWorld.clone().invert();
  const meshes: THREE.Mesh[] = [];
  const leftovers: THREE.Object3D[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
    if (Array.isArray(mesh.material)) leftovers.push(mesh);
    else meshes.push(mesh);
  });
  const out = new THREE.Group();
  out.position.copy(root.position);
  out.quaternion.copy(root.quaternion);
  out.scale.copy(root.scale);
  for (const m of mergeMeshes(meshes, (mesh) => new THREE.Matrix4().multiplyMatrices(inverseRoot, mesh.matrixWorld))) out.add(m);
  for (const l of leftovers) out.add(l.clone());
  return out;
}

/**
 * Fasst bei jedem Knoten die direkten Mesh-Kinder zusammen (Gelenke bleiben beweglich).
 * Ideal für Figuren aus vielen Grundformen.
 */
export function mergeChildMeshes(root: THREE.Object3D): void {
  const parents: THREE.Object3D[] = [];
  root.traverse((o) => parents.push(o));
  for (const parent of parents) {
    const meshes = parent.children.filter(
      (c): c is THREE.Mesh => (c as THREE.Mesh).isMesh && c.children.length === 0 && !Array.isArray((c as THREE.Mesh).material),
    );
    if (meshes.length < 2) continue;
    for (const m of meshes) {
      m.updateMatrix();
      parent.remove(m);
    }
    for (const merged of mergeMeshes(meshes, (m) => m.matrix)) parent.add(merged);
  }
}

/** Gruppiert nach Material (und Kontur-Flag) und verschmilzt die Geometrien. */
function mergeMeshes(meshes: THREE.Mesh[], matrixOf: (m: THREE.Mesh) => THREE.Matrix4): THREE.Mesh[] {
  const groups = new Map<string, { material: THREE.Material; noOutline: boolean; geos: THREE.BufferGeometry[] }>();
  for (const mesh of meshes) {
    const material = mesh.material as THREE.Material;
    const noOutline = !!mesh.userData.noOutline;
    const key = `${material.uuid}|${noOutline}`;
    const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    // Nur Position/Normale/UV/Farbe behalten, damit die Attribute zusammenpassen
    for (const name of Object.keys(geo.attributes)) {
      if (!['position', 'normal', 'uv', 'color'].includes(name)) geo.deleteAttribute(name);
    }
    if (!geo.getAttribute('uv')) {
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count * 2), 2));
    }
    geo.applyMatrix4(matrixOf(mesh));
    const g = groups.get(key) ?? { material, noOutline, geos: [] };
    g.geos.push(geo);
    groups.set(key, g);
  }
  const out: THREE.Mesh[] = [];
  for (const g of groups.values()) {
    const hasColor = g.geos.map((x) => !!x.getAttribute('color'));
    const merged = hasColor.every((v) => v === hasColor[0]) ? mergeGeometries(g.geos) : null;
    const parts = merged ? [merged] : g.geos;
    for (const geo of parts) {
      const m = new THREE.Mesh(geo, g.material);
      m.userData.noOutline = g.noOutline;
      out.push(m);
    }
  }
  return out;
}
