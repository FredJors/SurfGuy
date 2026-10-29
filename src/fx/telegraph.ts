/** Warnmarkierungen auf dem Wasser: zeigen, wo gleich ein Angriff einschlägt. */
import * as THREE from 'three';

function basic(color: string, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, fog: false });
}

/** Ring mit gefüllter Fläche (Radius 1, über scale anpassen). Kind 1 = Ring (für Pulsieren). */
export function createRingTelegraph(color = '#ff2d55'): THREE.Group {
  const g = new THREE.Group();
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 40), basic(color, 0.25));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40), basic(color, 0.9));
  ring.rotation.x = fill.rotation.x = -Math.PI / 2;
  g.add(fill, ring);
  g.visible = false;
  g.renderOrder = 2;
  return g;
}

/**
 * Streifen von A nach B (z. B. Rammbahn eines Hais). Länge/Breite über `placeStripe`.
 * Kind 1 = Rand (für Pulsieren).
 */
export function createStripeTelegraph(color = '#ff2d55'): THREE.Group {
  const g = new THREE.Group();
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic(color, 0.28));
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic(color, 0.85));
  fill.rotation.x = edge.rotation.x = -Math.PI / 2;
  edge.scale.set(0.18, 1, 1);
  edge.position.y = 0.01;
  g.add(fill, edge);
  g.visible = false;
  g.renderOrder = 2;
  return g;
}

/** Legt einen Streifen-Telegraph zwischen zwei Punkte auf Höhe y. */
export function placeStripe(g: THREE.Group, ax: number, az: number, bx: number, bz: number, y: number, width: number): void {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  g.position.set((ax + bx) / 2, y, (az + bz) / 2);
  g.rotation.set(0, Math.atan2(dx, dz), 0);
  g.scale.set(width, 1, len);
}
