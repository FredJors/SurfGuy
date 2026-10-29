/**
 * Raus aufs offene Meer: Wellen-Durchstoß, Vulkan-Geysire, Delfin-Schulen.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AssetLoader } from '../assets/AssetLoader';
import { CONFIG } from '../config/gameConfig';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { Rng } from '../core/Rng';
import { createDefaultSave } from '../core/SaveGame';
import { createRegistries } from '../data';
import { InputManager, type InputState } from '../input/InputManager';
import { createPlayerStats } from '../player/Progression';
import { JointRig } from '../player/rig/CharacterRig';
import { Surfer } from '../player/Surfer';
import { PickupSystem } from './PickupSystem';
import { World } from './World';

function setup() {
  const bus = new EventBus<GameEvents>();
  const assets = new AssetLoader();
  const world = new World(bus, assets);
  const content = createRegistries();
  const stats = createPlayerStats(content, createDefaultSave());
  const input = new InputManager();
  input.gameplayEnabled = true;
  const held: Partial<InputState> = {};
  input.addSource({ read: () => held });
  const surfer = new Surfer(bus, input, stats, world, new JointRig(assets.create('surfer')), assets.create('board'), content.poses);
  const launches: string[] = [];
  bus.on('launched', (e) => launches.push(e.source));
  const camera = new THREE.PerspectiveCamera();
  const step = (seconds: number, onFrame?: () => boolean | void) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      input.update();
      surfer.update(1 / 60);
      world.update(1 / 60, surfer.x, surfer.z, camera, surfer.vx, surfer.vz);
      if (onFrame?.()) return true;
    }
    return false;
  };
  return { bus, assets, content, world, surfer, input, held, stats, launches, step };
}

/** Surfer weit draußen, Blick nach außen (+Z, weg von der Insel), stehend. */
function standOutward(surfer: Surfer, speed = 12): void {
  surfer.reset(0, 600, 0);
  surfer.fsm.start('Standing');
  surfer.speed = speed;
}

describe('Wellen-Durchstoß', () => {
  it('Welle von vorn wird angekündigt; Sprung im Fenster = Durchstoß mit Schub', () => {
    const { world, surfer, input, launches, step, stats } = setup();
    standOutward(surfer);
    world.waves.spawnCalled(surfer.x, surfer.z, surfer.vx, surfer.vz, 1.8, 2.5);
    let announced = false;
    const inWindow = step(6, () => {
      if (surfer.punchHint.visible) announced = true;
      return surfer.punchHint.inWindow;
    });
    expect(announced).toBe(true);
    expect(inWindow).toBe(true);
    const before = surfer.speed;
    input.triggerJump();
    step(1 / 60);
    expect(launches).toEqual(['punch']);
    expect(surfer.isAirborne).toBe(true);
    expect(surfer.speed).toBeGreaterThan(before + CONFIG.punch.boost * 0.8);
    expect(surfer.overdrive).toBeGreaterThan(0);
    // Nach der Landung ist man noch schnell unterwegs (weg von der Insel)
    const r0 = Math.hypot(surfer.x, surfer.z);
    step(3);
    expect(Math.hypot(surfer.x, surfer.z) - r0).toBeGreaterThan(stats.get('cruiseSpeed') * 3);
  });

  it('ohne Welle von vorn bleibt es ein normaler Sprung', () => {
    const { surfer, input, launches, step, bus } = setup();
    const jumps: number[] = [];
    bus.on('jump', (e) => jumps.push(e.airtime));
    standOutward(surfer);
    step(0.5);
    input.triggerJump();
    step(1 / 60);
    expect(launches).toEqual([]);
    expect(jumps.length).toBe(1);
  });

  it('Welle von hinten (Richtung Insel fahren) zählt nicht als Durchstoß', () => {
    const { world, surfer, step } = setup();
    surfer.reset(0, 600, Math.PI); // Blick zur Insel
    surfer.fsm.start('Standing');
    surfer.speed = 8;
    world.waves.spawnCalled(surfer.x, surfer.z, surfer.vx, surfer.vz, 1.8, 2.5);
    let seen = false;
    step(5, () => {
      if (surfer.punchHint.visible) seen = true;
    });
    expect(seen).toBe(false);
  });
});

describe('Vulkan-Geysire', () => {
  it('liegen rund um die Insel knapp außerhalb des Riffs und brechen regelmäßig aus', () => {
    const { world, bus } = setup();
    const G = CONFIG.geysers;
    expect(world.geysers.geysers.length).toBe(G.count);
    for (const g of world.geysers.geysers) {
      const r = Math.hypot(g.x, g.z);
      expect(r).toBeGreaterThan(CONFIG.world.boundaryRadius + CONFIG.world.boundaryWidth);
      expect(r).toBeLessThanOrEqual(G.ringMax + 1);
    }
    let erupted = 0;
    bus.on('geyserErupted', () => erupted++);
    for (let i = 0; i < 60 * 10; i++) world.geysers.update(1 / 60, null);
    expect(erupted).toBeGreaterThanOrEqual(G.count);
  });

  it('erfasst den Spieler nur beim Ausbruch und wirft ihn weit nach außen', () => {
    const { world, surfer, launches, step } = setup();
    const g = world.geysers.geysers[0]!;
    surfer.reset(g.x, g.z, 0);
    surfer.fsm.start('Standing');
    surfer.speed = 6;
    // Warten, bis der Geysir den Spieler erfasst
    let caught = null as ReturnType<typeof world.geysers.update>;
    for (let i = 0; i < 60 * 12 && !caught; i++) {
      surfer.x = g.x;
      surfer.z = g.z;
      caught = world.geysers.update(1 / 60, surfer);
      if (caught) expect(caught.phase).toBe('erupt');
    }
    expect(caught).toBe(g);
    const startR = Math.hypot(surfer.x, surfer.z);
    const G = CONFIG.geysers;
    surfer.launch({ vy: G.launchVy, vx: g.outX * G.launchOut, vz: g.outZ * G.launchOut, heading: Math.atan2(g.outX, g.outZ), source: 'geyser', power: 1.8 });
    expect(launches).toEqual(['geyser']);
    let maxY = 0;
    step(6, () => {
      maxY = Math.max(maxY, surfer.y);
      return !surfer.isAirborne && surfer.fsm.is('Landing', 'Standing');
    });
    expect(maxY).toBeGreaterThan(12);
    expect(Math.hypot(surfer.x, surfer.z) - startR).toBeGreaterThan(80);
    // Perlenbogen folgt der Flugbahn
    const pts = world.geysers.arcPoints(g, 6);
    expect(Math.max(...pts.map((p) => p.y))).toBeGreaterThan(10);
  });
});

describe('Delfin-Schulen', () => {
  it('Mitschwimmen zieht mit, gibt Tempo über dem Höchsttempo und Perlen', () => {
    const { bus, assets, content, world, stats } = setup();
    const pickups = new PickupSystem(bus, assets, content, world.waves.field);
    const dolphins = world.dolphins;
    let rideEvents = 0;
    let pearls = 0;
    bus.on('pearlCollected', (e) => (pearls += e.value));
    bus.on('dolphinRide', (e) => {
      if (e.active) rideEvents++;
    });
    const rider = { x: 0, z: 500, speed: 12, overdrive: 0, forwardX: 0, forwardZ: 1, isAirborne: false };
    dolphins.start(new Rng(3));
    dolphins.spawn(rider.x, rider.z);
    expect(dolphins.schoolActive).toBe(true);
    const maxSpeed = stats.get('maxSpeed');
    let maxRiderSpeed = 0;
    for (let i = 0; i < 60 * 8; i++) {
      // Der Spieler lenkt zur Schule (Mitte der Delfine) und fährt nach außen
      const pos = dolphins.group.children.filter((c) => c.visible).map((c) => c.position);
      if (pos.length) {
        const cx = pos.reduce((a, p) => a + p.x, 0) / pos.length;
        rider.x += Math.max(-1, Math.min(1, cx - rider.x)) * 10 * (1 / 60);
      }
      rider.z += rider.speed * (1 / 60);
      rider.overdrive = Math.max(0, rider.overdrive - CONFIG.player.overdriveDecay / 60);
      dolphins.update(1 / 60, rider, maxSpeed, pickups);
      pickups.update(1 / 60, i / 60, { x: rider.x, y: 1, z: rider.z, magnet: 2.3 });
      maxRiderSpeed = Math.max(maxRiderSpeed, rider.speed);
    }
    expect(rideEvents).toBeGreaterThan(0);
    expect(maxRiderSpeed).toBeGreaterThan(CONFIG.dolphins.speed);
    expect(maxRiderSpeed).toBeLessThanOrEqual(maxSpeed + CONFIG.dolphins.rideBonus + 0.01);
    expect(pearls).toBeGreaterThan(0);
  });

  it('tauchen nur in der passenden Entfernung zur Insel auf und verschwinden wieder', () => {
    const { world } = setup();
    const dolphins = world.dolphins;
    dolphins.start(new Rng(4));
    const tooClose = { x: 0, z: 200, speed: 0, overdrive: 0, forwardX: 0, forwardZ: 1, isAirborne: false };
    for (let i = 0; i < 60 * 30; i++) dolphins.update(1 / 60, tooClose, 22, null);
    expect(dolphins.schoolActive).toBe(false);
    const ok = { x: 0, z: 500, speed: 0, overdrive: 0, forwardX: 0, forwardZ: 1, isAirborne: false };
    let spawned = false;
    for (let i = 0; i < 60 * 30 && !spawned; i++) {
      dolphins.update(1 / 60, ok, 22, null);
      spawned = dolphins.schoolActive;
    }
    expect(spawned).toBe(true);
    // Spieler bleibt stehen → Schule schwimmt davon und taucht ab
    let gone = false;
    for (let i = 0; i < 60 * 40 && !gone; i++) {
      dolphins.update(1 / 60, ok, 22, null);
      gone = !dolphins.schoolActive;
    }
    expect(gone).toBe(true);
  });
});
