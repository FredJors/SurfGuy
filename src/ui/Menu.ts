/** Homescreen-Menü: Start (aktiv), Boards, Skillbaum, Bestiarium. */
import type { SaveData } from '../core/SaveGame';
import { formatNumber, h } from './dom';

export type MenuTarget = 'boards' | 'skills' | 'bestiary';

export class Menu {
  readonly el: HTMLDivElement;
  private readonly pearls: HTMLSpanElement;
  private readonly best: HTMLSpanElement;
  private readonly xp: HTMLSpanElement;
  onStart: () => void = () => {};
  onOpen: (target: MenuTarget) => void = () => {};

  constructor(parent: HTMLElement, isTouch: boolean) {
    this.pearls = h('span', { text: '0' });
    this.best = h('span', { text: '0' });
    this.xp = h('span', { text: '0' });
    const start = h('button', { class: 'btn primary', text: 'Start' });
    start.addEventListener('click', () => this.onStart());
    const sub = (label: string, target: MenuTarget, cls: string) => {
      const b = h('button', { class: `btn small ${cls}` }, [label, h('span', { class: 'btn-badge', text: 'bald' })]);
      b.addEventListener('click', () => this.onOpen(target));
      return b;
    };
    this.el = h('div', { class: 'menu interactive' }, [
      h('div', { class: 'logo outlined', html: 'SURF<span>GUY</span>' }),
      h('div', { class: 'tagline outlined', text: 'Wellen reiten · Tricks zeichnen · Monster besiegen' }),
      start,
      h('div', { class: 'row' }, [sub('Boards', 'boards', ''), sub('Skillbaum', 'skills', 'green'), sub('Bestiarium', 'bestiary', 'pink')]),
      h('div', { class: 'stats' }, [
        h('span', { class: 'chip' }, [h('span', { class: 'pearl-icon' }), this.pearls]),
        h('span', { class: 'chip' }, [h('span', { class: 'star-icon' }), this.best]),
        h('span', { class: 'chip' }, ['XP ', this.xp]),
      ]),
      h('div', {
        class: 'hint outlined',
        text: isTouch
          ? 'Links: Joystick · Rechts nach oben wischen: Sprung · Im Fenster zeichnen'
          : 'A/D drehen · W paddeln · S bremsen · Leertaste springen · Maus zeichnen',
      }),
    ]);
    parent.appendChild(this.el);
  }

  show(save: SaveData): void {
    this.pearls.textContent = formatNumber(save.pearls);
    this.best.textContent = formatNumber(save.highscore);
    this.xp.textContent = formatNumber(save.xp);
    this.el.classList.remove('hidden');
  }

  hide(): void {
    this.el.classList.add('hidden');
  }
}
