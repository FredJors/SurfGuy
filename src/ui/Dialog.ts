/**
 * Dialogfenster für die Geschichte: Name, Text mit Schreibmaschinen-Effekt, Weiter per Tippen,
 * Klick, Leertaste oder Enter. Ein noch tippender Text wird beim ersten Tippen komplett gezeigt.
 */
import { h } from './dom';

export interface DialogLine {
  who: string;
  text: string;
}

export class DialogBox {
  private readonly el: HTMLDivElement;
  private readonly name: HTMLDivElement;
  private readonly text: HTMLDivElement;
  private full = '';
  private shown = 0;
  private typing = false;
  private onNext: (() => void) | null = null;
  private acc = 0;
  private readonly keyHandler = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      this.advance();
    }
  };

  constructor(parent: HTMLElement) {
    this.name = h('div', { class: 'dialog-name outlined', text: '' });
    this.text = h('div', { class: 'dialog-text', text: '' });
    const next = h('div', { class: 'dialog-next', text: '▸' });
    this.el = h('div', { class: 'dialog interactive hidden' }, [this.name, this.text, next]);
    this.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.advance();
    });
    parent.appendChild(this.el);
  }

  get isOpen(): boolean {
    return !this.el.classList.contains('hidden');
  }

  /** Zeigt eine Zeile; `onNext` wird aufgerufen, wenn der Spieler weiterklickt. */
  show(line: DialogLine, onNext: () => void): void {
    this.el.classList.remove('hidden');
    this.name.textContent = line.who;
    this.full = line.text;
    this.shown = 0;
    this.text.textContent = '';
    this.typing = true;
    this.onNext = onNext;
    window.addEventListener('keydown', this.keyHandler);
  }

  hide(): void {
    this.el.classList.add('hidden');
    this.onNext = null;
    window.removeEventListener('keydown', this.keyHandler);
  }

  private advance(): void {
    if (this.typing) {
      this.shown = this.full.length;
      this.text.textContent = this.full;
      this.typing = false;
      return;
    }
    const cb = this.onNext;
    this.onNext = null;
    cb?.();
  }

  /** Schreibmaschinen-Effekt (echte Sekunden). */
  update(realDt: number): void {
    if (!this.typing) return;
    this.acc += realDt * 45;
    const n = Math.floor(this.acc);
    if (n <= 0) return;
    this.acc -= n;
    this.shown = Math.min(this.full.length, this.shown + n);
    this.text.textContent = this.full.slice(0, this.shown);
    if (this.shown >= this.full.length) this.typing = false;
  }
}
