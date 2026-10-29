/** Fasst Szene, Licht, Nebel, Himmel, Meer, Wellen und Insel zusammen. */
import * as THREE from 'three';
import type { AssetLoader } from '../assets/AssetLoader';
import { CONFIG } from '../config/gameConfig';
import type { GameEventBus } from '../core/events';
import { Rng } from '../core/Rng';
import { smoothstep } from '../core/math';
import { Island } from './Island';
import { Ocean } from './Ocean';
import { Sky } from './Sky';
import { WaveSystem } from './WaveSystem';

export class World {
  readonly scene = new THREE.Scene();
  readonly waves: WaveSystem;
  readonly ocean: Ocean;
  readonly sky: Sky;
  readonly island: Island;
  readonly sun: THREE.DirectionalLight;

  constructor(bus: GameEventBus, assets: AssetLoader) {
    const c = CONFIG.colors;
    this.scene.fog = new THREE.Fog(c.fog, CONFIG.fog.near, CONFIG.fog.far);
    this.scene.background = new THREE.Color(c.skyHorizon);

    const hemi = new THREE.HemisphereLight(CONFIG.light.hemiSky, CONFIG.light.hemiGround, CONFIG.light.hemiIntensity);
    this.sun = new THREE.DirectionalLight(c.sun, CONFIG.light.sunIntensity);
    this.sun.position.set(...CONFIG.light.sunDirection).multiplyScalar(100);
    this.scene.add(hemi, this.sun, this.sun.target);

    this.waves = new WaveSystem(bus, new Rng(1));
    this.ocean = new Ocean(this.waves.field);
    this.sky = new Sky(new Rng(77));
    this.island = new Island(assets);
    this.scene.add(this.sky.group, this.ocean.mesh, this.island.group);
  }

  /** Wasserhöhe an (x, z). */
  heightAt(x: number, z: number): number {
    return this.waves.field.heightAt(x, z);
  }

  /** Abstoßung an der Riff-/Sturmgrenze: Beschleunigung weg von der Insel (m/s²) und Stärke 0..1. */
  boundaryPush(x: number, z: number): { ax: number; az: number; strength: number } {
    const [ix, iz] = CONFIG.world.islandPosition;
    const dx = x - ix;
    const dz = z - iz;
    const d = Math.hypot(dx, dz) || 1;
    const outer = CONFIG.world.boundaryRadius + CONFIG.world.boundaryWidth;
    const strength = 1 - smoothstep(CONFIG.world.boundaryRadius, outer, d);
    const a = strength * CONFIG.world.boundaryPush;
    return { ax: (dx / d) * a, az: (dz / d) * a, strength };
  }

  update(dt: number, focusX: number, focusZ: number, camera: THREE.Camera): void {
    this.waves.update(dt, focusX, focusZ);
    this.ocean.update(focusX, focusZ);
    this.sky.update(dt, camera);
    this.island.update(dt, camera.position.x, camera.position.z);
    // Sonne folgt dem Spieler (für gleichmäßiges Licht)
    this.sun.target.position.set(focusX, 0, focusZ);
    this.sun.position.set(...CONFIG.light.sunDirection).multiplyScalar(100).add(this.sun.target.position);
  }
}
