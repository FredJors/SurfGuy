/**
 * Kleine, wiederverwendbare UI-Bausteine: Zurück-Knopf, Symbole, Konfetti, Hochzählen und eine
 * überspringbare Zeitleiste für Animationsfolgen (Spielende, Truhen).
 */
import { formatNumber, h } from './dom';
import { ICONS, type IconName } from './icons';

export function icon(name: IconName, cls = 'ico'): HTMLSpanElement {
  return h('span', { class: cls, html: ICONS[name] });
}

export function backButton(onClick: () => void, label = 'Zurück'): HTMLButtonElement {
  const b = h('button', { class: 'btn small back' }, [icon('back'), label]);
  b.addEventListener('click', onClick);
  return b;
}

export const CONFETTI_COLORS = ['#ffd23f', '#ff4f8b', '#3ee0ff', '#7dff8a', '#b065ff', '#ffffff'];

/** Konfetti-Explosion an einer Stelle (Pixel relativ zu `parent`). */
export function confetti(parent: HTMLElement, x: number, y: number, opts: { count?: number; colors?: readonly string[]; spread?: number } = {}): void {
  const count = opts.count ?? 36;
  const colors = opts.colors ?? CONFETTI_COLORS;
  const spread = opts.spread ?? 220;
  const layer = h('div', { class: 'confetti-layer' });
  layer.style.left = `${x}px`;
  layer.style.top = `${y}px`;
  for (let i = 0; i < count; i++) {
    const p = h('i', { class: i % 3 === 0 ? 'confetti round' : 'confetti' });
    const a = Math.random() * Math.PI * 2;
    const d = spread * (0.35 + Math.random() * 0.65);
    p.style.setProperty('--dx', `${(Math.cos(a) * d).toFixed(0)}px`);
    p.style.setProperty('--dy', `${(Math.sin(a) * d * 0.75 - spread * 0.25).toFixed(0)}px`);
    p.style.setProperty('--fall', `${(spread * 0.5 + Math.random() * spread * 0.7).toFixed(0)}px`);
    p.style.setProperty('--rot', `${((Math.random() - 0.5) * 1080).toFixed(0)}deg`);
    p.style.setProperty('--t', `${(0.9 + Math.random() * 0.8).toFixed(2)}s`);
    p.style.background = colors[i % colors.length]!;
    layer.appendChild(p);
  }
  parent.appendChild(layer);
  setTimeout(() => layer.remove(), 1900);
}

/** Konfetti mittig über einem Element. */
export function confettiAt(parent: HTMLElement, el: HTMLElement, opts: Parameters<typeof confetti>[3] = {}): void {
  const p = parent.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  confetti(parent, r.left + r.width / 2 - p.left, r.top + r.height / 2 - p.top, opts);
}

export interface Running {
  finish(): void;
}

/** Zahl hochzählen (mit Ausklingen). `onStep` meldet jeden neuen Zwischenwert. */
export function countUp(
  el: HTMLElement,
  to: number,
  ms: number,
  opts: { from?: number; format?: (n: number) => string; onStep?: (v: number) => void; onDone?: () => void } = {},
): Running {
  const from = opts.from ?? 0;
  const fmt = opts.format ?? formatNumber;
  let last = NaN;
  let done = false;
  const set = (v: number) => {
    if (v === last) return;
    last = v;
    el.textContent = fmt(v);
    opts.onStep?.(v);
  };
  const finish = () => {
    if (done) return;
    done = true;
    set(to);
    opts.onDone?.();
  };
  if (ms <= 0 || from === to) {
    finish();
    return { finish };
  }
  const t0 = performance.now();
  set(from);
  const frame = (now: number) => {
    if (done) return;
    const t = Math.min(1, (now - t0) / ms);
    const k = 1 - Math.pow(1 - t, 3);
    set(Math.round(from + (to - from) * k));
    if (t < 1) requestAnimationFrame(frame);
    else finish();
  };
  requestAnimationFrame(frame);
  return { finish };
}

/**
 * Zeitleiste für Animationsfolgen. Jeder Schritt bekommt `instant` – beim Überspringen werden alle
 * offenen Schritte sofort (ohne Animation/Ton) ausgeführt und laufende Zähler beendet.
 */
export class Timeline {
  private readonly steps: { t: number; fn: (instant: boolean) => void; done: boolean }[] = [];
  private readonly timers: number[] = [];
  private running: Running[] = [];
  skipped = false;

  add(t: number, fn: (instant: boolean) => void): this {
    this.steps.push({ t, fn, done: false });
    return this;
  }

  play(): void {
    for (const s of this.steps) this.timers.push(window.setTimeout(() => this.run(s, false), s.t));
  }

  /** Laufende Animation merken, damit sie beim Überspringen beendet wird. */
  track(r: Running): void {
    if (this.skipped) r.finish();
    else this.running.push(r);
  }

  get finished(): boolean {
    return this.steps.every((s) => s.done);
  }

  skip(): void {
    if (this.skipped) return;
    this.skipped = true;
    this.timers.forEach((t) => window.clearTimeout(t));
    for (const s of [...this.steps].sort((a, b) => a.t - b.t)) this.run(s, true);
    const r = this.running;
    this.running = [];
    r.forEach((x) => x.finish());
  }

  dispose(): void {
    this.timers.forEach((t) => window.clearTimeout(t));
  }

  private run(s: { fn: (instant: boolean) => void; done: boolean }, instant: boolean): void {
    if (s.done) return;
    s.done = true;
    s.fn(instant);
  }
}

/** CSS-Animation neu starten (Klasse kurz entfernen). */
export function restartAnim(el: HTMLElement, cls: string): void {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
