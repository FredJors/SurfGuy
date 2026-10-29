/**
 * Rendert 3D-Objekte einmalig in ein Bild (Data-URL) – z. B. Monster-Bilder im Bestiarium.
 * Nutzt den vorhandenen Renderer und ein Render-Target (kein zweiter WebGL-Kontext).
 */
import * as THREE from 'three';

export interface ThumbnailOptions {
  size?: number;
  /** Nur dunkle Silhouette (für noch unbekannte Monster) */
  silhouette?: boolean;
  /** Drehung des Objekts um die Hochachse (rad) */
  yaw?: number;
}

export class ThumbnailRenderer {
  private readonly cache = new Map<string, string>();

  constructor(private readonly renderer: THREE.WebGLRenderer) {}

  get(key: string, build: () => THREE.Object3D, opts: ThumbnailOptions = {}): string {
    const fullKey = `${key}|${opts.silhouette ? 's' : 'c'}|${opts.size ?? 256}`;
    const cached = this.cache.get(fullKey);
    if (cached) return cached;
    const url = this.render(build(), opts);
    this.cache.set(fullKey, url);
    return url;
  }

  private render(object: THREE.Object3D, opts: ThumbnailOptions): string {
    const size = opts.size ?? 256;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#6aa6e0', 1.4));
    const sun = new THREE.DirectionalLight('#fff6d5', 2.2);
    sun.position.set(3, 6, 5);
    scene.add(sun);
    object.rotation.y = opts.yaw ?? -0.6;
    scene.add(object);
    if (opts.silhouette) scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: '#2a3158' });

    // Kamera so setzen, dass das Objekt das Bild füllt
    const box = new THREE.Box3().setFromObject(object);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 1000);
    const dist = (sphere.radius / Math.sin((32 * Math.PI) / 360)) * 0.78;
    camera.position.copy(sphere.center).add(new THREE.Vector3(0, 0.35, 1).normalize().multiplyScalar(dist));
    camera.lookAt(sphere.center);

    const target = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const prevTarget = this.renderer.getRenderTarget();
    const prevColor = this.renderer.getClearColor(new THREE.Color());
    const prevAlpha = this.renderer.getClearAlpha();
    this.renderer.setRenderTarget(target);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(scene, camera);
    const pixels = new Uint8Array(size * size * 4);
    this.renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
    this.renderer.setRenderTarget(prevTarget);
    this.renderer.setClearColor(prevColor, prevAlpha);
    target.dispose();
    scene.overrideMaterial?.dispose();

    // In ein Canvas kopieren (WebGL liefert die Zeilen von unten nach oben)
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      img.data.set(pixels.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
  }
}
