import * as THREE from 'three';
import { AssetLoader } from './assets/AssetLoader';
import { CONFIG } from './config/gameConfig';
import { EventBus } from './core/EventBus';
import type { GameEvents } from './core/events';
import { Rng } from './core/Rng';
import { addOutline } from './fx/toon';
import { World } from './world/World';

const app = document.getElementById('app')!;
document.body.style.margin = '0';
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const bus = new EventBus<GameEvents>();
const assets = new AssetLoader();
await assets.preload();
const world = new World(bus, assets);
const camera = new THREE.PerspectiveCamera(CONFIG.render.fov, window.innerWidth / window.innerHeight, 0.1, 6000);

const px = 0, pz = CONFIG.world.startDistance;
const surfer = assets.create('surfer');
const board = assets.create('board');
addOutline(surfer); addOutline(board);
const rig = new THREE.Group(); rig.add(board, surfer); world.scene.add(rig);
const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'behind';
world.waves.start(new Rng(5));
for (let i = 0; i < 300; i++) world.update(0.1, px, pz, camera);
let t = 0;
renderer.setAnimationLoop(() => {
  t += 1 / 60;
  world.update(1 / 60, px, pz, camera);
  const h = world.heightAt(px, pz);
  rig.position.set(px, h, pz);
  rig.rotation.y = Math.PI; // toward island (-Z)
  if (view === 'behind') { camera.position.set(px, h + 3.6, pz + 8.5); camera.lookAt(px, h + 1.3, pz - 5); }
  else if (view === 'side') { camera.position.set(px + 4, h + 1.2, pz + 1); camera.lookAt(px, h + 0.8, pz); }
  else if (view === 'top') { camera.position.set(px + 60, 70, pz + 60); camera.lookAt(px, 0, pz - 40); }
  renderer.render(world.scene, camera);
});
