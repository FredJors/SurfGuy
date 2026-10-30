/**
 * Schneefall (Kapitel 3): ein Würfel aus Flocken, der mit der Kamera wandert. Die Flocken fallen
 * und taumeln im Shader und tauchen am anderen Ende des Würfels wieder auf – ein Draw-Call.
 */
import * as THREE from 'three';
import { Rng } from '../core/Rng';

export class Snowfall {
  readonly points: THREE.Points;
  private readonly mat: THREE.ShaderMaterial;

  constructor(count = 1600, size = 80) {
    const rng = new Rng(808);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos.set([rng.range(0, size), rng.range(0, size * 0.5), rng.range(0, size)], i * 3);
      seed[i] = rng.range(0, 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new THREE.Vector3() },
        uSize: { value: new THREE.Vector3(size, size * 0.5, size) },
        uScale: { value: 300 },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        uniform vec3 uCenter;
        uniform vec3 uSize;
        uniform float uScale;
        varying float vFade;
        void main() {
          vec3 p = position;
          // fallen und seitlich taumeln
          p.y -= uTime * (1.6 + aSeed * 1.4);
          p.x += sin(uTime * 0.9 + aSeed * 40.0) * 1.2 + uTime * 0.8;
          p.z += cos(uTime * 0.7 + aSeed * 23.0) * 1.2;
          // Würfel um die Kamera: Position relativ zum Mittelpunkt einrasten
          vec3 rel = mod(p - uCenter + uSize * 0.5, uSize) - uSize * 0.5;
          vec3 world = uCenter + rel;
          world.y = uCenter.y + rel.y + uSize.y * 0.2;
          vec4 mv = viewMatrix * vec4(world, 1.0);
          float dist = -mv.z;
          vFade = smoothstep(0.5, 3.0, dist) * (1.0 - smoothstep(uSize.x * 0.35, uSize.x * 0.5, dist));
          gl_PointSize = (0.07 + aSeed * 0.08) * uScale / max(dist, 0.1);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vFade;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.15, length(d)) * vFade;
          if (a < 0.02) discard;
          gl_FragColor = vec4(vec3(0.93, 0.97, 1.0), a * 0.9);
        }`,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.points.visible = false;
  }

  /** Bildschirmhöhe in Pixeln (für die Flockengröße). */
  setViewport(heightPx: number, fovDeg: number): void {
    this.mat.uniforms.uScale!.value = heightPx / (2 * Math.tan(((fovDeg * Math.PI) / 180) / 2));
  }

  update(dt: number, camera: THREE.Camera): void {
    if (!this.points.visible) return;
    this.mat.uniforms.uTime!.value += dt;
    (this.mat.uniforms.uCenter!.value as THREE.Vector3).copy(camera.position);
  }
}
