import * as THREE from 'three';

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#7fd3ff');
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3, 8);
camera.lookAt(0, 0, 0);

const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshToonMaterial({ color: '#ff7a3d' }));
scene.add(box, new THREE.HemisphereLight('#ffffff', '#3a6ea5', 1.2));

renderer.setAnimationLoop((t) => {
  box.rotation.y = t / 1000;
  renderer.render(scene, camera);
});
