/** Homescreen-Menü: nur Knöpfe mit Symbolen (Start, Shop, Skillbaum, Bestiarium, Ton) und Perlen/Highscore. */
import type { SaveData } from '../core/SaveGame';
import { formatNumber, h } from './dom';
import { ICONS, type IconId } from './icons';

export type MenuTarget = 'shop' | 'skills' | 'bestiary';

function iconButton(icon: IconId, cls: string, label: string): HTMLButtonElement {
  return h('button', { class: `round-btn ${cls}`, html: ICONS[icon], attrs: { 'aria-label': label, title: label } });
}

export class Menu {
  readonly el: HTMLDivElement;
  private readonly pearls: HTMLSpanElement;
  private readonly best: HTMLSpanElement;
  private readonly skillBadge: HTMLSpanElement;
  private readonly soundButton: HTMLButtonElement;
  onStart: () => void = () => {};
  onOpen: (target: MenuTarget) => void = () => {};
  onToggleSound: () => void = () => {};

  constructor(parent: HTMLElement) {
    this.pearls = h('span', { text: '0' });
    this.best = h('span', { text: '0' });
    this.skillBadge = h('span', { class: 'round-badge hidden', text: '!' });

    const start = iconButton('play', 'play', 'Start');
    start.addEventListener('click', () => this.onStart());
    const sub = (icon: IconId, target: MenuTarget, cls: string, label: string) => {
      const b = iconButton(icon, cls, label);
      b.addEventListener('click', () => this.onOpen(target));
      return b;
    };
    const skills = sub('skills', 'skills', 'green', 'Skillbaum');
    skills.appendChild(this.skillBadge);
    this.soundButton = iconButton('soundOn', 'sound', 'Ton an/aus');
    this.soundButton.addEventListener('click', () => this.onToggleSound());

    this.el = h('div', { class: 'menu interactive' }, [
      h('div', { class: 'menu-stats' }, [
        h('span', { class: 'chip' }, [h('span', { class: 'pearl-icon' }), this.pearls]),
        h('span', { class: 'chip' }, [h('span', { class: 'star-icon' }), this.best]),
      ]),
      this.soundButton,
      h('div', { class: 'menu-main' }, [start, h('div', { class: 'row' }, [sub('shop', 'shop', 'blue', 'Shop'), skills, sub('bestiary', 'bestiary', 'pink', 'Bestiarium')])]),
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
    this.el.classList.remove('hidden');
  }

  hide(): void {
    this.el.classList.add('hidden');
  }
}
