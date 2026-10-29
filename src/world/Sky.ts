/** Himmel mit Farbverlauf, Sonne und weichen Comic-Wolken. Folgt der Kamera. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config/gameConfig';
import type { Rng } from '../core/Rng';
import { toonMaterial } from '../fx/toon';

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

const skyFragment = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(uHorizon, uTop, pow(smoothstep(-0.02, 0.55, h), 0.8));
  float sd = max(dot(d, uSunDir), 0.0);
  col = mix(col, uSunColor, smoothstep(0.9975, 0.9985, sd));     // Sonnenscheibe
  col += uSunColor * pow(sd, 48.0) * 0.35;                         // Schein
  col = mix(col, uHorizon, smoothstep(0.02, -0.15, d.y));          // unter dem Horizont
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class Sky {
  readonly group = new THREE.Group();
  private readonly dome: THREE.Mesh;
  private readonly clouds = new THREE.Group();

  constructor(rng: Rng) {
    const sun = new THREE.Vector3(...CONFIG.light.sunDirection).normalize();
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(4000, 32, 16),
      new THREE.ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTop: { value: new THREE.Color(CONFIG.colors.skyTop) },
          uHorizon: { value: new THREE.Color(CONFIG.colors.skyHorizon) },
          uSunColor: { value: new THREE.Color(CONFIG.colors.sun) },
          uSunDir: { value: sun },
        },
      }),
    );
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.group.add(this.dome, this.clouds);
    this.buildClouds(rng);
  }

  private buildClouds(rng: Rng): void {
    const mat = toonMaterial('#ffffff', { fog: false, emissive: '#7fa8d6', emissiveIntensity: 0.35 });
    const geos: THREE.BufferGeometry[] = [];
    const count = 22;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rng.range(-0.1, 0.1);
      const dist = rng.range(1700, 2600);
      const y = rng.range(160, 520);
      const scale = rng.range(40, 85);
      const puffs = rng.int(4, 7);
      for (let p = 0; p < puffs; p++) {
        const g = new THREE.IcosahedronGeometry(1, 2);
        const s = scale * rng.range(0.55, 1.0);
        g.scale(s * 1.25, s * 0.75, s);
        g.translate(
          Math.cos(angle) * dist + (p - puffs / 2) * scale * 0.9 + rng.range(-10, 10),
          y + rng.range(-8, 18),
          Math.sin(angle) * dist + rng.range(-scale, scale),
        );
        geos.push(g);
      }
    }
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, mat);
    mesh.frustumCulled = false;
    this.clouds.add(mesh);
  }

  update(dt: number, camera: THREE.Camera): void {
    this.group.position.set(camera.position.x, 0, camera.position.z);
    this.clouds.rotation.y += dt * 0.004;
  }
}
