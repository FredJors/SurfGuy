import * as THREE from 'three';
import { CONFIG } from '../config/gameConfig';

let gradientMap: THREE.DataTexture | null = null;

/**
 * Gemeinsame Verlaufstextur fürs Toon-Shading: drei Helligkeitsstufen mit weichen Übergängen
 * (wie gemalt, aber ohne harte Treppen).
 */
export function getToonGradient(): THREE.DataTexture {
  if (gradientMap) return gradientMap;
  const W = 64;
  const R = CONFIG.render.toon;
  const data = new Uint8Array(W * 4);
  for (let i = 0; i < W; i++) {
    const x = i / (W - 1);
    // Weiche Stufen: Schatten → Halbton → Licht
    const s1 = smooth(R.shadowEdge - R.softness, R.shadowEdge + R.softness, x);
    const s2 = smooth(R.lightEdge - R.softness, R.lightEdge + R.softness, x);
    const v = R.shadowLevel + (R.midLevel - R.shadowLevel) * s1 + (1 - R.midLevel) * s2;
    const b = Math.round(Math.min(1, v) * 255);
    data.set([b, b, b, 255], i * 4);
  }
  gradientMap = new THREE.DataTexture(data, W, 1, THREE.RGBAFormat);
  gradientMap.minFilter = THREE.LinearFilter;
  gradientMap.magFilter = THREE.LinearFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Zusatz für den Toon-Shader: Randlicht (Kanten leuchten im Himmelslicht) und ein weicher
 * Glanzpunkt der Sonne. Das macht Figuren plastisch, ohne den Comic-Look zu verlieren.
 */
function addShine(mat: THREE.MeshToonMaterial, rim: number, gloss: number): void {
  const R = CONFIG.render.toon;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = { value: rim };
    shader.uniforms.uRimColor = { value: new THREE.Color(R.rimColor) };
    shader.uniforms.uGloss = { value: gloss };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uRim;\nuniform vec3 uRimColor;\nuniform float uGloss;')
      .replace(
        '#include <opaque_fragment>',
        `{
          vec3 Vd = normalize(vViewPosition);
          float ndv = clamp(dot(normal, Vd), 0.0, 1.0);
          float rimF = smoothstep(0.55, 0.95, 1.0 - ndv);
          #if NUM_DIR_LIGHTS > 0
            vec3 Ld = directionalLights[0].direction;
            float lit = smoothstep(-0.15, 0.4, dot(normal, Ld));
            vec3 Hd = normalize(Ld + Vd);
            float spec = smoothstep(0.9, 0.96, dot(normal, Hd));
            outgoingLight += directionalLights[0].color * spec * uGloss * 0.12 * (0.35 + 0.65 * diffuseColor.rgb);
          #else
            float lit = 1.0;
          #endif
          outgoingLight += uRimColor * rimF * uRim * (0.45 + 0.55 * lit) * diffuseColor.rgb;
        }
        #include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => 'surfguy-toon';
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
  /** Randlicht-Stärke (0 = aus) */
  rim?: number;
  /** Glanzpunkt der Sonne (0 = matt, 1 = glänzend) */
  gloss?: number;
}

export function toonMaterial(color: THREE.ColorRepresentation, opts: ToonOptions = {}): THREE.MeshToonMaterial {
  const mat = new THREE.MeshToonMaterial({
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
  const R = CONFIG.render.toon;
  addShine(mat, opts.rim ?? R.rim, opts.gloss ?? R.gloss);
  return mat;
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

/** Schatten werfen/empfangen für alle Meshes eines Objekts (Konturen ausgenommen). */
export function enableShadows(root: THREE.Object3D, cast = true, receive = false): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.isOutline) return;
    m.castShadow = cast;
    m.receiveShadow = receive;
  });
}
