/** Einfache Bildschirme: „Bald verfügbar“, Pause, Game Over. */
import type { RunSummary } from '../core/events';
import type { SaveData } from '../core/SaveGame';
import type { ContentRegistries } from '../data';
import { formatNumber, h } from './dom';
import type { MenuTarget } from './Menu';

function overlay(parent: HTMLElement, panel: HTMLElement): HTMLDivElement {
  const o = h('div', { class: 'overlay' }, [panel]);
  parent.appendChild(o);
  return o;
}

export function showComingSoon(
  parent: HTMLElement,
  target: MenuTarget,
  content: ContentRegistries,
  save: SaveData,
  onClose: () => void,
): void {
  const titles: Record<MenuTarget, string> = { shop: 'Shop', skills: 'Skillbaum', bestiary: 'Bestiarium' };
  let cards: HTMLElement[] = [];
  if (target === 'skills') {
    cards = content.skills.all().map((s) => h('div', { class: 'soon-card' }, [s.name, h('small', { text: s.description })]));
  } else {
    cards = content.monsters.all().map((m) => {
      const e = save.bestiary[m.id];
      const info = e ? `gesehen ${e.seen}× · besiegt ${e.defeated}× · Stufe ${e.highestTierDefeated}/${m.tiers.length}` : '???';
      return h('div', { class: 'soon-card' }, [e ? m.name : '???', h('small', { text: info })]);
    });
  }
  const close = h('button', { class: 'btn', text: 'Zurück' });
  const panel = h('div', { class: 'panel' }, [
    h('h1', { class: 'outlined', text: titles[target] }),
    h('div', { class: 'soon-badge', text: 'Bald verfügbar' }),
    h('div', { class: 'soon-list' }, cards),
    h('div', { class: 'buttons' }, [close]),
  ]);
  const o = overlay(parent, panel);
  close.addEventListener('click', () => {
    o.remove();
    onClose();
  });
}

export function showPause(parent: HTMLElement, onResume: () => void, onMenu: () => void): () => void {
  const resume = h('button', { class: 'btn primary', text: 'Weiter' });
  const menu = h('button', { class: 'btn', text: 'Menü' });
  const o = overlay(parent, h('div', { class: 'panel' }, [h('h1', { class: 'outlined', text: 'Pause' }), h('div', { class: 'buttons' }, [resume, menu])]));
  const close = () => o.remove();
  resume.addEventListener('click', () => {
    close();
    onResume();
  });
  menu.addEventListener('click', () => {
    close();
    onMenu();
  });
  return close;
}

export function showGameOver(parent: HTMLElement, s: RunSummary, onRetry: () => void, onMenu: () => void): void {
  const retry = h('button', { class: 'btn primary', text: 'Nochmal' });
  const menu = h('button', { class: 'btn', text: 'Menü' });
  const row = (label: string, value: string) => [h('div', { class: 'label', text: label }), h('div', { class: 'value', text: value })];
  const panel = h('div', { class: 'panel' }, [
    h('h1', { class: 'outlined', text: 'Wipeout!' }),
    ...(s.newHighscore ? [h('div', { class: 'new-record', text: 'Neuer Highscore!' })] : []),
    h('div', { class: 'result-grid' }, [
      ...row('Punkte', formatNumber(s.score)),
      ...row('Perlen', `+${formatNumber(s.pearls)}`),
      ...row('Monster besiegt', String(s.monstersDefeated)),
      ...row('Tricks', String(s.tricksLanded)),
      ...row('Beste Kombo', `×${s.bestCombo}`),
      ...row('Erfahrung', `+${formatNumber(s.xp)}`),
      ...row('Highscore', formatNumber(Math.max(s.score, s.previousHighscore))),
    ]),
    h('div', { class: 'buttons' }, [retry, menu]),
  ]);
  const o = overlay(parent, panel);
  retry.addEventListener('click', () => {
    o.remove();
    onRetry();
  });
  menu.addEventListener('click', () => {
    o.remove();
    onMenu();
  });
}
