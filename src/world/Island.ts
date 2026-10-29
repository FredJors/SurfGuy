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
import { noise3 } from '../core/noise';
import { islandBiome, islandHeight } from './islandTerrain';
import { Hut } from './Hut';

export class Island {
  readonly group = new THREE.Group();
  readonly position: THREE.Vector2;
  private readonly smoke: { mesh: THREE.Mesh; t: number; speed: number; drift: number }[] = [];
  private readonly shore: THREE.ShaderMaterial;
  private time = 0;
  /** Surfshop mit Keoni (Story) */
  readonly hut: Hut;
  // Vulkanausbruch
  private smokeMat!: THREE.MeshToonMaterial;
  private readonly smokeCalm = new THREE.Color('#e8e4f0');
  private readonly smokeAsh = new THREE.Color('#4d4248');
  private eruptLevel = 0;
  private eruptTarget = 0;
  private burst = 0;
  private bombTimer = 0;
  private readonly bombs: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; alive: boolean }[] = [];
  private lavaMats: THREE.MeshBasicMaterial[] = [];
  private readonly lavaBase = new THREE.Color(CONFIG.colors.lava).multiplyScalar(2.6);
  private path: THREE.Mesh | null = null;
  private pathFade = 0;

  constructor(assets: AssetLoader) {
    const [ix, iz] = CONFIG.world.islandPosition;
    this.position = new THREE.Vector2(ix, iz);
    const rng = new Rng(2024);
    const R = CONFIG.world.islandRadius;

    this.group.add(assets.create('volcano'));

    // Palmen am Strand (dicht) und auf den grünen Hügeln – auf der Geländehöhe
    const decor = new THREE.Group();
    const hutA = (CONFIG.island.hutAngle * Math.PI) / 180;
    const hutX = Math.cos(hutA) * CONFIG.island.hutDistance * R;
    const hutZ = Math.sin(hutA) * CONFIG.island.hutDistance * R;
    const placePalm = (x: number, z: number, seed: number) => {
      if (Math.hypot(x - hutX, z - hutZ) < 13) return; // Platz für den Surfshop
      const palm = assets.create('palm', { seed });
      palm.position.set(x, islandHeight(x, z) - 0.3, z);
      palm.scale.setScalar(rng.range(20, 29));
      palm.rotation.y = rng.range(0, Math.PI * 2);
      decor.add(palm);
    };
    const beachPalms = 38;
    for (let i = 0; i < beachPalms; i++) {
      const a = (i / beachPalms) * Math.PI * 2 + rng.range(-0.06, 0.06);
      const r = rng.range(0.84, 0.94) * R;
      placePalm(Math.cos(a) * r, Math.sin(a) * r, i + 1);
    }
    for (let i = 0, placed = 0; i < 200 && placed < 16; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(0.55, 0.82) * R;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const b = islandBiome(x, z, islandHeight(x, z), 0.1);
      if (b !== 'grass' && b !== 'jungle') continue;
      placePalm(x, z, 100 + i);
      placed++;
    }

    // Felsen am Ufer (halb im Wasser) und ein paar an den Hängen
    for (let i = 0; i < 26; i++) {
      const rock = assets.create('rock', { seed: 100 + i });
      const a = rng.range(0, Math.PI * 2);
      const r = i < 18 ? rng.range(0.98, 1.07) * R : rng.range(0.35, 0.6) * R;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const big = i < 18 ? 1 : 1.6;
      rock.position.set(x, islandHeight(x, z) - (i < 18 ? 1.2 : 2), z);
      rock.scale.set(rng.range(8, 16) * big, rng.range(6, 12) * big, rng.range(8, 16) * big);
      rock.rotation.y = rng.range(0, Math.PI * 2);
      decor.add(rock);
    }
    this.group.add(this.buildBushes(rng));
    this.shore = this.buildShore();
    // Statische Deko zusammenfassen: wenige Draw-Calls statt einem pro Palme/Fels
    this.group.add(mergeStatic(decor));

    // Rauchsäule
    const smokeMat = scaleFog(toonMaterial('#e8e4f0', { emissive: '#6d6a80', emissiveIntensity: 0.25 }), 0.3);
    this.smokeMat = smokeMat;
    const puffGeo = new THREE.IcosahedronGeometry(1, 2);
    for (let i = 0; i < 9; i++) {
      const puff = new THREE.Mesh(puffGeo, smokeMat);
      this.smoke.push({ mesh: puff, t: i / 9, speed: rng.range(0.025, 0.035), drift: rng.range(-1, 1) });
      this.group.add(puff);
    }

    this.buildReef(rng);
    enableShadows(this.group, true, true);
    // Surfshop zuletzt (setzt seine Schatten selbst)
    this.hut = new Hut(assets);
    this.group.add(this.hut.group);
    // Lava-Materialien merken (pulsieren beim Ausbruch)
    this.group.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
      if (o.name === 'lava' && m?.isMeshBasicMaterial && !this.lavaMats.includes(m)) this.lavaMats.push(m);
    });
    // Lava-Brocken für den Ausbruch (Pool)
    const bombGeo = new THREE.DodecahedronGeometry(1, 0);
    const bombMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6a1a').multiplyScalar(2.2) });
    for (let i = 0; i < 70; i++) {
      const mesh = new THREE.Mesh(bombGeo, bombMat);
      mesh.visible = false;
      this.bombs.push({ mesh, vx: 0, vy: 0, vz: 0, alive: false });
      this.group.add(mesh);
    }
  }

  /**
   * Vulkanausbruch: großer Ausbruch jetzt (burst) und danach dauerhaft aktiv (Kapitel 2).
   * `instant` = ohne großen Ausbruch direkt aktiv (z. B. beim Laden eines Spielstands).
   */
  erupt(instant = false): void {
    this.eruptTarget = 1;
    if (instant) this.eruptLevel = 1;
    else this.burst = 4.5;
  }

  /** Leuchtender Pfad vom Surfshop hinauf in den Krater (Keoni zeigt ihn). */
  showPath(on: boolean): void {
    if (on && !this.path) {
      const R = CONFIG.world.islandRadius;
      const a0 = (CONFIG.island.hutAngle * Math.PI) / 180;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const rn = CONFIG.island.hutDistance - t * (CONFIG.island.hutDistance - 0.16);
        const a = a0 + Math.sin(t * Math.PI * 5) * 0.12 * (1 - t * 0.5);
        const x = Math.cos(a) * rn * R;
        const z = Math.sin(a) * rn * R;
        pts.push(new THREE.Vector3(x, islandHeight(x, z) + 0.9, z));
      }
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe066').multiplyScalar(2), transparent: true, opacity: 0 });
      this.path = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.9, 6, false), mat);
      this.group.add(this.path);
    }
    this.pathFade = on ? 1 : 0;
  }

  private launchBomb(strength: number): void {
    const b = this.bombs.find((x) => !x.alive);
    if (!b) return;
    const H = CONFIG.world.volcanoHeight;
    const a = Math.random() * Math.PI * 2;
    const out = (20 + Math.random() * 45) * strength;
    b.alive = true;
    b.mesh.visible = true;
    b.mesh.position.set(Math.cos(a) * 6, H * 0.95, Math.sin(a) * 6);
    b.mesh.scale.setScalar((2.5 + Math.random() * 3.5) * Math.min(1.3, strength));
    b.vx = Math.cos(a) * out;
    b.vz = Math.sin(a) * out;
    b.vy = 45 + Math.random() * 45 * strength;
  }

  private updateEruption(dt: number): void {
    this.eruptLevel += (this.eruptTarget - this.eruptLevel) * Math.min(1, dt * 0.6);
    const lvl = this.eruptLevel;
    this.smokeMat.color.copy(this.smokeCalm).lerp(this.smokeAsh, lvl);
    // Großer Ausbruch: viele Brocken; danach ab und zu einer
    if (this.burst > 0) {
      this.burst -= dt;
      for (let i = 0; i < 3; i++) if (Math.random() < dt * 30) this.launchBomb(1.3);
    } else if (lvl > 0.5) {
      this.bombTimer -= dt;
      if (this.bombTimer <= 0) {
        this.bombTimer = 1.2 + Math.random() * 2.5;
        for (let i = 0; i < 3; i++) this.launchBomb(0.8);
      }
    }
    for (const b of this.bombs) {
      if (!b.alive) continue;
      b.vy -= 40 * dt;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;
      b.mesh.rotation.x += dt * 3;
      if (b.mesh.position.y < -5) {
        b.alive = false;
        b.mesh.visible = false;
      }
    }
    // Lava pulsiert heller
    const pulse = 1 + lvl * (0.35 + 0.25 * Math.sin(this.time * 5)) + (this.burst > 0 ? 0.6 : 0);
    for (const m of this.lavaMats) m.color.copy(this.lavaBase).multiplyScalar(pulse);
    if (this.path) {
      const mat = this.path.material as THREE.MeshBasicMaterial;
      mat.opacity += (this.pathFade * (0.7 + 0.3 * Math.sin(this.time * 4)) - mat.opacity) * Math.min(1, dt * 3);
      this.path.visible = mat.opacity > 0.01;
    }
  }

  /** Dschungel: viele runde Büsche auf den grünen Flächen (ein Draw-Call). */
  private buildBushes(rng: Rng): THREE.InstancedMesh {
    const R = CONFIG.world.islandRadius;
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const p = geo.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const f = 1 + (noise3(v.x * 1.8, v.y * 1.8, v.z * 1.8, 5) - 0.5) * 0.45;
      p.setXYZ(i, v.x * f, v.y * f * 0.8, v.z * f);
    }
    geo.computeVertexNormals();
    const max = 210;
    const mesh = new THREE.InstancedMesh(geo, scaleFog(toonMaterial('#ffffff', { gloss: 0.15 }), 0.35), max);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const greens = ['#2e9e44', '#3fb84f', '#1f8a3f', '#56c94a', '#27a35a'];
    let n = 0;
    for (let tries = 0; tries < 2000 && n < max; tries++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(0.42, 0.86) * R;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const h = islandHeight(x, z);
      const b = islandBiome(x, z, h, 0.1);
      if (b !== 'grass' && b !== 'jungle') continue;
      const hutA = (CONFIG.island.hutAngle * Math.PI) / 180;
      if (Math.hypot(x - Math.cos(hutA) * CONFIG.island.hutDistance * R, z - Math.sin(hutA) * CONFIG.island.hutDistance * R) < 12) continue;
      const size = rng.range(2.5, 6) * (b === 'jungle' ? 1.3 : 1);
      pos.set(x, h + size * 0.35, z);
      q.setFromEuler(new THREE.Euler(0, rng.range(0, Math.PI * 2), 0));
      s.set(size * rng.range(0.9, 1.3), size, size * rng.range(0.9, 1.3));
      m.compose(pos, q, s);
      mesh.setMatrixAt(n, m);
      mesh.setColorAt(n, new THREE.Color(rng.pick(greens)));
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }

  /** Brandung am Strand: helle Schaumlinien, die sanft vor- und zurücklaufen. */
  private buildShore(): THREE.ShaderMaterial {
    const R = CONFIG.world.islandRadius;
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uR: { value: R } },
      vertexShader: /* glsl */ `
        varying vec2 vP;
        void main() {
          vP = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uR;
        varying vec2 vP;
        void main() {
          float r = length(vP) / uR;
          float a = atan(vP.y, vP.x);
          float wob = sin(a * 23.0 + uTime * 0.7) * 0.004 + sin(a * 57.0 - uTime * 1.1) * 0.002;
          float swash = 0.012 * sin(uTime * 0.9 + a * 3.0);
          float line1 = 1.0 - smoothstep(0.0, 0.01, abs(r - (1.0 + swash + wob)));
          float line2 = (1.0 - smoothstep(0.0, 0.006, abs(r - (1.035 + swash * 0.6 + wob * 1.5)))) * 0.6;
          float wash = smoothstep(1.03, 0.99, r) * smoothstep(0.975, 0.995, r) * 0.35;
          float alpha = max(max(line1, line2), wash);
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(vec3(1.0), alpha * 0.9);
        }`,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.96 * R, 1.08 * R, 240, 1), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.18;
    ring.renderOrder = 2;
    this.group.add(ring);
    return mat;
  }

  /** Riffgrenze: Ring aus bunten Korallenfelsen. */
  private buildReef(rng: Rng): void {
    const count = 150;
    // Korallenfelsen: zerklüftet statt glatter Kugeln
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const gp = geo.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < gp.count; i++) {
      v.fromBufferAttribute(gp, i);
      const f = 1 + (noise3(v.x * 2.5, v.y * 2.5, v.z * 2.5, 9) - 0.5) * 0.6;
      gp.setXYZ(i, v.x * f, v.y * f, v.z * f);
    }
    geo.computeVertexNormals();
    const mat = toonMaterial('#ffffff', { gloss: 0.2 });
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
    this.time += dt;
    this.shore.uniforms.uTime!.value = this.time;
    this.hut.update(dt);
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

    this.updateEruption(dt);
    // Rauch steigt auf und wird größer (beim Ausbruch dunkler, dicker, schneller)
    const H = CONFIG.world.volcanoHeight;
    const lvl = this.eruptLevel;
    for (const s of this.smoke) {
      s.t = (s.t + dt * s.speed * (1 + lvl * 1.2)) % 1;
      const t = s.t;
      const size = (10 + t * 34) * (1 + lvl * 0.9);
      s.mesh.position.set(Math.sin(t * 3 + s.drift) * 8 + t * 60, H + 6 + t * 190, s.drift * 6 - t * 20);
      s.mesh.scale.set(size, size * 0.8, size);
    }
  }
}
