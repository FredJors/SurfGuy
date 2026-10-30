/**
 * Homescreen-Menü im Stil mobiler Arcade-Spiele: Ressourcen oben links, Schriftzug oben mittig,
 * Symbol-Kacheln links (Shop, Skillbaum, Bestiarium, Aufgaben), großer Surfen-Knopf unten rechts.
 */
import type { SaveData } from '../core/SaveGame';
import { chapterInfo } from '../data/chapters';
import { chapterSelectable } from '../player/Progression';
import { formatNumber, h } from './dom';
import { ICONS, type IconName } from './icons';
import { icon } from './widgets';

export type MenuTarget = 'shop' | 'skills' | 'bestiary' | 'arena' | 'goals' | 'chapters' | 'settings';

/** Kacheln, an denen ein Tipp hängen kann */
export type TipTile = 'shop' | 'skills' | 'goals' | 'bestiary' | 'chapters';

export class Menu {
  readonly el: HTMLDivElement;
  private readonly pearls: HTMLSpanElement;
  private readonly best: HTMLSpanElement;
  private readonly xp: HTMLSpanElement;
  private readonly chapterBtn: HTMLButtonElement;
  private readonly chapterIco: HTMLSpanElement;
  private readonly chapterNum: HTMLSpanElement;
  private readonly chapterName: HTMLSpanElement;
  private readonly arenaIco: HTMLSpanElement;
  private readonly arenaLabel: HTMLSpanElement;
  private readonly skillBadge: HTMLSpanElement;
  private readonly goalsBadge: HTMLSpanElement;
  private readonly soundButton: HTMLButtonElement;
  private readonly arenaButton: HTMLButtonElement;
  onStart: () => void = () => {};
  onOpen: (target: MenuTarget) => void = () => {};
  private readonly tiles = new Map<MenuTarget, HTMLButtonElement>();
  private tipEl: HTMLDivElement | null = null;
  private tipTile: TipTile | null = null;
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
      this.tiles.set(target, b);
      return b;
    };

    const start = h('button', { class: 'btn primary shine play-btn start-btn' }, [h('span', { class: 'play-label', text: 'Surfen!' })]);
    start.addEventListener('click', () => this.onStart());
    // Endgegner-Arena des Kapitels (Kratersee, Gletscherlagune), sobald Keoni den Weg gezeigt hat
    this.arenaIco = icon('volcano', 'crater-ico');
    this.arenaLabel = h('span', { text: 'Krater' });
    this.arenaButton = h('button', { class: 'btn lava crater-btn hidden' }, [this.arenaIco, this.arenaLabel]);
    this.arenaButton.addEventListener('click', () => this.onOpen('arena'));
    // Kapitel-Kachel (wie die Modus-Auswahl in Arcade-Spielen): zeigt das Kapitel, öffnet die Kapitelwahl
    this.chapterIco = h('span', { class: 'chapter-btn-ico' });
    this.chapterNum = h('span', { class: 'chapter-btn-num outlined', text: '' });
    this.chapterName = h('span', { class: 'chapter-btn-name outlined', text: '' });
    this.chapterBtn = h('button', { class: 'chapter-btn', attrs: { 'aria-label': 'Kapitel wählen' } }, [
      this.chapterIco,
      h('span', { class: 'chapter-btn-text' }, [this.chapterNum, this.chapterName]),
      h('span', { class: 'chapter-btn-more outlined', text: '▸' }),
    ]);
    this.chapterBtn.addEventListener('click', () => this.onOpen('chapters'));
    this.soundButton = h('button', { class: 'icon-btn sound', html: ICONS.soundOn, attrs: { 'aria-label': 'Ton an/aus', title: 'Ton an/aus' } });
    this.soundButton.addEventListener('click', () => this.onToggleSound());
    const settingsButton = h('button', { class: 'icon-btn settings', html: ICONS.settings, attrs: { 'aria-label': 'Einstellungen', title: 'Einstellungen' } });
    settingsButton.addEventListener('click', () => this.onOpen('settings'));

    this.el = h('div', { class: 'menu interactive' }, [
      h('div', { class: 'menu-stats' }, [
        h('span', { class: 'chip' }, [h('span', { class: 'pearl-icon' }), this.pearls]),
        h('span', { class: 'chip' }, [h('span', { class: 'star-icon' }), this.best]),
        h('span', { class: 'chip' }, [h('span', { class: 'xp-icon', text: 'XP' }), this.xp]),
      ]),
      h('div', { class: 'menu-logo' }, [h('div', { class: 'logo', text: 'SURFGUY' })]),
      h('div', { class: 'menu-corner' }, [settingsButton, this.soundButton]),
      h('div', { class: 'menu-side' }, [
        tile('Shop', 'shop', 'shop'),
        tile('Skills', 'skills', 'skills', this.skillBadge),
        tile('Monster', 'bestiary', 'bestiary'),
        tile('Aufgaben', 'goals', 'goals', this.goalsBadge),
      ]),
      h('div', { class: 'menu-play' }, [this.chapterBtn, this.arenaButton, start]),
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

  /** Sprechblase an einer Kachel (Tipp für neue Spieler); null = keine. */
  setTip(tile: TipTile | null, text = ''): void {
    this.tipEl?.remove();
    this.tipEl = null;
    this.tipTile = tile;
    const target = tile === 'chapters' ? this.chapterBtn : tile ? this.tiles.get(tile) : undefined;
    if (!target) return;
    this.tipEl = h('div', { class: 'menu-tip', text });
    target.appendChild(this.tipEl);
  }

  /** Kachel, an der gerade ein Tipp hängt */
  get tip(): TipTile | null {
    return this.tipTile;
  }

  setSound(on: boolean): void {
    this.soundButton.innerHTML = on ? ICONS.soundOn : ICONS.soundOff;
    this.soundButton.classList.toggle('off', !on);
  }

  show(save: SaveData): void {
    this.pearls.textContent = formatNumber(save.pearls);
    this.best.textContent = formatNumber(save.highscore);
    this.xp.textContent = formatNumber(save.xp);
    const P = save.progress;
    const info = chapterInfo(P.activeChapter);
    this.chapterIco.innerHTML = ICONS[info.icon];
    this.chapterNum.textContent = `Kapitel ${info.id}`;
    this.chapterName.textContent = info.name;
    this.chapterBtn.style.setProperty('--c1', info.colors[0]);
    this.chapterBtn.style.setProperty('--c2', info.colors[1]);
    this.chapterBtn.classList.toggle('selectable', chapterSelectable(save));
    this.setSound(save.settings.sound);
    // Arena des gewählten Kapitels
    const arenaOpen = (P.activeChapter === 2 && P.volcanoOpen) || (P.activeChapter === 3 && P.glacierOpen);
    this.arenaButton.classList.toggle('hidden', !arenaOpen || !info.arena);
    if (info.arena) {
      this.arenaIco.innerHTML = ICONS[info.arena.icon];
      this.arenaLabel.textContent = info.arena.label;
      this.arenaButton.classList.toggle('lava', info.theme === 'fire');
      this.arenaButton.classList.toggle('ice', info.theme === 'ice');
    }
    this.el.classList.remove('hidden');
  }

  hide(): void {
    this.el.classList.add('hidden');
  }
}
