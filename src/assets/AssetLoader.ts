/**
 * Lädt Modelle über ihre id aus dem Manifest. Fehlt eine Datei (oder schlägt das Laden fehl),
 * wird automatisch der Platzhalter aus Grundformen gebaut.
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ASSET_MANIFEST, type AssetEntry } from './manifest';
import { PLACEHOLDERS, type PlaceholderParams } from './placeholders';

// Alle Modelldateien im Ordner models/ werden automatisch gefunden und eingebettet.
const MODEL_URLS = import.meta.glob('./models/*.{glb,gltf}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function urlForFile(file: string): string | undefined {
  return MODEL_URLS[`./models/${file}`];
}

export class AssetLoader {
  private readonly entries = new Map<string, AssetEntry>();
  private readonly loaded = new Map<string, GLTF>();

  constructor(manifest: readonly AssetEntry[] = ASSET_MANIFEST) {
    for (const e of manifest) this.entries.set(e.id, e);
  }

  entry(id: string): AssetEntry {
    const e = this.entries.get(id);
    if (!e) throw new Error(`[Assets] unbekannte Asset-id "${id}"`);
    return e;
  }

  /** Lädt alle vorhandenen Modelldateien. Fehler werden geloggt; dann greift der Platzhalter. */
  async preload(onProgress?: (done: number, total: number) => void): Promise<void> {
    const loader = new GLTFLoader();
    const jobs = [...this.entries.values()].filter((e) => urlForFile(e.file));
    let done = 0;
    await Promise.all(
      jobs.map(async (e) => {
        try {
          const gltf = await loader.loadAsync(urlForFile(e.file)!);
          this.loaded.set(e.id, gltf);
        } catch (err) {
          console.warn(`[Assets] "${e.file}" konnte nicht geladen werden – nutze Platzhalter.`, err);
        } finally {
          onProgress?.(++done, jobs.length);
        }
      }),
    );
  }

  /** true, wenn für diese id ein echtes Modell geladen ist. */
  hasModel(id: string): boolean {
    return this.loaded.has(id);
  }

  gltf(id: string): GLTF | undefined {
    return this.loaded.get(id);
  }

  /** Erzeugt eine neue Instanz (echtes Modell oder Platzhalter). */
  create(id: string, params: PlaceholderParams = {}): THREE.Object3D {
    const entry = this.entry(id);
    const gltf = this.loaded.get(id);
    if (gltf) {
      const root = new THREE.Group();
      const model = cloneSkinned(gltf.scene);
      const t = entry.transform;
      if (t?.scale) model.scale.setScalar(t.scale);
      if (t?.rotationY) model.rotation.y = THREE.MathUtils.degToRad(t.rotationY);
      if (t?.offset) model.position.set(...t.offset);
      model.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.frustumCulled = !(o as THREE.SkinnedMesh).isSkinnedMesh;
      });
      root.add(model);
      root.userData.assetId = id;
      root.userData.isPlaceholder = false;
      return root;
    }
    const build = PLACEHOLDERS[entry.placeholder];
    if (!build) throw new Error(`[Assets] kein Platzhalter "${entry.placeholder}" für "${id}"`);
    const obj = build(params);
    obj.userData.assetId = id;
    obj.userData.isPlaceholder = true;
    return obj;
  }
}
