/**
 * Eingabe-Abstraktion: Die Spiellogik kennt nur Aktionen (steer, paddle, brake, jump, drawStroke),
 * nicht Tasten oder Touch. Geräte (Tastatur, Touch, Zeichenfläche) schreiben hier hinein.
 */
import { clamp } from '../core/math';

export interface InputState {
  /** -1 = links, +1 = rechts */
  steer: number;
  /** 0..1 paddeln / beschleunigen */
  paddle: number;
  /** 0..1 bremsen */
  brake: number;
}

export interface StrokePoint {
  x: number;
  y: number;
  t: number;
}

export interface StrokeEvents {
  start?: (p: StrokePoint) => void;
  move?: (p: StrokePoint, points: readonly StrokePoint[]) => void;
  end?: (points: readonly StrokePoint[]) => void;
}

export interface InputSource {
  /** Liefert einen Teil-Zustand (wird mit anderen Quellen zusammengeführt). */
  read(): Partial<InputState>;
  /** Wird pro Frame aufgerufen (optional). */
  update?(): void;
  dispose?(): void;
}

export class InputManager {
  readonly state: InputState = { steer: 0, paddle: 0, brake: 0 };
  /** Wenn false, liefert die Steuerung nur Nullwerte (z. B. im Menü). */
  gameplayEnabled = false;
  private readonly sources: InputSource[] = [];
  /** Zeitpunkt des letzten Sprung-Drucks (Puffer, damit kurz zu frühe Drücke nicht verloren gehen) */
  private jumpQueuedAt = -Infinity;
  /** Wie lange ein Sprung-Druck gültig bleibt (ms) */
  jumpBufferMs = 250;
  private pauseQueued = false;
  /** Angeforderte Fähigkeiten-Plätze (Aktion `ability`) */
  private abilityQueue = new Set<number>();
  private strokeListeners: StrokeEvents[] = [];

  addSource(source: InputSource): void {
    this.sources.push(source);
  }

  /** Von Geräten aufgerufen. */
  triggerJump(): void {
    if (this.gameplayEnabled) this.jumpQueuedAt = performance.now();
  }

  /** Aktion `ability`: Fähigkeit in Platz `slot` auslösen. */
  triggerAbility(slot: number): void {
    if (this.gameplayEnabled) this.abilityQueue.add(slot);
  }

  consumeAbility(slot: number): boolean {
    return this.abilityQueue.delete(slot);
  }

  triggerPause(): void {
    this.pauseQueued = true;
  }

  /** Liest und löscht einen anstehenden Sprung (nur einmal pro Druck). */
  consumeJump(): boolean {
    const j = performance.now() - this.jumpQueuedAt <= this.jumpBufferMs;
    this.jumpQueuedAt = -Infinity;
    return j;
  }

  consumePause(): boolean {
    const p = this.pauseQueued;
    this.pauseQueued = false;
    return p;
  }

  onStroke(listener: StrokeEvents): () => void {
    this.strokeListeners.push(listener);
    return () => {
      this.strokeListeners = this.strokeListeners.filter((l) => l !== listener);
    };
  }

  emitStrokeStart(p: StrokePoint): void {
    for (const l of this.strokeListeners) l.start?.(p);
  }

  emitStrokeMove(p: StrokePoint, points: readonly StrokePoint[]): void {
    for (const l of this.strokeListeners) l.move?.(p, points);
  }

  /** Aktion `drawStroke`: ein fertiger Strich. */
  emitStrokeEnd(points: readonly StrokePoint[]): void {
    for (const l of this.strokeListeners) l.end?.(points);
  }

  update(): void {
    let steer = 0;
    let paddle = 0;
    let brake = 0;
    for (const s of this.sources) {
      s.update?.();
      const r = s.read();
      steer += r.steer ?? 0;
      paddle = Math.max(paddle, r.paddle ?? 0);
      brake = Math.max(brake, r.brake ?? 0);
    }
    if (!this.gameplayEnabled) {
      steer = paddle = brake = 0;
      this.jumpQueuedAt = -Infinity;
      this.abilityQueue.clear();
    }
    this.state.steer = clamp(steer, -1, 1);
    this.state.paddle = clamp(paddle, 0, 1);
    this.state.brake = clamp(brake, 0, 1);
  }

  dispose(): void {
    for (const s of this.sources) s.dispose?.();
  }
}
