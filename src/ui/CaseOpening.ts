/**
 * Truhen öffnen nach dem Run – im Stil der Case-Openings aus CS:GO: Eine Walze mit Karten
 * rauscht vorbei, wird langsamer und bleibt unter der Markierung stehen. Die Farbe am Kartenrand
 * zeigt die Seltenheit. Jede vorbeilaufende Karte tickt, der Gewinn wird groß gezeigt.
 */
import { CONFIG } from '../config/gameConfig';
import type { Rarity } from '../data/types';
import { h } from './dom';

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

function pearlPile(): string {
  const pearl = (x: number, y: number, r: number) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#pg)" stroke="#1d2140" stroke-width="2.5"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.25}" fill="#fff"/>`;
  return `<svg viewBox="0 0 80 64"><defs><radialGradient id="pg" cx="0.35" cy="0.3"><stop offset="0" stop-color="#fff"/><stop offset="0.4" stop-color="#ffe6f5"/><stop offset="1" stop-color="#e59bcb"/></radialGradient></defs>${pearl(22, 46, 12)}${pearl(46, 48, 12)}${pearl(60, 34, 10)}${pearl(34, 26, 12)}${pearl(16, 24, 8)}</svg>`;
}

function xpBottle(): string {
  return `<svg viewBox="0 0 80 64"><path d="M33 6h14v12l12 18c4 8-1 22-19 22S17 44 21 36l12-18z" fill="#7dee8a" stroke="#1d2140" stroke-width="3" stroke-linejoin="round"/><path d="M24 40c6-3 26-3 32 0c2 8-4 14-16 14s-18-6-16-14z" fill="#2ebd4f"/><rect x="31" y="2" width="18" height="7" rx="2" fill="#c98a4b" stroke="#1d2140" stroke-width="2.5"/><text x="40" y="47" text-anchor="middle" font-size="13" font-weight="900" fill="#fff" stroke="#1d2140" stroke-width="0.8">XP</text></svg>`;
}

function boardIcon(c: { base: string; stripe: string; rail: string }): string {
  return `<svg viewBox="0 0 80 64"><g transform="rotate(-28 40 32)"><ellipse cx="40" cy="32" rx="34" ry="11" fill="${c.base}" stroke="#1d2140" stroke-width="3"/><path d="M10 32h60" stroke="${c.stripe}" stroke-width="5" stroke-linecap="round"/><ellipse cx="40" cy="32" rx="30" ry="8" fill="none" stroke="${c.rail}" stroke-width="2"/></g></svg>`;
}

function card(item: CaseItemView): HTMLDivElement {
  const icon = item.kind === 'pearls' ? pearlPile() : item.kind === 'xp' ? xpBottle() : boardIcon(item.colors ?? { base: '#fff', stripe: '#ccc', rail: '#999' });
  const label = item.kind === 'design' ? item.name : item.amount ? `+${item.amount}` : item.name;
  return h('div', { class: `case-card ${item.rarity}` }, [h('div', { class: 'case-icon', html: icon }), h('div', { class: 'case-label', text: label })]);
}

export function showCaseOpening(parent: HTMLElement, o: CaseOpeningOptions): void {
  let index = 0;
  const title = h('div', { class: 'case-title outlined', text: '' });
  const strip = h('div', { class: 'case-strip' });
  const win = h('div', { class: 'case-window' }, [strip, h('div', { class: 'case-marker' })]);
  const result = h('div', { class: 'case-result outlined', text: '' });
  const button = h('button', { class: 'btn primary', text: 'Öffnen' });
  const skip = h('button', { class: 'btn small', text: 'Alle schnell öffnen' });
  const panel = h('div', { class: 'case-panel' }, [title, win, result, h('div', { class: 'buttons' }, [button, skip])]);
  const overlay = h('div', { class: 'overlay case-overlay interactive' }, [panel]);
  parent.appendChild(overlay);
  let spinning = false;
  let fast = false;

  const prepare = () => {
    title.textContent = `Truhe ${index + 1} / ${o.count}`;
    result.textContent = '';
    result.className = 'case-result outlined';
    strip.innerHTML = '';
    strip.style.transform = 'translateX(0px)';
    for (let i = 0; i < CONFIG.chests.reelLength; i++) strip.appendChild(card(o.filler()));
    button.textContent = 'Öffnen';
    button.disabled = false;
    skip.classList.toggle('hidden', o.count - index < 2);
  };

  const finish = () => {
    overlay.remove();
    o.done();
  };

  const spin = () => {
    if (spinning) return;
    spinning = true;
    button.disabled = true;
    skip.classList.add('hidden');
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
    const duration = (fast ? 0.9 : C.spinTime) * 1000;
    const t0 = performance.now();
    let lastIdx = -1;
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const k = 1 - Math.pow(1 - t, 4);
      const x = target * k;
      strip.style.transform = `translateX(${-x}px)`;
      const idx = Math.floor((x + view / 2) / step);
      if (idx !== lastIdx) {
        lastIdx = idx;
        if (!fast || idx % 3 === 0) o.sfx.tick();
      }
      if (t < 1) {
        requestAnimationFrame(frame);
        return;
      }
      // Gewinn zeigen
      spinning = false;
      winner.classList.add('won');
      result.textContent = `${RARITY_NAME[item.rarity]}: ${text}`;
      result.classList.add(item.rarity, 'show');
      o.sfx.reveal(item.rarity);
      index++;
      if (fast && index < o.count) {
        setTimeout(() => {
          prepare();
          spin();
        }, 500);
        return;
      }
      button.disabled = false;
      button.textContent = index < o.count ? 'Nächste Truhe' : 'Weiter';
    };
    requestAnimationFrame(frame);
  };

  button.addEventListener('click', () => {
    if (spinning) return;
    if (button.textContent === 'Öffnen') spin();
    else if (index < o.count) {
      prepare();
      spin();
    } else finish();
  });
  skip.addEventListener('click', () => {
    fast = true;
    spin();
  });
  prepare();
}
