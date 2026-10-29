import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AssetLoader } from '../assets/AssetLoader';
import { CONFIG } from '../config/gameConfig';
import { EventBus } from '../core/EventBus';
import type { GameEvents, SurferStateId } from '../core/events';
import { createDefaultSave } from '../core/SaveGame';
import { createRegistries } from '../data';
import { InputManager } from '../input/InputManager';
import { World } from '../world/World';
import { createPlayerStats } from './Progression';
import { JointRig } from './rig/CharacterRig';
import { Surfer } from './Surfer';

function setup() {
  const bus = new EventBus<GameEvents>();
  const assets = new AssetLoader();
  const world = new World(bus, assets);
  const content = createRegistries();
  const stats = createPlayerStats(content, createDefaultSave());
  const input = new InputManager();
  input.gameplayEnabled = true;
  const surfer = new Surfer(bus, input, stats, world, new JointRig(assets.create('surfer')), assets.create('board'), content.poses);
  surfer.reset(0, 600, 0);
  surfer.fsm.start('Standing');
  surfer.speed = 14;
  const states: SurferStateId[] = [];
  bus.on('surferStateChanged', (e) => states.push(e.to));
  const camera = new THREE.PerspectiveCamera();
  const step = (seconds: number, until?: () => boolean) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      surfer.update(1 / 60);
      world.update(1 / 60, surfer.x, surfer.z, camera);
      if (until?.()) return true;
    }
    return false;
  };
  return { content, surfer, states, step };
}

describe('Trick-Kombos', () => {
  it('großer Sprung: nach dem ersten Trick geht das Zeichenfenster erneut auf', () => {
    const { content, surfer, states, step } = setup();
    surfer.launch({ vy: 20, source: 'ramp' });
    expect(step(1, () => surfer.fsm.is('Drawing'))).toBe(true);
    expect(surfer.startTrick(content.tricks.get('board_spin'), 'good', 0.9, null)).toBe(true);
    // Trick läuft durch, Surfer ist danach noch in der Luft
    expect(step(3, () => surfer.fsm.is('Airborne'))).toBe(true);
    expect(surfer.y).toBeGreaterThan(surfer.waterHeight + 2);
    // … und darf noch einen Trick zeichnen
    expect(step(1, () => surfer.fsm.is('Drawing'))).toBe(true);
    expect(surfer.startTrick(content.tricks.get('salto'), 'perfect', 0.95, null)).toBe(true);
    expect(surfer.trickChain).toBe(2);
    expect(step(6, () => surfer.fsm.is('Standing', 'Paddling'))).toBe(true);
    expect(states.filter((s) => s === 'TrickPerforming').length).toBe(2);
  });

  it('kleiner Sprung: Trick endet mit der Landung, keine Kombo', () => {
    const { content, surfer, states, step } = setup();
    surfer.launch({ vy: 7, source: 'ramp' });
    expect(step(1, () => surfer.fsm.is('Drawing'))).toBe(true);
    surfer.startTrick(content.tricks.get('board_spin'), 'good', 0.9, null);
    expect(step(3, () => surfer.fsm.is('Landing'))).toBe(true);
    expect(states.filter((s) => s === 'Drawing').length).toBe(1);
    expect(surfer.trickChain).toBe(1);
  });

  it('Zeichenzeit ist begrenzt (etwas kürzer als früher)', () => {
    expect(CONFIG.trick.maxDrawTime).toBeLessThanOrEqual(4);
    expect(CONFIG.trick.slowMotion).toBeGreaterThan(0.15);
  });
});
