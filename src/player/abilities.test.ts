import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AssetLoader } from '../assets/AssetLoader';
import { CONFIG } from '../config/gameConfig';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { Rng } from '../core/Rng';
import { createRunState } from '../core/RunState';
import { createDefaultSave } from '../core/SaveGame';
import { createRegistries, validateContent } from '../data';
import type { Effects } from '../fx/Effects';
import { InputManager, type InputState } from '../input/InputManager';
import { MONSTER_BEHAVIORS } from '../monsters/behaviors';
import { MonsterSystem } from '../monsters/MonsterSystem';
import { World } from '../world/World';
import { ABILITY_EFFECTS } from './abilityEffects';
import { AbilitySystem } from './AbilitySystem';
import { createPlayerStats } from './Progression';
import { JointRig } from './rig/CharacterRig';
import { Surfer } from './Surfer';

const noEffects = { splash() {}, hitSparks() {}, bubbles() {}, sparkle() {}, particles: { emit() {} } } as unknown as Effects;

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
  surfer.reset(0, CONFIG.world.startDistance, Math.PI);
  surfer.startPlaying();
  const run = createRunState(1, 3);
  const abilities = new AbilitySystem();
  const ctx = { surfer, world, run, stats, bus, effects: noEffects };
  const camera = new THREE.PerspectiveCamera();
  const step = (seconds: number, until?: () => boolean) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      input.update();
      surfer.update(1 / 60);
      world.update(1 / 60, surfer.x, surfer.z, camera, surfer.vx, surfer.vz);
      abilities.update(1 / 60);
      if (until?.()) return true;
    }
    return false;
  };
  return { bus, content, world, surfer, run, abilities, ctx, held, step, assets, stats, camera };
}

describe('Aktive Fähigkeiten', () => {
  it('alle aktiven Fähigkeiten verweisen auf vorhandene Effekte', () => {
    expect(validateContent(createRegistries(), Object.keys(MONSTER_BEHAVIORS), Object.keys(ABILITY_EFFECTS))).toEqual([]);
  });

  it('Gezeiten-Sprint: aus dem Liegen direkt aufs Brett, dann Abklingzeit', () => {
    const { content, surfer, abilities, ctx, step } = setup();
    abilities.setup([content.abilities.get('tidal_dash')]);
    step(0.2);
    expect(surfer.state).toBe('Paddling');
    expect(abilities.trigger(0, ctx)).toBe(true);
    expect(surfer.state).toBe('Standing');
    expect(surfer.speed).toBeGreaterThan(CONFIG.player.standSpeed + 5);
    expect(abilities.trigger(0, ctx)).toBe(false); // Abklingzeit
    step(content.abilities.get('tidal_dash').cooldown! + 0.2);
    expect(abilities.cooldownFraction(0)).toBe(0);
  });

  it('Wellenruf: eine Welle kommt und lässt sich erwischen', () => {
    const { content, surfer, abilities, ctx, held, step } = setup();
    abilities.setup([content.abilities.get('wave_call')]);
    held.paddle = 1;
    step(5);
    expect(abilities.trigger(0, ctx)).toBe(true);
    expect(step(8, () => surfer.rideWaveId !== null)).toBe(true);
  });

  it('Blasenschild fängt einen Treffer ab', () => {
    const { bus, content, world, surfer, run, abilities, ctx, assets, stats, camera } = setup();
    const monsters = new MonsterSystem(bus, content, assets, world, noEffects);
    monsters.start(new Rng(2));
    abilities.setup([content.abilities.get('bubble_shield')]);
    expect(abilities.trigger(0, ctx)).toBe(true);
    expect(run.shield).toBeGreaterThan(0);
    const k = monsters.spawn(content.monsters.get('kraken'), 1, surfer.x, surfer.z - 9)!;
    k.setPhase('active');
    let broken = false;
    bus.on('shieldBroken', () => (broken = true));
    for (let i = 0; i < 60 * 8 && !broken; i++) monsters.update(1 / 60, surfer, run, stats, camera);
    expect(broken).toBe(true);
    expect(run.hearts).toBe(3);
    expect(run.shield).toBe(0);
  });
});
