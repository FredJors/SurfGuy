/** Homescreen-Menü: Start (aktiv), Boards, Skillbaum, Bestiarium. */
import type { SaveData } from '../core/SaveGame';
import { formatNumber, h } from './dom';

export type MenuTarget = 'shop' | 'skills' | 'bestiary';

export class Menu {
  readonly el: HTMLDivElement;
  private readonly pearls: HTMLSpanElement;
  private readonly best: HTMLSpanElement;
  private readonly xp: HTMLSpanElement;
  private readonly skillBadge: HTMLSpanElement;
  onStart: () => void = () => {};
  onOpen: (target: MenuTarget) => void = () => {};

  constructor(parent: HTMLElement, isTouch: boolean) {
    this.pearls = h('span', { text: '0' });
    this.best = h('span', { text: '0' });
    this.xp = h('span', { text: '0' });
    this.skillBadge = h('span', { class: 'btn-badge alert hidden', text: '!' });
    const start = h('button', { class: 'btn primary', text: 'Start' });
    start.addEventListener('click', () => this.onStart());
    const sub = (label: string, target: MenuTarget, cls: string, soon = false) => {
      const b = h('button', { class: `btn small ${cls}` }, [label, ...(soon ? [h('span', { class: 'btn-badge', text: 'bald' })] : [])]);
      b.addEventListener('click', () => this.onOpen(target));
      return b;
    };
    this.el = h('div', { class: 'menu interactive' }, [
      h('div', { class: 'logo outlined', html: 'SURF<span>GUY</span>' }),
      h('div', { class: 'tagline outlined', text: 'Wellen reiten · Tricks zeichnen · Monster besiegen' }),
      start,
      h('div', { class: 'row' }, [sub('Shop', 'shop', ''), sub('Skillbaum', 'skills', 'green'), sub('Bestiarium', 'bestiary', 'pink', true)]),
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
    this.el.querySelector('.btn.green')?.appendChild(this.skillBadge);
    parent.appendChild(this.el);
  }

  /** Hinweis am Skillbaum-Knopf, wenn etwas freigeschaltet werden kann. */
  setSkillAlert(count: number): void {
    this.skillBadge.classList.toggle('hidden', count === 0);
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
