/** Homescreen-Menü: beschriftete Knöpfe (Start, Shop, Skillbaum, Bestiarium), Ton an/aus, Perlen/Highscore. */
import type { SaveData } from '../core/SaveGame';
import { formatNumber, h } from './dom';
import { ICONS } from './icons';

export type MenuTarget = 'shop' | 'skills' | 'bestiary' | 'crater';

export class Menu {
  readonly el: HTMLDivElement;
  private readonly pearls: HTMLSpanElement;
  private readonly best: HTMLSpanElement;
  private readonly skillBadge: HTMLSpanElement;
  private readonly soundButton: HTMLButtonElement;
  private readonly craterButton: HTMLButtonElement;
  onStart: () => void = () => {};
  onOpen: (target: MenuTarget) => void = () => {};
  onToggleSound: () => void = () => {};

  constructor(parent: HTMLElement) {
    this.pearls = h('span', { text: '0' });
    this.best = h('span', { text: '0' });
    this.skillBadge = h('span', { class: 'round-badge hidden', text: '!' });

    const start = h('button', { class: 'btn primary start-btn', text: 'Start' });
    start.addEventListener('click', () => this.onStart());
    const sub = (label: string, target: MenuTarget, cls: string) => {
      const b = h('button', { class: `btn small ${cls}`, text: label });
      b.addEventListener('click', () => this.onOpen(target));
      return b;
    };
    const skills = sub('Skillbaum', 'skills', 'green');
    // Kratersee (Lava-Titan), sobald Keoni den Pfad gezeigt hat
    this.craterButton = h('button', { class: 'btn lava crater-btn hidden', text: 'Krater' });
    this.craterButton.addEventListener('click', () => this.onOpen('crater'));
    skills.appendChild(this.skillBadge);
    this.soundButton = h('button', { class: 'round-btn sound', html: ICONS.soundOn, attrs: { 'aria-label': 'Ton an/aus', title: 'Ton an/aus' } });
    this.soundButton.addEventListener('click', () => this.onToggleSound());

    this.el = h('div', { class: 'menu interactive' }, [
      h('div', { class: 'menu-stats' }, [
        h('span', { class: 'chip' }, [h('span', { class: 'pearl-icon' }), this.pearls]),
        h('span', { class: 'chip' }, [h('span', { class: 'star-icon' }), this.best]),
      ]),
      this.soundButton,
      h('div', { class: 'menu-main' }, [start, this.craterButton, h('div', { class: 'row' }, [sub('Shop', 'shop', ''), skills, sub('Bestiarium', 'bestiary', 'pink')])]),
    ]);
    parent.appendChild(this.el);
  }

  /** Hinweis am Skillbaum-Knopf, wenn etwas freigeschaltet werden kann. */
  setSkillAlert(count: number): void {
    this.skillBadge.classList.toggle('hidden', count === 0);
  }

  setSound(on: boolean): void {
    this.soundButton.innerHTML = on ? ICONS.soundOn : ICONS.soundOff;
    this.soundButton.classList.toggle('off', !on);
  }

  show(save: SaveData): void {
    this.pearls.textContent = formatNumber(save.pearls);
    this.best.textContent = formatNumber(save.highscore);
    this.setSound(save.settings.sound);
    this.craterButton.classList.toggle('hidden', !save.progress.volcanoOpen);
    this.el.classList.remove('hidden');
  }

  hide(): void {
    this.el.classList.add('hidden');
  }
}
