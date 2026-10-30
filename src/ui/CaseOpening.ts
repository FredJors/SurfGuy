/**
 * Truhen öffnen nach dem Run: Die Truhe wackelt, eine Walze mit Karten rauscht vorbei, wird
 * langsamer und bleibt unter der Markierung stehen. Beim Gewinn springt der Deckel auf, es blitzt,
 * Lichtstrahlen und Konfetti in der Farbe der Seltenheit (Episch/Legendär: Bildschirm bebt).
 *
 * - „Überspringen“ (oder Tippen auf die Walze) stoppt die laufende Walze sofort beim Gewinn.
 * - „Alle öffnen“ bzw. das X öffnet alle restlichen Truhen auf einmal und zeigt die Beute-Übersicht.
 * - Nach mehreren Truhen zeigt eine Übersicht alle Gewinne.
 */
import { CONFIG } from '../config/gameConfig';
import type { Rarity } from '../data/types';
import { h } from './dom';
import { ICONS } from './icons';
import { confettiAt, restartAnim } from './widgets';

export interface CaseItemView {
  name: string;
  rarity: Rarity;
  kind: 'pearls' | 'xp' | 'design';
  amount?: number;
  colors?: { base: string; stripe: string; rail: string };
}

export interface CaseOpeningOptions {
  count: number;
  /** Zieht und verbucht eine Truhe; liefert Gewinn und Ergebnistext */
  open(): { win: CaseItemView; result: string };
  /** Zufällige Karte für die Walze (nur Anzeige) */
  filler(): CaseItemView;
  sfx: { tick(): void; reveal(rarity: Rarity): void };
  done(): void;
}

const RARITY_NAME: Record<Rarity, string> = { common: 'Gewöhnlich', rare: 'Selten', epic: 'Episch', legendary: 'Legendär' };
const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
const RARITY_COLORS: Record<Rarity, string[]> = {
  common: ['#b0c3d9', '#ffffff', '#7fd6ff'],
  rare: ['#4b8bff', '#9cc2ff', '#ffffff'],
  epic: ['#d32ce6', '#f07cff', '#ffffff', '#ffd23f'],
  legendary: ['#ffd23f', '#fff6b8', '#ff8a3d', '#ffffff'],
};

function pearlPile(): string {
  const pearl = (x: number, y: number, r: number) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#pg)" stroke="#0f1330" stroke-width="2.5"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.25}" fill="#fff"/>`;
  return `<svg viewBox="0 0 80 64"><defs><radialGradient id="pg" cx="0.35" cy="0.3"><stop offset="0" stop-color="#fff"/><stop offset="0.4" stop-color="#ffe6f5"/><stop offset="1" stop-color="#e59bcb"/></radialGradient></defs>${pearl(22, 46, 12)}${pearl(46, 48, 12)}${pearl(60, 34, 10)}${pearl(34, 26, 12)}${pearl(16, 24, 8)}</svg>`;
}

function xpBottle(): string {
  return `<svg viewBox="0 0 80 64"><path d="M33 6h14v12l12 18c4 8-1 22-19 22S17 44 21 36l12-18z" fill="#7dee8a" stroke="#0f1330" stroke-width="3" stroke-linejoin="round"/><path d="M24 40c6-3 26-3 32 0c2 8-4 14-16 14s-18-6-16-14z" fill="#2ebd4f"/><rect x="31" y="2" width="18" height="7" rx="2" fill="#c98a4b" stroke="#0f1330" stroke-width="2.5"/><text x="40" y="48" text-anchor="middle" font-size="14" font-family="Lilita One, sans-serif" fill="#fff" stroke="#0f1330" stroke-width="0.8">XP</text></svg>`;
}

function boardIcon(c: { base: string; stripe: string; rail: string }): string {
  return `<svg viewBox="0 0 80 64"><g transform="rotate(-28 40 32)"><ellipse cx="40" cy="32" rx="34" ry="11" fill="${c.base}" stroke="#0f1330" stroke-width="3"/><path d="M10 32h60" stroke="${c.stripe}" stroke-width="5" stroke-linecap="round"/><ellipse cx="40" cy="32" rx="30" ry="8" fill="none" stroke="${c.rail}" stroke-width="2"/></g></svg>`;
}

const CHEST_SVG = `<svg viewBox="0 0 120 104" aria-hidden="true">
<g class="chest-body"><rect x="12" y="48" width="96" height="50" rx="7" fill="#b8692e" stroke="#0f1330" stroke-width="5"/>
<path d="M30 52v42M90 52v42" stroke="#8a4a1e" stroke-width="5"/>
<rect x="12" y="48" width="96" height="11" fill="#ffd23f" stroke="#0f1330" stroke-width="4"/>
<rect x="49" y="44" width="22" height="28" rx="5" fill="#ffd23f" stroke="#0f1330" stroke-width="4"/><circle cx="60" cy="58" r="4" fill="#0f1330"/></g>
<g class="chest-lid"><path d="M12 50V36a28 28 0 0 1 28-28h40a28 28 0 0 1 28 28v14Z" fill="#d9853c" stroke="#0f1330" stroke-width="5" stroke-linejoin="round"/>
<path d="M30 10v38M90 10v38" stroke="#ffd23f" stroke-width="7"/><path d="M30 10v38M90 10v38" stroke="#0f1330" stroke-width="2" stroke-dasharray="0" fill="none" opacity="0.25"/>
<path d="M24 22c6-6 14-8 22-8" stroke="#ffe0b0" stroke-width="5" stroke-linecap="round" fill="none"/></g></svg>`;

function card(item: CaseItemView): HTMLDivElement {
  const icon = item.kind === 'pearls' ? pearlPile() : item.kind === 'xp' ? xpBottle() : boardIcon(item.colors ?? { base: '#fff', stripe: '#ccc', rail: '#999' });
  const label = item.kind === 'design' ? item.name : item.amount ? `+${item.amount}` : item.name;
  return h('div', { class: `case-card ${item.rarity}` }, [h('div', { class: 'case-icon', html: icon }), h('div', { class: 'case-label outlined', text: label })]);
}

export function showCaseOpening(parent: HTMLElement, o: CaseOpeningOptions): void {
  let index = 0;
  const won: { item: CaseItemView; text: string }[] = [];
  const title = h('div', { class: 'case-title outlined', text: '' });
  const chest = h('div', { class: 'case-chest', html: CHEST_SVG });
  const strip = h('div', { class: 'case-strip' });
  const win = h('div', { class: 'case-window' }, [strip, h('div', { class: 'case-marker' })]);
  const banner = h('div', { class: 'case-banner outlined', text: '' });
  const result = h('div', { class: 'case-result outlined', text: '' });
  const button = h('button', { class: 'btn primary shine', text: 'Öffnen' });
  const allBtn = h('button', { class: 'btn small purple', text: 'Alle öffnen' });
  const closeBtn = h('button', { class: 'icon-btn case-close', html: ICONS.close, attrs: { 'aria-label': 'Alle öffnen und weiter', title: 'Alle öffnen und weiter' } });
  const panel = h('div', { class: 'case-panel' }, [title, chest, win, h('div', { class: 'case-reveal' }, [banner, result]), h('div', { class: 'buttons' }, [button, allBtn])]);
  const rays = h('div', { class: 'case-rays' });
  const flash = h('div', { class: 'case-flash' });
  const overlay = h('div', { class: 'overlay case-overlay interactive' }, [rays, panel, flash, closeBtn]);
  parent.appendChild(overlay);

  type Mode = 'ready' | 'spinning' | 'revealed' | 'summary';
  let mode: Mode = 'ready';
  let skipSpin = false;

  const prepare = () => {
    mode = 'ready';
    title.textContent = o.count > 1 ? `Truhe ${index + 1} / ${o.count}` : 'Truhe';
    banner.className = 'case-banner outlined';
    result.className = 'case-result outlined';
    banner.textContent = '';
    result.textContent = '';
    win.className = 'case-window';
    chest.className = 'case-chest';
    overlay.style.removeProperty('--glow');
    rays.classList.remove('on');
    strip.innerHTML = '';
    strip.style.transform = 'translateX(0px)';
    for (let i = 0; i < CONFIG.chests.reelLength; i++) strip.appendChild(card(o.filler()));
    button.textContent = 'Öffnen';
    allBtn.classList.toggle('hidden', o.count - index < 2);
  };

  const finish = () => {
    window.removeEventListener('keydown', onKey);
    overlay.remove();
    o.done();
  };

  const celebrate = (rarity: Rarity, at: HTMLElement) => {
    overlay.style.setProperty('--glow', RARITY_COLORS[rarity][0]!);
    rays.classList.add('on');
    restartAnim(flash, 'go');
    const rank = RARITY_ORDER.indexOf(rarity);
    confettiAt(overlay, at, { count: 24 + rank * 18, spread: 160 + rank * 60, colors: RARITY_COLORS[rarity] });
    if (rank >= 2) restartAnim(panel, 'quake');
  };

  const reveal = (item: CaseItemView, text: string, winner: HTMLElement) => {
    mode = 'revealed';
    winner.classList.add('won');
    chest.classList.remove('shaking');
    chest.classList.add('open', item.rarity);
    win.classList.remove('spinning');
    win.classList.add('reveal', item.rarity);
    banner.textContent = `${RARITY_NAME[item.rarity]}!`;
    banner.classList.add(item.rarity, 'show');
    result.textContent = text;
    result.classList.add('show');
    o.sfx.reveal(item.rarity);
    celebrate(item.rarity, win);
    won.push({ item, text });
    index++;
    allBtn.classList.add('hidden');
    button.textContent = index < o.count ? 'Nächste Truhe' : 'Weiter';
  };

  const spin = () => {
    if (mode !== 'ready') return;
    mode = 'spinning';
    skipSpin = false;
    button.textContent = 'Überspringen';
    allBtn.classList.add('hidden');
    chest.classList.add('shaking');
    win.classList.add('spinning');
    const { win: item, result: text } = o.open();
    const C = CONFIG.chests;
    const winner = card(item);
    strip.replaceChild(winner, strip.children[C.winIndex]!);
    // Kartenbreite messen (inkl. Abstand)
    const first = strip.children[0] as HTMLElement;
    const second = strip.children[1] as HTMLElement;
    const step = second.offsetLeft - first.offsetLeft || first.offsetWidth + 8;
    const view = win.clientWidth;
    const jitter = (Math.random() - 0.5) * step * 0.7;
    const target = C.winIndex * step + first.offsetWidth / 2 - view / 2 + jitter;
    const duration = C.spinTime * 1000;
    const t0 = performance.now();
    let lastIdx = -1;
    const frame = (now: number) => {
      const t = skipSpin ? 1 : Math.min(1, (now - t0) / duration);
      const k = 1 - Math.pow(1 - t, 4);
      const x = target * k;
      strip.style.transform = `translateX(${-x}px)`;
      const idx = Math.floor((x + view / 2) / step);
      if (idx !== lastIdx && !skipSpin) {
        lastIdx = idx;
        o.sfx.tick();
      }
      if (t < 1) {
        requestAnimationFrame(frame);
        return;
      }
      reveal(item, text, winner);
    };
    requestAnimationFrame(frame);
  };

  /** Restliche Truhen sofort öffnen und die Übersicht zeigen. */
  const openAll = () => {
    if (mode === 'summary') return;
    if (mode === 'spinning') {
      // laufende Walze zuerst beenden (der Gewinn ist schon verbucht)
      skipSpin = true;
      requestAnimationFrame(() => requestAnimationFrame(openAll));
      return;
    }
    while (index < o.count) {
      const r = o.open();
      won.push({ item: r.win, text: r.result });
      index++;
    }
    showSummary(true);
  };

  const showSummary = (instantOpen: boolean) => {
    mode = 'summary';
    const best = won.reduce<Rarity>((b, w) => (RARITY_ORDER.indexOf(w.item.rarity) > RARITY_ORDER.indexOf(b) ? w.item.rarity : b), 'common');
    if (instantOpen) o.sfx.reveal(best);
    closeBtn.classList.add('hidden');
    const grid = h(
      'div',
      { class: 'case-summary-grid' },
      won.map((w, i) => {
        const c = h('div', { class: 'case-loot' }, [card(w.item), h('div', { class: 'case-loot-text', text: w.text })]);
        c.style.animationDelay = `${Math.min(i, 12) * 0.07}s`;
        return c;
      }),
    );
    const next = h('button', { class: 'btn primary shine', text: 'Weiter' });
    next.addEventListener('click', finish);
    panel.innerHTML = '';
    panel.classList.add('summary');
    panel.append(h('div', { class: 'case-title outlined', text: won.length > 1 ? 'Deine Beute' : 'Gewonnen!' }), grid, h('div', { class: 'buttons' }, [next]));
    celebrate(best, grid);
  };

  const main = () => {
    if (mode === 'ready') spin();
    else if (mode === 'spinning') skipSpin = true;
    else if (mode === 'revealed') {
      if (index < o.count) {
        prepare();
        spin();
      } else if (won.length > 1) showSummary(false);
      else finish();
    }
  };

  button.addEventListener('click', main);
  win.addEventListener('pointerdown', () => {
    if (mode === 'spinning') skipSpin = true;
  });
  allBtn.addEventListener('click', openAll);
  closeBtn.addEventListener('click', openAll);
  function onKey(e: KeyboardEvent): void {
    if (e.code === 'Escape') openAll();
    else if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (mode === 'summary') finish();
      else main();
    }
  }
  window.addEventListener('keydown', onKey);
  prepare();
}
