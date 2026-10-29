/** Einblendungen: Hinweise (Toasts), Trickname + Qualität, schwebende Punkte. */
import { h } from './dom';

export class Feedback {
  private readonly toasts: HTMLDivElement;
  private lastToast = new Map<string, number>();

  constructor(private readonly parent: HTMLElement) {
    this.toasts = h('div', { class: 'toast-area' });
    parent.appendChild(this.toasts);
  }

  /** Kurzer Hinweis. Gleiche Texte werden höchstens alle `cooldown` ms gezeigt. */
  toast(text: string, kind: 'info' | 'warn' = 'info', cooldown = 2500): void {
    const now = performance.now();
    if ((this.lastToast.get(text) ?? -Infinity) > now - cooldown) return;
    this.lastToast.set(text, now);
    const el = h('div', { class: `toast outlined ${kind === 'warn' ? 'warn' : ''}`, text });
    this.toasts.appendChild(el);
    while (this.toasts.childElementCount > 3) this.toasts.firstElementChild?.remove();
    setTimeout(() => el.remove(), 2300);
  }

  trick(name: string, quality: string, color: string): void {
    this.parent.querySelectorAll('.trick-popup').forEach((e) => e.remove());
    const el = h('div', { class: 'trick-popup' }, [
      h('div', { class: 'name outlined', text: name }),
      h('div', { class: 'quality outlined', text: quality }),
    ]);
    (el.firstChild as HTMLElement).style.color = color;
    this.parent.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  /** Schwebende Punkte an einer Bildschirmposition. */
  scorePop(text: string, x: number, y: number, color = '#ffffff'): void {
    const el = h('div', { class: 'score-pop outlined', text });
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.color = color;
    this.parent.appendChild(el);
    setTimeout(() => el.remove(), 1150);
  }
}
