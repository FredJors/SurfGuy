/**
 * Keoni am Funk: Anweisungen im Tutorial und einmalige Tipps. Eine Karte oben mittig unter
 * der Wellen-Anzeige (Porträt, Text, Tasten-Schilder, Fortschritt, „Überspringen“), dazu auf
 * dem Handy eine vorgemachte Geste (Joystick nach vorn/zur Seite, rechts nach oben wischen).
 */
import { h, setText } from './dom';

export type CoachGesture = 'paddle' | 'steer' | 'swipe';

export interface CoachStep {
  text: string;
  keys?: readonly string[];
  /** Geste auf dem Handy (am PC nicht gezeigt) */
  gesture?: CoachGesture;
  index: number;
  total: number;
}

export class Coach {
  readonly el: HTMLDivElement;
  private readonly face: HTMLDivElement;
  private readonly textEl: HTMLDivElement;
  private readonly keysEl: HTMLDivElement;
  private readonly dotsEl: HTMLDivElement;
  private readonly footEl: HTMLDivElement;
  private readonly gestureEl: HTMLDivElement;
  private hideTimer: number | undefined;
  private tipMode = false;
  /** „Überspringen“ gedrückt */
  onSkip: () => void = () => {};

  constructor(slot: HTMLElement, overlayParent: HTMLElement, private readonly touch: boolean) {
    this.face = h('div', { class: 'coach-face' });
    this.textEl = h('div', { class: 'coach-text' });
    this.keysEl = h('div', { class: 'coach-keys' });
    this.dotsEl = h('div', { class: 'coach-dots' });
    const skip = h('button', { class: 'coach-skip', text: 'Überspringen ›' });
    skip.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onSkip();
    });
    this.footEl = h('div', { class: 'coach-foot' }, [this.dotsEl, skip]);
    this.el = h('div', { class: 'coach hidden' }, [
      h('div', { class: 'coach-card' }, [
        this.face,
        h('div', { class: 'coach-body' }, [h('div', { class: 'coach-name', text: 'Keoni · Funk' }), this.textEl, this.keysEl]),
        h('div', { class: 'coach-check', html: '<svg viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>' }),
      ]),
      this.footEl,
    ]);
    slot.appendChild(this.el);
    this.gestureEl = h('div', { class: 'coach-gesture hidden' }, [h('div', { class: 'g-base' }, [h('div', { class: 'g-knob' })]), h('div', { class: 'g-finger' })]);
    overlayParent.appendChild(this.gestureEl);
  }

  setPortrait(url: string): void {
    this.face.style.backgroundImage = `url(${url})`;
  }

  get visible(): boolean {
    return !this.el.classList.contains('hidden');
  }

  /** Tutorial-Schritt anzeigen. */
  showStep(step: CoachStep): void {
    window.clearTimeout(this.hideTimer);
    this.tipMode = false;
    this.el.classList.remove('hidden', 'done', 'tip');
    this.restartPop();
    setText(this.textEl, step.text);
    this.keysEl.innerHTML = '';
    if (!this.touch) for (const k of step.keys ?? []) this.keysEl.appendChild(h('span', { class: `key ${k.length > 1 ? 'wide' : ''}`, text: k }));
    this.keysEl.classList.toggle('hidden', this.touch || !step.keys?.length);
    this.dotsEl.innerHTML = '';
    for (let i = 0; i < step.total; i++) this.dotsEl.appendChild(h('span', { class: i < step.index ? 'on' : i === step.index ? 'now' : '' }));
    this.footEl.classList.remove('hidden');
    this.setGesture(step.gesture ?? null);
  }

  setText(text: string): void {
    if (this.textEl.textContent !== text) {
      setText(this.textEl, text);
      this.restartPop();
    }
  }

  /** Schritt geschafft: grüner Haken und Lob (final = Tutorial vorbei, ohne Fortschritt/Überspringen). */
  done(text: string, final = false): void {
    this.el.classList.remove('hidden');
    this.el.classList.add('done');
    setText(this.textEl, text);
    this.keysEl.classList.add('hidden');
    if (final) this.footEl.classList.add('hidden');
    this.setGesture(null);
    this.restartPop();
  }

  /** Einmaliger Tipp (ohne Fortschritt/Überspringen), blendet sich selbst aus. */
  tip(text: string, seconds: number): void {
    window.clearTimeout(this.hideTimer);
    this.tipMode = true;
    this.el.classList.remove('hidden', 'done');
    this.el.classList.add('tip');
    setText(this.textEl, text);
    this.keysEl.classList.add('hidden');
    this.footEl.classList.add('hidden');
    this.setGesture(null);
    this.restartPop();
    this.hideTimer = window.setTimeout(() => this.hide(), seconds * 1000);
  }

  get showingTip(): boolean {
    return this.tipMode && this.visible;
  }

  hide(): void {
    window.clearTimeout(this.hideTimer);
    this.el.classList.add('hidden');
    this.setGesture(null);
    this.tipMode = false;
    this.markArea();
  }

  private setGesture(g: CoachGesture | null): void {
    const show = this.touch && !!g;
    this.gestureEl.classList.toggle('hidden', !show);
    this.gestureEl.classList.remove('paddle', 'steer', 'swipe');
    if (show) this.gestureEl.classList.add(g!);
  }

  private restartPop(): void {
    this.el.classList.remove('pop');
    void this.el.offsetWidth;
    this.el.classList.add('pop');
    this.markArea();
  }

  /** Meldungen (Toasts) rücken unter die Karte, solange sie sichtbar ist. */
  private markArea(): void {
    const body = document.body;
    const on = this.visible;
    body.classList.toggle('coach-on', on);
    if (!on) return;
    const parent = this.el.offsetParent as HTMLElement | null;
    const top = (parent?.getBoundingClientRect().top ?? 0) + this.el.offsetTop + this.el.offsetHeight;
    body.style.setProperty('--coach-bottom', `${Math.round(top)}px`);
  }
}
