/**
 * Vulkaninsel mit Palmen, Rauchsäule und Riff-/Sturmgrenze.
 * Die Insel steht fest in der Welt. Ist der Spieler sehr weit weg, wird sie optisch
 * näher geholt und verkleinert (gleicher Sehwinkel), damit sie immer am Horizont sichtbar ist.
 */
import * as THREE from 'three';
import type { AssetLoader } from '../assets/AssetLoader';
import { CONFIG } from '../config/gameConfig';
import { Rng } from '../core/Rng';
import { mergeStatic } from '../fx/merge';
import { enableShadows, scaleFog, toonMaterial } from '../fx/toon';

export class Island {
  readonly group = new THREE.Group();
  readonly position: THREE.Vector2;
  private readonly smoke: { mesh: THREE.Mesh; t: number; speed: number; drift: number }[] = [];

  constructor(assets: AssetLoader) {
    const [ix, iz] = CONFIG.world.islandPosition;
    this.position = new THREE.Vector2(ix, iz);
    const rng = new Rng(2024);
    const R = CONFIG.world.islandRadius;
    const H = CONFIG.world.volcanoHeight;

    this.group.add(assets.create('volcano'));

    // Palmen am Strand und in den Hängen (groß, damit sie von weit weg lesbar sind)
    const decor = new THREE.Group();
    const palmCount = 34;
    for (let i = 0; i < palmCount; i++) {
      const palm = assets.create('palm', { seed: i + 1 });
      const a = (i / palmCount) * Math.PI * 2 + rng.range(-0.08, 0.08);
      const upper = i % 3 === 0;
      const r = upper ? rng.range(0.72, 0.8) * R : rng.range(0.86, 0.95) * R;
      palm.position.set(Math.cos(a) * r, upper ? 0.1 * H : 1.5, Math.sin(a) * r);
      palm.scale.setScalar(rng.range(20, 28));
      palm.rotation.y = rng.range(0, Math.PI * 2);
      decor.add(palm);
    }

    // Felsen am Ufer
    for (let i = 0; i < 18; i++) {
      const rock = assets.create('rock', { seed: 100 + i });
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(1.0, 1.08) * R;
      rock.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      rock.scale.set(rng.range(8, 16), rng.range(6, 12), rng.range(8, 16));
      rock.rotation.y = rng.range(0, Math.PI * 2);
      decor.add(rock);
    }
    // Statische Deko zusammenfassen: wenige Draw-Calls statt einem pro Palme/Fels
    this.group.add(mergeStatic(decor));

    // Rauchsäule
    const smokeMat = scaleFog(toonMaterial('#e8e4f0', { emissive: '#6d6a80', emissiveIntensity: 0.25 }), 0.3);
    const puffGeo = new THREE.IcosahedronGeometry(1, 2);
    for (let i = 0; i < 9; i++) {
      const puff = new THREE.Mesh(puffGeo, smokeMat);
      this.smoke.push({ mesh: puff, t: i / 9, speed: rng.range(0.025, 0.035), drift: rng.range(-1, 1) });
      this.group.add(puff);
    }

    this.buildReef(rng);
    enableShadows(this.group, true, true);
  }

  /** Riffgrenze: Ring aus bunten Korallenfelsen. */
  private buildReef(rng: Rng): void {
    const count = 150;
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = toonMaterial('#ffffff');
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const palette = [CONFIG.colors.reef, '#ffb35c', '#c46bd8', '#6b7fd8', CONFIG.colors.rock];
    const r0 = CONFIG.world.boundaryRadius - 18;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rng.range(-0.01, 0.01);
      const r = r0 + rng.range(-14, 14);
      p.set(Math.cos(a) * r, rng.range(-0.8, 0.3), Math.sin(a) * r);
      const big = rng.chance(0.15);
      s.set(rng.range(2, 4.5) * (big ? 1.7 : 1), rng.range(1.2, 3.2) * (big ? 2.4 : 1), rng.range(2, 4.5));
      q.setFromEuler(new THREE.Euler(rng.range(-0.2, 0.2), rng.range(0, 6.3), rng.range(-0.2, 0.2)));
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, new THREE.Color(rng.pick(palette)));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
  }

  /** Entfernung (m) vom Punkt zur Inselmitte. */
  distanceTo(x: number, z: number): number {
    return Math.hypot(x - this.position.x, z - this.position.y);
  }

  update(dt: number, viewerX: number, viewerZ: number): void {
    // Immer sichtbar: bei großer Entfernung näher holen und verkleinern
    const dx = this.position.x - viewerX;
    const dz = this.position.y - viewerZ;
    const dist = Math.hypot(dx, dz);
    const maxD = CONFIG.world.islandMaxVisualDistance;
    if (dist > maxD) {
      const k = maxD / dist;
      this.group.position.set(viewerX + dx * k, 0, viewerZ + dz * k);
      this.group.scale.setScalar(k);
    } else {
      this.group.position.set(this.position.x, 0, this.position.y);
      this.group.scale.setScalar(1);
    }

    // Rauch steigt auf und wird größer
    const H = CONFIG.world.volcanoHeight;
    for (const s of this.smoke) {
      s.t = (s.t + dt * s.speed) % 1;
      const t = s.t;
      const size = 10 + t * 34;
      s.mesh.position.set(Math.sin(t * 3 + s.drift) * 8 + t * 60, H + 6 + t * 190, s.drift * 6 - t * 20);
      s.mesh.scale.set(size, size * 0.8, size);
    }
  }
}
