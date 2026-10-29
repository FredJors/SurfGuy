/** Fasst alle UI-Bausteine zusammen. Das Spiel spricht nur über diese Klasse mit dem DOM. */
import { h } from './dom';
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
  private readonly loading: HTMLDivElement;
  private readonly loadingBar: HTMLDivElement;
  private fpsEl: HTMLDivElement | null = null;

  constructor(isTouch: boolean) {
    this.root = h('div', { class: 'ui-root' });
    document.body.appendChild(this.root);
    this.hud = new Hud(this.root);
    this.drawing = new DrawingPanel(this.root);
    this.feedback = new Feedback(this.root);
    this.menu = new Menu(this.root, isTouch);
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
