import * as THREE from 'three';
import { CONFIG } from '../config/gameConfig';

let gradientMap: THREE.DataTexture | null = null;

/** Gemeinsame 3-Stufen-Verlaufstextur für weiches Toon-Shading. */
export function getToonGradient(): THREE.DataTexture {
  if (gradientMap) return gradientMap;
  const steps = [150, 205, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  gradientMap = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

export interface ToonOptions {
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  vertexColors?: boolean;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  fog?: boolean;
  flatShading?: boolean;
}

export function toonMaterial(color: THREE.ColorRepresentation, opts: ToonOptions = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: getToonGradient(),
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    vertexColors: opts.vertexColors ?? false,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    fog: opts.fog ?? true,
  });
}

const outlineMaterials = new Map<string, THREE.MeshBasicMaterial>();

/** Material für Konturen nach der „Inverted Hull“-Methode (funktioniert auch mit Skinning). */
export function outlineMaterial(thickness = CONFIG.render.outlineThickness, color = CONFIG.render.outlineColor): THREE.MeshBasicMaterial {
  const key = `${thickness}|${color}`;
  let mat = outlineMaterials.get(key);
  if (mat) return mat;
  mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uOutline = { value: thickness };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uOutline;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * uOutline;');
  };
  mat.customProgramCacheKey = () => `outline-${key}`;
  mat.userData.shared = true;
  outlineMaterials.set(key, mat);
  return mat;
}

/** Fügt einem Mesh (oder allen Meshes eines Objekts) eine Kontur hinzu. */
export function addOutline(root: THREE.Object3D, thickness?: number, color?: string): void {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !o.userData.isOutline && !o.userData.noOutline) meshes.push(o as THREE.Mesh);
  });
  for (const mesh of meshes) {
    let outline: THREE.Mesh;
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      const inst = mesh as THREE.InstancedMesh;
      const o = new THREE.InstancedMesh(mesh.geometry, outlineMaterial(thickness, color), inst.count);
      o.instanceMatrix = inst.instanceMatrix;
      o.frustumCulled = inst.frustumCulled;
      outline = o;
    } else if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
      const skinned = mesh as THREE.SkinnedMesh;
      const s = new THREE.SkinnedMesh(mesh.geometry, outlineMaterial(thickness, color));
      s.bind(skinned.skeleton, skinned.bindMatrix);
      outline = s;
    } else {
      outline = new THREE.Mesh(mesh.geometry, outlineMaterial(thickness, color));
    }
    outline.userData.isOutline = true;
    outline.castShadow = false;
    outline.receiveShadow = false;
    outline.renderOrder = mesh.renderOrder - 1;
    mesh.add(outline);
  }
}

/** Reduziert den Nebel auf einem Material (z. B. damit die Insel am Horizont sichtbar bleibt). */
export function scaleFog<T extends THREE.Material>(mat: T, factor: number): T {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <fog_fragment>',
      `#ifdef USE_FOG
        #ifdef FOG_EXP2
          float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
        #else
          float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
        #endif
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * ${factor.toFixed(3)} );
      #endif`,
    );
  };
  mat.customProgramCacheKey = () => `fogscale-${factor}-${mat.type}`;
  return mat;
}
