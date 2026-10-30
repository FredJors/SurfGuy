import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AssetLoader } from '../assets/AssetLoader';
import { CONFIG } from '../config/gameConfig';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import { createDefaultSave } from '../core/SaveGame';
import { createRegistries } from '../data';
import { InputManager, type InputState } from '../input/InputManager';
import { createPlayerStats } from '../player/Progression';
import { JointRig } from '../player/rig/CharacterRig';
import { Surfer } from '../player/Surfer';
import { PickupSystem } from './PickupSystem';
import { World } from './World';
import type { Wreck } from './Wrecks';

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
  const events: { type: string; data: unknown }[] = [];
  for (const type of ['launched', 'wreckBonk', 'landed'] as const) bus.on(type, (data) => events.push({ type, data }));
  const camera = new THREE.PerspectiveCamera();
  const step = (seconds: number, onFrame?: () => void) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      input.update();
      surfer.update(1 / 60);
      world.update(1 / 60, surfer.x, surfer.z, camera, surfer.vx, surfer.vz);
      onFrame?.();
    }
  };
  return { bus, assets, content, world, surfer, held, events, step };
}

/** Surfer vor das Heck eines Wracks setzen, Blick Richtung Bug. */
function placeBehind(surfer: Surfer, w: Wreck, back: number, speed: number): void {
  surfer.reset(w.x - w.dirX * back, w.z - w.dirZ * back, Math.atan2(w.dirX, w.dirZ));
  surfer.fsm.start('Standing');
  surfer.speed = speed;
}

describe('Schiffswracks', () => {
  it('liegen verteilt im Ring um die Insel, mit Abstand zueinander und zum Start', () => {
    const { world } = setup();
    const W = CONFIG.wrecks;
    const list = world.wrecks.wrecks;
    expect(list.length).toBeGreaterThanOrEqual(W.count * 0.8);
    for (const w of list) {
      const cx = w.x + w.dirX * w.length * 0.5;
      const cz = w.z + w.dirZ * w.length * 0.5;
      const r = Math.hypot(cx, cz);
      expect(r).toBeGreaterThanOrEqual(W.ringMin - 1);
      expect(r).toBeLessThanOrEqual(W.ringMax + 1);
      expect(Math.hypot(cx, cz - CONFIG.world.startDistance)).toBeGreaterThanOrEqual(W.startClearance);
      for (const o of list) if (o !== w) expect(Math.hypot(o.x - w.x, o.z - w.z)).toBeGreaterThan(W.minSpacing * 0.5);
    }
  });

  it('Rampe hochfahren → am Bug abheben, hoch fliegen, landen', () => {
    const { world, surfer, events, step } = setup();
    const w = world.wrecks.wrecks[0]!;
    placeBehind(surfer, w, 8, 15);
    let maxY = -Infinity;
    step(6, () => (maxY = Math.max(maxY, surfer.y)));
    const launch = events.find((e) => e.type === 'launched');
    expect(launch).toBeDefined();
    expect((launch!.data as { source: string }).source).toBe('ramp');
    expect(maxY).toBeGreaterThan(w.topHeight + 2);
    expect(events.some((e) => e.type === 'landed')).toBe(true);
    // Weit hinter dem Bug gelandet
    expect(world.wrecks.local(w, surfer.x, surfer.z).u).toBeGreaterThan(w.length + 15);
  });

  it('Sprung mitten auf dem Deck: Landung neben der Rampe im Wasser, Höhe bleibt gültig (Bot-Fund)', () => {
    const { world, surfer, step } = setup();
    const w = world.wrecks.wrecks[0]!;
    placeBehind(surfer, w, 8, 12);
    // bis aufs Deck fahren, dann quer abspringen
    for (let i = 0; i < 60 * 3 && !surfer.deckWreck; i++) step(1 / 60);
    expect(surfer.deckWreck).not.toBeNull();
    surfer.doJump();
    surfer.fsm.transition('Airborne');
    // während des Flugs neben die Rampe (wie ein seitlicher Sprung vom Deck)
    surfer.x += w.dirZ * 20;
    surfer.z -= w.dirX * 20;
    let bad = false;
    step(3, () => {
      if (!Number.isFinite(surfer.y)) bad = true;
    });
    expect(bad).toBe(false);
    expect(Math.abs(surfer.y - world.heightAt(surfer.x, surfer.z))).toBeLessThan(2);
  });

  it('seitlich gegen den Rumpf: harter Stopp, kein Durchfahren', () => {
    const { world, surfer, events, step } = setup();
    const w = world.wrecks.wrecks[0]!;
    // Mitte des Wracks, 10 m seitlich, Blick zum Rumpf
    const mu = w.length * 0.7;
    const sx = w.x + w.dirX * mu + w.dirZ * 10;
    const sz = w.z + w.dirZ * mu - w.dirX * 10;
    surfer.reset(sx, sz, Math.atan2(-w.dirZ, w.dirX));
    surfer.fsm.start('Standing');
    surfer.speed = 12;
    step(1.5);
    expect(events.some((e) => e.type === 'wreckBonk')).toBe(true);
    expect(surfer.speed).toBeLessThan(12 * 0.5);
    const loc = world.wrecks.local(w, surfer.x, surfer.z);
    expect(Math.abs(loc.v)).toBeGreaterThanOrEqual(w.width / 2);
  });

  it('Perlenbogen über der Rampe liegt in der Nähe aus und folgt der Flugbahn', () => {
    const { bus, assets, content, world } = setup();
    const pickups = new PickupSystem(bus, assets, content, world.waves.field);
    const w = world.wrecks.wrecks[0]!;
    world.wrecks.update(0.1, w.x, w.z, pickups);
    expect(pickups.hasTag(`wreck:${w.id}`)).toBe(true);
    const pts = world.wrecks.arcPoints(w, CONFIG.wrecks.arcSpeed, 5);
    expect(pts[0]!.y).toBeGreaterThan(w.topHeight);
    // weit weg → Bogen wird entfernt
    world.wrecks.update(0.1, w.x + 1000, w.z, pickups);
    expect(pickups.hasTag(`wreck:${w.id}`)).toBe(false);
  });
});
