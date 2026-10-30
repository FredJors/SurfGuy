/**
 * Kapitelwahl: eine Karte pro Kapitel mit Fortschritt (Kreaturen-Stufen, Endgegner).
 * Erreichte Kapitel lassen sich wählen, das nächste wird als gesperrt angedeutet.
 */
import type { SaveData } from '../core/SaveGame';
import type { ContentRegistries } from '../data';
import { CHAPTERS } from '../data/chapters';
import { bestiaryProgress } from '../player/Progression';
import { h } from './dom';
import { ICONS } from './icons';
import { backButton, icon } from './widgets';

export interface ChapterSelectCallbacks {
  select(chapter: number): void;
  close(): void;
}

export class ChapterSelectScreen {
  private readonly overlay: HTMLDivElement;

  constructor(parent: HTMLElement, content: ContentRegistries, save: SaveData, cb: ChapterSelectCallbacks) {
    const P = save.progress;
    const close = backButton(() => {
      this.overlay.remove();
      cb.close();
    });
    const cards = CHAPTERS.filter((c) => c.id <= P.chapter + 1).map((c, i) => {
      const reached = c.id <= P.chapter;
      const active = c.id === P.activeChapter;
      const prog = bestiaryProgress(content, save, c.id);
      const bossDone = [P.bossDefeated, P.titanDefeated, P.colossusDefeated][c.id - 1] ?? false;
      const pct = prog.total ? (prog.done / prog.total) * 100 : 0;
      const card = h('button', { class: `chapter-card ${reached ? '' : 'locked'} ${active ? 'active' : ''}`, attrs: { 'aria-label': `Kapitel ${c.id}: ${c.name}` } }, [
        h('div', { class: 'chapter-art', html: reached ? ICONS[c.icon] : ICONS.lock }),
        h('div', { class: 'chapter-num outlined', text: `Kapitel ${c.id}` }),
        h('div', { class: 'chapter-name outlined', text: reached ? c.name : '???' }),
        h('div', { class: 'chapter-tag', text: reached ? c.tagline : `Schaffe Kapitel ${c.id - 1}, um es zu öffnen.` }),
        ...(reached
          ? [
              h('div', { class: 'chapter-prog' }, [
                h('div', { class: 'goal-bar' }, [h('div', { class: 'goal-fill', attrs: { style: `width:${pct.toFixed(1)}%` } })]),
                h('span', { class: 'chapter-prog-text outlined', text: `${prog.done} / ${prog.total}` }),
              ]),
              h('div', { class: `chapter-boss ${bossDone ? 'done' : ''}` }, [bossDone ? '✓ Endgegner besiegt' : 'Endgegner wartet']),
            ]
          : []),
        ...(active ? [h('div', { class: 'chapter-badge outlined', text: 'Aktiv' })] : []),
      ]);
      card.style.setProperty('--c1', c.colors[0]);
      card.style.setProperty('--c2', c.colors[1]);
      card.style.animationDelay = `${i * 0.07}s`;
      if (reached && !active) {
        card.addEventListener('click', () => {
          this.overlay.remove();
          cb.select(c.id);
        });
      }
      return card;
    });
    const panel = h('div', { class: 'panel chapter-panel' }, [
      h('div', { class: 'side-header' }, [h('h2', { class: 'outlined', text: 'Kapitel wählen' }), close]),
      h('div', { class: 'chapter-row' }, cards),
      h('div', { class: 'chapter-hint soft' }, [icon('star', 'hint-ico'), 'Monster, Rampen und Stimmung richten sich nach dem Kapitel. Fortschritt und Ausrüstung bleiben.']),
    ]);
    this.overlay = h('div', { class: 'overlay' }, [panel]);
    parent.appendChild(this.overlay);
  }
}
