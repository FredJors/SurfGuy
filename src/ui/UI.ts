/** Fasst alle UI-Bausteine zusammen. Das Spiel spricht nur über diese Klasse mit dem DOM. */
import { h } from './dom';
import { DialogBox } from './Dialog';
import { DrawingPanel } from './DrawingPanel';
import { Feedback } from './Feedback';
import { Hud } from './Hud';
import { Menu } from './Menu';

export class UI {
  readonly root: HTMLDivElement;
  readonly menu: Menu;
  readonly hud: Hud;
  readonly drawing: DrawingPanel;
  readonly feedback: Feedback;
  readonly dialog: DialogBox;
  private readonly loading: HTMLDivElement;
  private readonly loadingBar: HTMLDivElement;
  private fpsEl: HTMLDivElement | null = null;

  constructor() {
    this.root = h('div', { class: 'ui-root' });
    document.body.appendChild(this.root);
    this.hud = new Hud(this.root);
    this.drawing = new DrawingPanel(this.root);
    this.feedback = new Feedback(this.root);
    this.dialog = new DialogBox(this.root);
    this.menu = new Menu(this.root);
    this.menu.hide();

    this.loadingBar = h('div');
    this.loading = h('div', { class: 'loading' }, [
      h('div', { class: 'title outlined', text: 'SURFGUY' }),
      h('div', { class: 'bar' }, [this.loadingBar]),
    ]);
    document.body.appendChild(this.loading);

    document.body.appendChild(
      h('div', { class: 'rotate-hint' }, [h('div', { class: 'phone' }), h('div', { class: 'text outlined', text: 'Bitte drehen' })]),
    );
  }

  /** Schwarz abblenden, `mid` aufrufen (z. B. Ortswechsel) und wieder aufblenden. */
  fadeThrough(mid: () => void, outMs = 600, inMs = 800): void {
    const el = h('div', { class: 'fade-black' });
    this.root.appendChild(el);
    el.style.transitionDuration = `${outMs}ms`;
    requestAnimationFrame(() => (el.style.opacity = '1'));
    setTimeout(() => {
      mid();
      el.style.transitionDuration = `${inMs}ms`;
      el.style.opacity = '0';
      setTimeout(() => el.remove(), inMs + 50);
    }, outMs + 30);
  }

  /** Großer Kapitel-Titel (blendet sich selbst aus). */
  chapterTitle(small: string, big: string, color = '#ff8a3d'): void {
    const bigEl = h('div', { class: 'chapter-big outlined', text: big });
    bigEl.style.color = color;
    const el = h('div', { class: 'chapter-title' }, [h('div', {}, [h('div', { class: 'chapter-small outlined', text: small }), bigEl])]);
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 4100);
  }

  setLoading(progress: number): void {
    this.loadingBar.style.width = `${Math.round(progress * 100)}%`;
  }

  hideLoading(): void {
    this.loading.style.opacity = '0';
    setTimeout(() => this.loading.remove(), 450);
  }

  showFps(fps: number, extra = ''): void {
    if (!this.fpsEl) {
      this.fpsEl = h('div', { class: 'fps' });
      this.root.appendChild(this.fpsEl);
    }
    this.fpsEl.textContent = `${fps.toFixed(0)} fps ${extra}`;
  }
}
