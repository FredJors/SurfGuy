/**
 * Handy: Dynamischer Joystick links (erscheint dort, wo der Daumen aufsetzt),
 * rechte Bildschirmhälfte nach oben wischen = Sprung.
 */
import { clamp } from '../core/math';
import type { InputManager, InputSource, InputState } from './InputManager';

const JOYSTICK_RADIUS = 62;
const DEADZONE = 0.18;
const SWIPE_MIN = 45;
const SWIPE_MAX_TIME = 450;

export class TouchSource implements InputSource {
  private joyId: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private joyVec = { x: 0, y: 0 };
  private readonly swipes = new Map<number, { x: number; y: number; t: number; fired: boolean }>();
  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  /** Bereiche, in denen Touches ignoriert werden (z. B. Zeichenfenster, Buttons). */
  blockers: (() => DOMRect | null)[] = [];

  constructor(
    private readonly input: InputManager,
    private readonly surface: HTMLElement,
  ) {
    this.base = document.createElement('div');
    this.base.className = 'joystick-base';
    this.knob = document.createElement('div');
    this.knob.className = 'joystick-knob';
    this.base.appendChild(this.knob);
    document.body.appendChild(this.base);

    surface.addEventListener('pointerdown', this.onDown, { passive: false });
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }

  private isBlocked(x: number, y: number): boolean {
    for (const b of this.blockers) {
      const r = b();
      if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
    }
    return false;
  }

  private readonly onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || !this.input.gameplayEnabled) return;
    if (this.isBlocked(e.clientX, e.clientY)) return;
    e.preventDefault();
    if (e.clientX < window.innerWidth / 2) {
      if (this.joyId !== null) return;
      this.joyId = e.pointerId;
      this.joyOrigin = { x: e.clientX, y: e.clientY };
      this.joyVec = { x: 0, y: 0 };
      this.base.style.left = `${e.clientX}px`;
      this.base.style.top = `${e.clientY}px`;
      this.base.classList.add('visible');
      this.knob.style.transform = 'translate(-50%, -50%)';
    } else {
      this.swipes.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), fired: false });
    }
  };

  private readonly onMove = (e: PointerEvent) => {
    if (e.pointerId === this.joyId) {
      const dx = e.clientX - this.joyOrigin.x;
      const dy = e.clientY - this.joyOrigin.y;
      const len = Math.hypot(dx, dy);
      const k = len > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / len : 1;
      this.joyVec = { x: (dx * k) / JOYSTICK_RADIUS, y: (dy * k) / JOYSTICK_RADIUS };
      this.knob.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
      e.preventDefault();
      return;
    }
    const s = this.swipes.get(e.pointerId);
    if (s && !s.fired) {
      const up = s.y - e.clientY;
      const side = Math.abs(e.clientX - s.x);
      if (up > SWIPE_MIN && up > side * 1.2 && performance.now() - s.t < SWIPE_MAX_TIME) {
        s.fired = true;
        this.input.triggerJump();
      }
      e.preventDefault();
    }
  };

  private readonly onUp = (e: PointerEvent) => {
    if (e.pointerId === this.joyId) {
      this.joyId = null;
      this.joyVec = { x: 0, y: 0 };
      this.base.classList.remove('visible');
    }
    this.swipes.delete(e.pointerId);
  };

  /** Joystick zurücksetzen (z. B. beim Pausieren). */
  reset(): void {
    this.joyId = null;
    this.joyVec = { x: 0, y: 0 };
    this.base.classList.remove('visible');
    this.swipes.clear();
  }

  read(): Partial<InputState> {
    if (this.joyId === null) return {};
    const dz = (v: number) => (Math.abs(v) < DEADZONE ? 0 : (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE));
    const x = dz(this.joyVec.x);
    const fwd = dz(-this.joyVec.y);
    return {
      steer: clamp(x * 1.15, -1, 1),
      paddle: clamp(fwd * 1.3, 0, 1),
      brake: clamp(-fwd * 1.3, 0, 1),
    };
  }

  dispose(): void {
    this.surface.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.base.remove();
  }
}
