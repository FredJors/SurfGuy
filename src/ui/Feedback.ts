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

  private lastFly = 0;

  /** Perle fliegt von einer Bildschirmposition zum Perlen-Zähler. */
  pearlFly(x: number, y: number, target: HTMLElement, gold = false): void {
    const now = performance.now();
    if (now - this.lastFly < 45) return;
    this.lastFly = now;
    const r = target.getBoundingClientRect();
    if (!r.width) return;
    const el = h('div', { class: `pearl-fly pearl-icon ${gold ? 'gold' : ''}` });
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.parent.appendChild(el);
    const tx = r.left + 18 - x;
    const ty = r.top + r.height / 2 - y;
    requestAnimationFrame(() => {
      el.style.transform = `translate(${tx}px, ${ty}px) scale(0.7)`;
      el.style.opacity = '0.9';
    });
    setTimeout(() => el.remove(), 560);
  }

  /** Großer Stempel-Text in der Bildmitte (z. B. „WRACK-SPRUNG!“). */
  stamp(text: string, color = '#ffd23f', sub = ''): void {
    this.parent.querySelectorAll('.stamp').forEach((e) => e.remove());
    const el = h('div', { class: 'stamp' }, [h('div', { class: 'stamp-main outlined', text }), ...(sub ? [h('div', { class: 'stamp-sub outlined', text: sub })] : [])]);
    (el.firstChild as HTMLElement).style.color = color;
    this.parent.appendChild(el);
    setTimeout(() => el.remove(), 1400);
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
