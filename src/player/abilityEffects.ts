/**
 * Effekte aktiver Fähigkeiten. `AbilityDef.effect` verweist auf einen Eintrag hier.
 * Neue Fähigkeit mit vorhandenem Effekt = nur Dateneintrag (data/abilities.ts);
 * neuer Effekt = neuer Eintrag in diesem Register.
 */
import * as THREE from 'three';
import { CONFIG } from '../config/gameConfig';
import type { GameEventBus } from '../core/events';
import type { RunState } from '../core/RunState';
import type { AbilityDef } from '../data/types';
import type { Effects } from '../fx/Effects';
import type { World } from '../world/World';
import type { PlayerStats } from './Progression';
import type { Surfer } from './Surfer';

export interface AbilityContext {
  readonly surfer: Surfer;
  readonly world: World;
  readonly run: RunState;
  readonly stats: PlayerStats;
  readonly bus: GameEventBus;
  readonly effects: Effects;
}

export interface AbilityEffect {
  /** Darf jetzt ausgelöst werden? (z. B. nicht in der Luft) */
  canUse?(ctx: AbilityContext, def: AbilityDef): boolean;
  activate(ctx: AbilityContext, def: AbilityDef): void;
}

const tmp = new THREE.Vector3();

export const ABILITY_EFFECTS: Record<string, AbilityEffect> = {
  /** Gezeiten-Sprint: Tempo-Schub, aus dem Liegen direkt aufs Brett. */
  speedBurst: {
    canUse: (c) => !c.surfer.isAirborne && !c.surfer.fsm.is('Wipeout', 'Lying', 'Posing'),
    activate(c, def) {
      const s = c.surfer;
      const boost = def.params?.boost ?? 8;
      s.speed = Math.min(c.stats.get('maxSpeed'), Math.max(s.speed, CONFIG.player.standSpeed) + boost);
      if (s.fsm.is('Paddling')) s.fsm.transition('Standing');
      c.effects.splash(tmp.set(s.x - s.forwardX, s.y, s.z - s.forwardZ), 1.6);
    },
  },

  /** Wellenruf: große Welle, die den Spieler kurz darauf erreicht. */
  callWave: {
    activate(c, def) {
      const s = c.surfer;
      c.world.waves.spawnCalled(s.x, s.z, s.vx, s.vz, def.params?.height ?? 2.4, def.params?.arrival ?? 2.8);
    },
  },

  /** Blasenschild: fängt den nächsten Treffer ab (siehe MonsterSystem.hitPlayer). */
  shield: {
    activate(c, def) {
      c.run.shield = def.duration ?? 10;
      c.effects.sparkle(tmp.set(c.surfer.x, c.surfer.y + 1, c.surfer.z), '#9be8ff');
    },
  },
};
