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
import { WreckSystem } from './Wrecks';
import { GeyserSystem } from './Geysers';
import { DolphinSystem } from './Dolphins';

export class World {
  readonly scene = new THREE.Scene();
  readonly waves: WaveSystem;
  readonly ocean: Ocean;
  readonly sky: Sky;
  readonly island: Island;
  readonly wrecks: WreckSystem;
  readonly geysers: GeyserSystem;
  readonly dolphins: DolphinSystem;
  readonly sun: THREE.DirectionalLight;

  constructor(bus: GameEventBus, assets: AssetLoader) {
    const c = CONFIG.colors;
    this.scene.fog = new THREE.Fog(c.fog, CONFIG.fog.near, CONFIG.fog.far);
    this.scene.background = new THREE.Color(c.skyHorizon);

    const hemi = new THREE.HemisphereLight(CONFIG.light.hemiSky, CONFIG.light.hemiGround, CONFIG.light.hemiIntensity);
    this.sun = new THREE.DirectionalLight(c.sun, CONFIG.light.sunIntensity);
    this.sun.position.set(...CONFIG.light.sunDirection).multiplyScalar(100);
    // Schatten nur rund um den Spieler (der Lichtkegel folgt ihm, siehe update)
    const ext = CONFIG.render.shadowExtent;
    const cam = this.sun.shadow.camera;
    cam.left = -ext;
    cam.right = ext;
    cam.top = ext;
    cam.bottom = -ext;
    cam.near = 1;
    cam.far = 260;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(hemi, this.sun, this.sun.target);

    this.waves = new WaveSystem(bus, new Rng(1));
    this.ocean = new Ocean(this.waves.field);
    this.sky = new Sky(new Rng(77));
    this.island = new Island(assets);
    this.wrecks = new WreckSystem(assets);
    this.geysers = new GeyserSystem(bus, this.waves.field);
    this.dolphins = new DolphinSystem(bus, assets, this.waves.field);
    this.scene.add(this.sky.group, this.ocean.mesh, this.island.group, this.wrecks.group, this.geysers.group, this.dolphins.group);
  }

  /** Wasserhöhe an (x, z). */
  heightAt(x: number, z: number): number {
    return this.waves.field.heightAt(x, z);
  }

  /** Riff offen (Boss besiegt): dann hält nur noch der Strand der Insel auf. */
  reefOpen = false;

  /** Abstoßung an der Riff-/Sturmgrenze bzw. am Strand: Beschleunigung weg von der Insel (m/s²) und Stärke 0..1. */
  boundaryPush(x: number, z: number): { ax: number; az: number; strength: number } {
    const [ix, iz] = CONFIG.world.islandPosition;
    const dx = x - ix;
    const dz = z - iz;
    const d = Math.hypot(dx, dz) || 1;
    const W = CONFIG.world;
    const inner = this.reefOpen ? W.islandRadius + W.shoreMargin : W.boundaryRadius;
    const strength = 1 - smoothstep(inner, inner + (this.reefOpen ? W.shoreWidth : W.boundaryWidth), d);
    const a = strength * CONFIG.world.boundaryPush;
    return { ax: (dx / d) * a, az: (dz / d) * a, strength };
  }

  update(dt: number, focusX: number, focusZ: number, camera: THREE.Camera, focusVx = 0, focusVz = 0): void {
    this.waves.update(dt, focusX, focusZ, focusVx, focusVz);
    this.ocean.update(focusX, focusZ);
    this.sky.update(dt, camera);
    this.island.update(dt, camera.position.x, camera.position.z);
    // Sonne folgt dem Spieler (für gleichmäßiges Licht)
    // Auf Schatten-Texel einrasten, damit Schattenkanten beim Fahren nicht flimmern
    const texel = (CONFIG.render.shadowExtent * 2) / this.sun.shadow.mapSize.x;
    const sx = Math.round(focusX / texel) * texel;
    const sz = Math.round(focusZ / texel) * texel;
    this.sun.target.position.set(sx, 0, sz);
    this.sun.position.set(...CONFIG.light.sunDirection).normalize().multiplyScalar(120).add(this.sun.target.position);
  }
}
