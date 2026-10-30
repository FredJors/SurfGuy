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
import { islandHeight } from './islandTerrain';
import { Crater } from './Crater';

export class World {
  readonly scene = new THREE.Scene();
  readonly waves: WaveSystem;
  readonly ocean: Ocean;
  readonly sky: Sky;
  readonly island: Island;
  /** Schiffswracks (Kapitel 1) */
  readonly wrecks: WreckSystem;
  /** Vulkan-Trümmer (Kapitel 2) */
  readonly debris: WreckSystem;
  /** Geysire rund um die Insel */
  readonly islandGeysers: GeyserSystem;
  readonly dolphins: DolphinSystem;
  /** Kratersee (Arena des Lava-Titanen) */
  readonly crater: Crater;
  /** Spieler ist im Kratersee */
  inCrater = false;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  /** Kapitel der Welt (1 = Paradies, 2 = Feuermeer) */
  chapter = 1;
  private themeFrom: ThemeColors | null = null;
  private themeTo: ThemeColors | null = null;
  private themeT = 1;
  private themeDur = 1;
  private readonly themeNow: ThemeColors = themeColors('paradise');

  constructor(bus: GameEventBus, assets: AssetLoader) {
    const c = CONFIG.colors;
    this.scene.fog = new THREE.Fog(c.fog, CONFIG.fog.near, CONFIG.fog.far);
    this.scene.background = new THREE.Color(c.skyHorizon);

    const hemi = new THREE.HemisphereLight(CONFIG.light.hemiSky, CONFIG.light.hemiGround, CONFIG.light.hemiIntensity);
    this.hemi = hemi;
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
    this.debris = new WreckSystem(assets, 777, 'debris', CONFIG.wrecks.debrisCount);
    this.debris.group.visible = false;
    this.islandGeysers = new GeyserSystem(bus, this.waves.field);
    this.dolphins = new DolphinSystem(bus, assets, this.waves.field);
    this.crater = new Crater(bus, assets, this.waves.field);
    this.scene.add(this.sky.group, this.ocean.mesh, this.island.group, this.wrecks.group, this.debris.group, this.islandGeysers.group, this.dolphins.group, this.crater.group);
  }

  /** Rampen am aktuellen Ort (Wracks, Vulkan-Trümmer oder Krater-Rampen). */
  get ramps(): WreckSystem {
    if (this.inCrater) return this.crater.ramps;
    return this.chapter >= 2 ? this.debris : this.wrecks;
  }

  /** Geysire am aktuellen Ort (Insel oder Krater). */
  get geysers(): GeyserSystem {
    return this.inCrater ? this.crater.geysers : this.islandGeysers;
  }

  /** In den Kratersee wechseln: Insel und Meer ausblenden, Lava-Stimmung, keine Wellen. */
  enterCrater(): void {
    this.inCrater = true;
    this.island.group.visible = false;
    this.wrecks.group.visible = this.debris.group.visible = false;
    this.islandGeysers.group.visible = false;
    this.dolphins.group.visible = false;
    this.crater.group.visible = true;
    this.waves.stop();
    this.waves.clear();
    this.setTheme('crater', 0);
  }

  /** Zurück aufs Meer (Kapitel-Stimmung wiederherstellen). */
  exitCrater(): void {
    if (!this.inCrater) return;
    this.inCrater = false;
    this.crater.group.visible = false;
    this.island.group.visible = true;
    this.islandGeysers.group.visible = true;
    this.dolphins.group.visible = true;
    this.setChapter(this.chapter, 0);
  }

  /**
   * Kapitel der Welt setzen: Rampen, Farbstimmung, Vulkan.
   * @param transition Sekunden für den Farbübergang (0 = sofort, z. B. beim Laden)
   */
  setChapter(chapter: number, transition = 0): void {
    this.chapter = chapter;
    this.wrecks.group.visible = chapter < 2;
    this.debris.group.visible = chapter >= 2;
    this.setTheme(chapter >= 2 ? 'fire' : 'paradise', transition);
    if (chapter >= 2) this.island.erupt(transition === 0);
  }

  /**
   * Farbstimmung wechseln (Himmel, Nebel, Licht, Wasser, Wolken), weich über `duration` Sekunden.
   * 'paradise' = Kapitel 1, 'fire' = Kapitel 2.
   */
  setTheme(name: keyof typeof CONFIG.themes, duration = 0): void {
    this.themeFrom = cloneTheme(this.themeNow);
    this.themeTo = themeColors(name);
    this.themeT = 0;
    this.themeDur = Math.max(0.0001, duration);
    if (duration <= 0) this.stepTheme(1);
  }

  private stepTheme(dt: number): void {
    if (!this.themeFrom || !this.themeTo || this.themeT >= 1) return;
    this.themeT = Math.min(1, this.themeT + dt / this.themeDur);
    const k = this.themeT * this.themeT * (3 - 2 * this.themeT);
    const n = this.themeNow;
    for (const key of Object.keys(n) as (keyof ThemeColors)[]) {
      if (key === 'sunIntensity') n.sunIntensity = this.themeFrom.sunIntensity + (this.themeTo.sunIntensity - this.themeFrom.sunIntensity) * k;
      else n[key].copy(this.themeFrom[key]).lerp(this.themeTo[key], k);
    }
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(n.fog);
    (this.scene.background as THREE.Color).copy(n.skyHorizon);
    this.sky.setColors(n.skyTop, n.skyHorizon, n.sun, n.cloud, n.cloudGlow);
    this.ocean.setColors({ deep: n.waterDeep, shallow: n.waterShallow, shadow: n.waterShadow, horizon: n.skyHorizon, sun: n.sun, fog: n.fog, foam: n.waterFoam });
    this.sun.color.copy(n.sun);
    this.sun.intensity = n.sunIntensity;
    this.hemi.color.copy(n.hemiSky);
    this.hemi.groundColor.copy(n.hemiGround);
  }

  /** Geländehöhe der Insel an (x, z) (unter Wasser negativ). */
  groundHeight(x: number, z: number): number {
    const [ix, iz] = CONFIG.world.islandPosition;
    return islandHeight(x - ix, z - iz);
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
    if (this.inCrater) return this.crater.boundaryPush(x, z);
    // Riff offen (Boss besiegt): kein Zurückdrängen mehr – am Strand steigt man ab und läuft
    if (this.reefOpen) return { ax: 0, az: 0, strength: 0 };
    const strength = 1 - smoothstep(W.boundaryRadius, W.boundaryRadius + W.boundaryWidth, d);
    const a = strength * CONFIG.world.boundaryPush;
    return { ax: (dx / d) * a, az: (dz / d) * a, strength };
  }

  update(dt: number, focusX: number, focusZ: number, camera: THREE.Camera, focusVx = 0, focusVz = 0): void {
    this.stepTheme(dt);
    this.waves.update(dt, focusX, focusZ, focusVx, focusVz);
    this.ocean.update(focusX, focusZ);
    this.sky.update(dt, camera);
    this.island.update(dt, camera.position.x, camera.position.z);
    if (this.inCrater) this.crater.update(dt);
    // Sonne folgt dem Spieler (für gleichmäßiges Licht)
    // Auf Schatten-Texel einrasten, damit Schattenkanten beim Fahren nicht flimmern
    const texel = (CONFIG.render.shadowExtent * 2) / this.sun.shadow.mapSize.x;
    const sx = Math.round(focusX / texel) * texel;
    const sz = Math.round(focusZ / texel) * texel;
    this.sun.target.position.set(sx, 0, sz);
    this.sun.position.set(...CONFIG.light.sunDirection).normalize().multiplyScalar(120).add(this.sun.target.position);
  }
}

type ThemeColors = {
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  sun: THREE.Color;
  fog: THREE.Color;
  cloud: THREE.Color;
  cloudGlow: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  waterDeep: THREE.Color;
  waterShallow: THREE.Color;
  waterShadow: THREE.Color;
  waterFoam: THREE.Color;
  sunIntensity: number;
};

function themeColors(name: keyof typeof CONFIG.themes): ThemeColors {
  const t = CONFIG.themes[name];
  return {
    skyTop: new THREE.Color(t.skyTop),
    skyHorizon: new THREE.Color(t.skyHorizon),
    sun: new THREE.Color(t.sun),
    fog: new THREE.Color(t.fog),
    cloud: new THREE.Color(t.cloud),
    cloudGlow: new THREE.Color(t.cloudGlow),
    hemiSky: new THREE.Color(t.hemiSky),
    hemiGround: new THREE.Color(t.hemiGround),
    waterDeep: new THREE.Color(t.waterDeep),
    waterShallow: new THREE.Color(t.waterShallow),
    waterShadow: new THREE.Color(t.waterShadow),
    waterFoam: new THREE.Color(t.waterFoam),
    sunIntensity: t.sunIntensity,
  };
}

function cloneTheme(t: ThemeColors): ThemeColors {
  const out = { ...t };
  for (const key of Object.keys(t) as (keyof ThemeColors)[]) {
    if (key !== 'sunIntensity') (out as Record<string, unknown>)[key] = t[key].clone();
  }
  return out;
}
