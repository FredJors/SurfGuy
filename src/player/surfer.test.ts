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
import { World } from '../world/World';
import { createPlayerStats } from './Progression';
import { JointRig } from './rig/CharacterRig';
import { Surfer } from './Surfer';

function setup() {
  const bus = new EventBus<GameEvents>();
  const assets = new AssetLoader();
  const world = new World(bus, assets);
  const input = new InputManager();
  input.gameplayEnabled = true;
  const held: Partial<InputState> = {};
  input.addSource({ read: () => held });
  const content = createRegistries();
  const stats = createPlayerStats(content, createDefaultSave());
  const surfer = new Surfer(bus, input, stats, world, new JointRig(assets.create('surfer')), assets.create('board'), content.poses);
  const camera = new THREE.PerspectiveCamera();
  const events: string[] = [];
  for (const e of ['waveCaught', 'jump', 'drawingStarted', 'landed', 'waveRideEnded'] as const) bus.on(e, () => events.push(e));
  surfer.reset(0, CONFIG.world.startDistance, Math.PI);
  surfer.startPlaying();
  world.waves.start(new Rng(7));
  const step = (seconds: number, until?: () => boolean) => {
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n; i++) {
      input.update();
      surfer.update(1 / 60);
      world.update(1 / 60, surfer.x, surfer.z, camera, surfer.vx, surfer.vz);
      if (until?.()) return true;
    }
    return false;
  };
  return { bus, world, input, held, surfer, step, events, content };
}

describe('Surfer', () => {
  it('liegt und paddelt unter der Tempo-Schwelle und steht darüber', () => {
    const { surfer, held, step } = setup();
    expect(surfer.state).toBe('Paddling');
    held.paddle = 1;
    step(1);
    expect(surfer.state).toBe('Paddling');
    expect(surfer.speed).toBeGreaterThan(1);
    expect(step(6, () => surfer.state === 'Standing')).toBe(true);
    expect(surfer.speed).toBeGreaterThanOrEqual(CONFIG.player.standSpeed - 0.1);
  });

  it('baut ohne Eingabe langsam Tempo ab und legt sich wieder hin', () => {
    const { surfer, held, step } = setup();
    held.paddle = 1;
    step(8);
    expect(surfer.state).toBe('Standing');
    held.paddle = 0;
    const v0 = surfer.speed;
    step(1);
    expect(surfer.speed).toBeLessThan(v0);
    expect(surfer.speed).toBeGreaterThan(v0 - 2);
    expect(step(20, () => surfer.state === 'Paddling')).toBe(true);
  });

  it('springt nur im Stehen', () => {
    const { surfer, input, step } = setup();
    input.triggerJump();
    step(0.2);
    expect(surfer.state).toBe('Paddling');
  });

  it('erwischt eine Welle mit Timing und bekommt einen Boost', () => {
    const { surfer, world, held, step, events } = setup();
    held.paddle = 1;
    step(6);
    world.waves.spawnSet(surfer.x, surfer.z, surfer.vx, surfer.vz);
    const before = surfer.speed;
    expect(step(40, () => surfer.rideWaveId !== null)).toBe(true);
    expect(events).toContain('waveCaught');
    expect(surfer.speed).toBeGreaterThan(before + 2);
    expect(surfer.speed).toBeGreaterThanOrEqual(CONFIG.catchWave.minRideSpeed - 0.01);
  });

  it('ohne Paddeln wird keine Welle erwischt', () => {
    const { surfer, world, held, step } = setup();
    held.paddle = 1;
    step(6);
    held.paddle = 0;
    world.waves.spawnSet(surfer.x, surfer.z, surfer.vx, surfer.vz);
    expect(step(30, () => surfer.rideWaveId !== null)).toBe(false);
  });

  it('Sprung → Zeichenfenster → Trick landet am Ende der Trick-Dauer', () => {
    const { surfer, input, held, step, events, content } = setup();
    held.paddle = 1;
    step(8);
    input.triggerJump();
    expect(step(0.5, () => surfer.state === 'Drawing')).toBe(true);
    expect(events).toContain('drawingStarted');
    const trick = content.tricks.get('board_spin');
    expect(surfer.startTrick(trick, 'good', 0.85, null)).toBe(true);
    expect(surfer.state).toBe('TrickPerforming');
    let t = 0;
    step(3, () => {
      t += 1 / 60;
      return surfer.state === 'Landing';
    });
    expect(Math.abs(t - trick.duration)).toBeLessThan(0.15);
    expect(events).toContain('landed');
  });

  it('wird am Riff zurückgedrängt', () => {
    const { surfer, world, held, step } = setup();
    const [ix, iz] = CONFIG.world.islandPosition;
    surfer.reset(ix, iz + CONFIG.world.boundaryRadius + 5, Math.PI);
    surfer.startPlaying();
    held.paddle = 1;
    step(8);
    expect(world.island.distanceTo(surfer.x, surfer.z)).toBeGreaterThan(CONFIG.world.boundaryRadius - 15);
  });
});
