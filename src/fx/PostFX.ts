/**
 * Nachbearbeitung des Bildes:
 * - Kantenglättung über ein Multisample-Renderziel
 * - Leuchten (Bloom) nur für sehr helle Stellen (Sonne, Perlen, Lava, Funken)
 * - Farbabstimmung: etwas mehr Sättigung und Kontrast, leichte Wärme, Vignette
 * Lässt sich abschalten (schwache Geräte), dann wird direkt gerendert.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { CONFIG } from '../config/gameConfig';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uSaturation: { value: 1 },
    uContrast: { value: 1 },
    uVignette: { value: 0 },
    uWarmth: { value: 0 },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uVignette;
    uniform float uWarmth;
    uniform float uAspect;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 col = mix(vec3(l), c.rgb, uSaturation);
      col = (col - 0.5) * uContrast + 0.5;
      col += vec3(uWarmth, uWarmth * 0.4, -uWarmth * 0.6) * (1.0 - l);
      vec2 d = (vUv - 0.5) * vec2(uAspect, 1.0);
      col *= 1.0 - uVignette * smoothstep(0.35, 1.0, length(d) * 1.25);
      gl_FragColor = vec4(max(col, 0.0), c.a);
    }`,
};

export class PostFX {
  readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly grade: ShaderPass;
  enabled: boolean = CONFIG.render.postfx;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    const R = CONFIG.render;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: R.msaaSamples });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), R.bloom.strength, R.bloom.radius, R.bloom.threshold);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    const G = R.grade;
    this.grade.uniforms.uSaturation!.value = G.saturation;
    this.grade.uniforms.uContrast!.value = G.contrast;
    this.grade.uniforms.uVignette!.value = G.vignette;
    this.grade.uniforms.uWarmth!.value = G.warmth;
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.bloom.resolution.set((width * pixelRatio) / 2, (height * pixelRatio) / 2);
    this.grade.uniforms.uAspect!.value = width / height;
  }

  render(scene: THREE.Scene, camera: THREE.Camera, dt: number): void {
    if (this.enabled) this.composer.render(dt);
    else this.renderer.render(scene, camera);
  }
}
