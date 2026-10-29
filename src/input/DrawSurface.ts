/**
 * Zeichenfläche (Maus oder Finger). Liefert Striche als Aktion `drawStroke` an den InputManager.
 * Nur ein Strich gleichzeitig (Unistroke).
 */
import type { InputManager, StrokePoint } from './InputManager';

export class DrawSurface {
  enabled = false;
  private pointerId: number | null = null;
  private points: StrokePoint[] = [];

  constructor(
    private readonly input: InputManager,
    private readonly element: HTMLElement,
  ) {
    element.addEventListener('pointerdown', this.onDown);
    element.addEventListener('pointermove', this.onMove);
    element.addEventListener('pointerup', this.onUp);
    element.addEventListener('pointercancel', this.onUp);
    element.addEventListener('lostpointercapture', this.onUp);
    element.style.touchAction = 'none';
  }

  get isDrawing(): boolean {
    return this.pointerId !== null;
  }

  /** Bisher gezeichnete Punkte des laufenden Strichs. */
  get currentPoints(): readonly StrokePoint[] {
    return this.points;
  }

  /** Bildschirmkoordinaten: unabhängig von Animationen/Verschiebungen des Zeichenfensters. */
  private local(e: PointerEvent): StrokePoint {
    return { x: e.clientX, y: e.clientY, t: performance.now() };
  }

  private readonly onDown = (e: PointerEvent) => {
    if (!this.enabled || this.pointerId !== null) return;
    e.preventDefault();
    e.stopPropagation();
    this.pointerId = e.pointerId;
    try {
      this.element.setPointerCapture(e.pointerId);
    } catch {
      /* egal */
    }
    const p = this.local(e);
    this.points = [p];
    this.input.emitStrokeStart(p);
  };

  private readonly onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    for (const ce of events.length ? events : [e]) {
      const p = this.local(ce);
      const last = this.points[this.points.length - 1]!;
      if (Math.hypot(p.x - last.x, p.y - last.y) < 2) continue;
      this.points.push(p);
      this.input.emitStrokeMove(p, this.points);
    }
  };

  private readonly onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.finish();
  };

  /** Beendet einen laufenden Strich (z. B. wenn die Zeit abläuft). */
  finish(): readonly StrokePoint[] | null {
    if (this.pointerId === null) return null;
    try {
      this.element.releasePointerCapture(this.pointerId);
    } catch {
      /* egal */
    }
    this.pointerId = null;
    const pts = this.points;
    this.points = [];
    this.input.emitStrokeEnd(pts);
    return pts;
  }

  cancel(): void {
    if (this.pointerId !== null) {
      try {
        this.element.releasePointerCapture(this.pointerId);
      } catch {
        /* egal */
      }
    }
    this.pointerId = null;
    this.points = [];
  }
}
