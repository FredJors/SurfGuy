/**
 * Zustände des Surfers. Neuer Zustand = neues Objekt hier + Eintrag in SurferStateId
 * (core/events.ts) + ggf. in `next` der Zustände, die dorthin wechseln dürfen.
 */
import { CONFIG } from '../config/gameConfig';
import type { State, StateMachine } from '../core/StateMachine';
import type { SurferStateId } from '../core/events';
import type { Surfer } from './Surfer';

type S = State<Surfer, SurferStateId>;

/** Homescreen: liegt auf dem Brett und treibt. */
const Lying: S = {
  id: 'Lying',
  next: ['Paddling', 'Standing'],
  enter(s) {
    s.endRide();
    s.speed = 0;
  },
  update(s, dt) {
    s.groundMotion(dt, 'idle');
  },
};

/** Liegt und paddelt (unter der Tempo-Schwelle). */
const Paddling: S = {
  id: 'Paddling',
  next: ['Standing', 'Wipeout', 'Lying'],
  update(s, dt) {
    s.groundMotion(dt, 'paddle');
    const caught = s.updateWaves(dt, true);
    s.input.consumeJump(); // Springen nur im Stehen
    if (caught || s.speed >= CONFIG.player.standSpeed) return 'Standing';
  },
};

/** Steht auf dem Brett. */
const Standing: S = {
  id: 'Standing',
  next: ['Paddling', 'Airborne', 'Wipeout', 'Lying'],
  enter(s, from) {
    // Nur nach dem Aufstehen aus dem Liegen kurz sperren (nicht nach einer Landung)
    s.standUpLock = from === 'Paddling' || from === 'Lying' ? CONFIG.player.standUpTime * 0.6 : 0;
  },
  update(s, dt, t) {
    s.groundMotion(dt, 'stand');
    s.updateWaves(dt, true);
    // Während des Aufstehens noch nicht springen (Sprung bleibt kurz gepuffert)
    if (t >= s.standUpLock && s.input.consumeJump()) {
      s.doJump();
      return 'Airborne';
    }
    if (s.speed < CONFIG.player.lieSpeed && s.rideWaveId === null) return 'Paddling';
  },
};

/** In der Luft (vor oder nach dem Zeichnen). */
const Airborne: S = {
  id: 'Airborne',
  next: ['Drawing', 'TrickPerforming', 'Landing', 'Wipeout'],
  update(s, dt) {
    if (s.airMotion(dt)) return 'Landing';
    if (!s.drawingDone && s.canTrick && s.airElapsed >= CONFIG.trick.openDelay) return 'Drawing';
  },
};

/** Zeitlupe + Zeichenfenster. Die Zeichenzeit hängt von der Airtime ab. */
const Drawing: S = {
  id: 'Drawing',
  next: ['TrickPerforming', 'Airborne', 'Landing', 'Wipeout'],
  enter(s) {
    s.drawingDone = true;
    const T = CONFIG.trick;
    // Echte Zeichenzeit: Spielzeit / Zeitlupe, begrenzt
    const real = Math.min(T.maxDrawTime, Math.max(T.minDrawTime, s.drawGameTime / T.slowMotion));
    s.bus.emit('drawingStarted', { duration: real });
  },
  exit(s, to) {
    s.bus.emit('drawingEnded', { recognized: to === 'TrickPerforming' });
  },
  update(s, dt, t) {
    if (s.airMotion(dt)) return 'Landing';
    if (t >= s.drawGameTime) return 'Airborne';
  },
};

/** Trick wird ausgeführt (Daten aus data/tricks.ts). */
const TrickPerforming: S = {
  id: 'TrickPerforming',
  next: ['Landing', 'Wipeout'],
  update(s, dt, t) {
    const landed = s.airMotion(dt);
    if (s.trick) s.trickProgress = Math.min(1, t / s.trick.def.duration);
    if (landed) {
      s.trickProgress = 1;
      return 'Landing';
    }
  },
};

/** Kurzes Abfedern nach der Landung. */
const Landing: S = {
  id: 'Landing',
  next: ['Standing', 'Paddling', 'Wipeout'],
  enter(s) {
    s.speed *= 0.92;
    s.bus.emit('landed', { airtime: s.airElapsed, position: { x: s.x, z: s.z }, speed: s.speed });
  },
  exit(s) {
    s.trick = null;
  },
  update(s, dt, t) {
    s.groundMotion(dt, 'stand');
    s.updateWaves(dt, false);
    if (t >= CONFIG.player.landingTime) return s.speed >= CONFIG.player.lieSpeed || s.rideWaveId !== null ? 'Standing' : 'Paddling';
  },
};

/** Sturz: kurz im Wasser, dann wieder paddeln. */
const Wipeout: S = {
  id: 'Wipeout',
  next: ['Paddling', 'Lying'],
  update(s, dt, t) {
    s.groundMotion(dt, 'coast');
    s.input.consumeJump();
    if (t >= CONFIG.player.wipeoutTime) {
      s.speed = Math.max(s.speed, CONFIG.player.recoverSpeed);
      return 'Paddling';
    }
  },
};

export const SURFER_STATES: readonly S[] = [Lying, Paddling, Standing, Airborne, Drawing, TrickPerforming, Landing, Wipeout];

export function registerSurferStates(fsm: StateMachine<Surfer, SurferStateId>): void {
  for (const st of SURFER_STATES) fsm.add(st);
}
