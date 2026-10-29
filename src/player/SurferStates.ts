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
  next: ['Paddling', 'Standing', 'Posing'],
  enter(s) {
    s.endRide();
    s.speed = 0;
  },
  update(s, dt) {
    s.groundMotion(dt, 'idle');
  },
};

/** Shop-Vorschau: steht lässig auf dem Brett und posiert. */
const Posing: S = {
  id: 'Posing',
  next: ['Lying'],
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
  next: ['Standing', 'Airborne', 'Wipeout', 'Lying', 'Walking'],
  update(s, dt) {
    s.groundMotion(dt, 'paddle');
    if (s.isAirborne) return; // z. B. von einer Rampe abgehoben
    if (s.canDismount) return 'Walking';
    const caught = s.updateWaves(dt, !s.deckWreck);
    s.input.consumeJump(); // Springen nur im Stehen
    if (caught || s.speed >= CONFIG.player.standSpeed) return 'Standing';
  },
};

/** Steht auf dem Brett. */
const Standing: S = {
  id: 'Standing',
  next: ['Paddling', 'Airborne', 'Wipeout', 'Lying', 'Walking'],
  enter(s, from) {
    // Nur nach dem Aufstehen aus dem Liegen kurz sperren (nicht nach einer Landung)
    s.standUpLock = from === 'Paddling' || from === 'Lying' ? CONFIG.player.standUpTime * 0.6 : 0;
  },
  exit(s) {
    s.punchHint.visible = s.punchHint.inWindow = false;
  },
  update(s, dt, t) {
    s.groundMotion(dt, 'stand');
    if (s.isAirborne) return;
    if (s.canDismount) return 'Walking';
    s.updateWaves(dt, !s.deckWreck);
    s.updatePunchHint();
    // Während des Aufstehens noch nicht springen (Sprung bleibt kurz gepuffert)
    if (t >= s.standUpLock && s.input.consumeJump()) {
      // Welle von vorn im Fenster → Durchstoß, sonst normaler Sprung
      if (!s.tryPunchThrough()) s.doJump();
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
    if (!s.drawingDone && s.remainingAirtime >= CONFIG.player.minAirtimeForTrick && s.airElapsed >= CONFIG.trick.openDelay) return 'Drawing';
  },
};

/** Zeitlupe + Zeichenfenster. Die Zeichenzeit hängt von der Airtime ab. */
const Drawing: S = {
  id: 'Drawing',
  next: ['TrickPerforming', 'Airborne', 'Landing', 'Wipeout'],
  enter(s) {
    s.drawingDone = true;
    const T = CONFIG.trick;
    // Echte Zeichenzeit: Spielzeit / Zeitlupe, begrenzt; Skills können sie verlängern
    const k = s.stats.get('drawTime');
    const real = Math.min(T.maxDrawTime * k, Math.max(T.minDrawTime * k, (s.drawGameTime / T.slowMotion) * k));
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
  next: ['Landing', 'Airborne', 'Wipeout'],
  update(s, dt, t) {
    const landed = s.airMotion(dt);
    if (s.trick) s.trickProgress = Math.min(1, t / s.trickDuration);
    if (landed) {
      s.trickProgress = 1;
      s.bossBounce = null;
      return 'Landing';
    }
    // Trick fertig, aber noch in der Luft → weiterfliegen, evtl. nächster Trick (Kombo)
    if (s.trickProgress >= 1) {
      // Kopfsprung auf den Boss: Treffer (TrickSystem beim Zustandswechsel), dann abprallen
      if (s.bossBounce) s.bounceOffBoss();
      else s.continueAfterTrick();
      return 'Airborne';
    }
  },
};

/** Kurzes Abfedern nach der Landung. */
const Landing: S = {
  id: 'Landing',
  next: ['Standing', 'Paddling', 'Airborne', 'Wipeout', 'Walking'],
  enter(s) {
    s.speed *= 0.92;
    s.bus.emit('landed', { airtime: s.airElapsed, position: { x: s.x, z: s.z }, speed: s.speed });
  },
  exit(s) {
    s.trick = null;
  },
  update(s, dt, t) {
    s.groundMotion(dt, 'stand');
    if (s.isAirborne) return;
    if (s.canDismount) return 'Walking';
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

/** An Land: zu Fuß, Brett unter dem Arm. Zurück ins Wasser → paddeln. */
const Walking: S = {
  id: 'Walking',
  next: ['Paddling', 'Lying'],
  enter(s) {
    s.endRide();
    s.speed = Math.min(s.speed, CONFIG.island.walkSpeed);
  },
  update(s, dt) {
    s.walkMotion(dt);
    s.input.consumeJump();
    if (!s.onLand) {
      s.speed = Math.max(s.speed, 2);
      return 'Paddling';
    }
  },
};

export const SURFER_STATES: readonly S[] = [Lying, Posing, Paddling, Standing, Airborne, Drawing, TrickPerforming, Landing, Wipeout, Walking];

export function registerSurferStates(fsm: StateMachine<Surfer, SurferStateId>): void {
  for (const st of SURFER_STATES) fsm.add(st);
}
