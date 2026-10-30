/**
 * Homescreen-Menü im Stil mobiler Arcade-Spiele: Ressourcen oben links, Schriftzug oben mittig,
 * Symbol-Kacheln links (Shop, Skillbaum, Bestiarium, Aufgaben), großer Surfen-Knopf unten rechts.
 */
import type { SaveData } from '../core/SaveGame';
import { formatNumber, h } from './dom';
import { ICONS, type IconName } from './icons';
import { icon } from './widgets';

export type MenuTarget = 'shop' | 'skills' | 'bestiary' | 'crater' | 'goals';

const CHAPTER_NAMES: Record<number, string> = { 1: 'Kapitel 1 · Paradies', 2: 'Kapitel 2 · Feuermeer' };

export class Menu {
  readonly el: HTMLDivElement;
  private readonly pearls: HTMLSpanElement;
  private readonly best: HTMLSpanElement;
  private readonly xp: HTMLSpanElement;
  private readonly chapter: HTMLDivElement;
  private readonly skillBadge: HTMLSpanElement;
  private readonly goalsBadge: HTMLSpanElement;
  private readonly soundButton: HTMLButtonElement;
  private readonly craterButton: HTMLButtonElement;
  onStart: () => void = () => {};
  onOpen: (target: MenuTarget) => void = () => {};
  onToggleSound: () => void = () => {};

  constructor(parent: HTMLElement) {
    this.pearls = h('span', { text: '0' });
    this.best = h('span', { text: '0' });
    this.xp = h('span', { text: '0' });
    this.skillBadge = h('span', { class: 'round-badge hidden', text: '!' });
    this.goalsBadge = h('span', { class: 'round-badge hidden', text: '!' });

    const tile = (label: string, ico: IconName, target: MenuTarget, badge?: HTMLElement) => {
      const b = h('button', { class: `menu-tile tile-${target}`, attrs: { 'aria-label': label } }, [
        h('span', { class: 'tile-face', html: ICONS[ico] }, badge ? [badge] : []),
        h('span', { class: 'tile-label outlined', text: label }),
      ]);
      b.addEventListener('click', () => this.onOpen(target));
      return b;
    };

    const start = h('button', { class: 'btn primary shine play-btn start-btn' }, [h('span', { class: 'play-label', text: 'Surfen!' })]);
    start.addEventListener('click', () => this.onStart());
    // Kratersee (Lava-Titan), sobald Keoni den Pfad gezeigt hat
    this.craterButton = h('button', { class: 'btn lava crater-btn hidden' }, [icon('volcano', 'crater-ico'), h('span', { text: 'Krater' })]);
    this.craterButton.addEventListener('click', () => this.onOpen('crater'));
    this.soundButton = h('button', { class: 'icon-btn sound', html: ICONS.soundOn, attrs: { 'aria-label': 'Ton an/aus', title: 'Ton an/aus' } });
    this.soundButton.addEventListener('click', () => this.onToggleSound());
    this.chapter = h('div', { class: 'menu-chapter outlined', text: '' });

    this.el = h('div', { class: 'menu interactive' }, [
      h('div', { class: 'menu-stats' }, [
        h('span', { class: 'chip' }, [h('span', { class: 'pearl-icon' }), this.pearls]),
        h('span', { class: 'chip' }, [h('span', { class: 'star-icon' }), this.best]),
        h('span', { class: 'chip' }, [h('span', { class: 'xp-icon', text: 'XP' }), this.xp]),
      ]),
      h('div', { class: 'menu-logo' }, [h('div', { class: 'logo', text: 'SURFGUY' }), this.chapter]),
      this.soundButton,
      h('div', { class: 'menu-side' }, [
        tile('Shop', 'shop', 'shop'),
        tile('Skills', 'skills', 'skills', this.skillBadge),
        tile('Monster', 'bestiary', 'bestiary'),
        tile('Aufgaben', 'goals', 'goals', this.goalsBadge),
      ]),
      h('div', { class: 'menu-play' }, [this.craterButton, start]),
    ]);
    parent.appendChild(this.el);
  }

  /** Hinweis am Aufgaben-Knopf: Anzahl abholbarer Belohnungen. */
  setGoalsAlert(count: number): void {
    this.goalsBadge.classList.toggle('hidden', count === 0);
    this.goalsBadge.textContent = count > 9 ? '9+' : String(count);
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
    this.xp.textContent = formatNumber(save.xp);
    const ch = save.progress.chapter;
    this.chapter.textContent = save.progress.titanDefeated ? 'Kapitel 2 geschafft!' : (CHAPTER_NAMES[ch] ?? `Kapitel ${ch}`);
    this.setSound(save.settings.sound);
    this.craterButton.classList.toggle('hidden', !save.progress.volcanoOpen);
    this.el.classList.remove('hidden');
  }

  hide(): void {
    this.el.classList.add('hidden');
  }
}
