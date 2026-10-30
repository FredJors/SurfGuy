/**
 * Bildschirme: Pause und Spielende. Das Spielende läuft als Animationsfolge ab – Titel knallt rein,
 * Punkte zählen hoch und schalten Sterne frei, Statistik-Karten ploppen auf, Tagesaufgaben füllen
 * sich, zum Schluss springen die Knöpfe herein. Ein Tippen irgendwo zeigt sofort alles.
 */
import { CONFIG } from '../config/gameConfig';
import type { RunSummary } from '../core/events';
import type { Rarity } from '../data/types';
import { formatNumber, h } from './dom';
import { ICONS, type IconName } from './icons';
import { Timeline, confettiAt, countUp, icon } from './widgets';

function overlay(parent: HTMLElement, panel: HTMLElement): HTMLDivElement {
  const o = h('div', { class: 'overlay' }, [panel]);
  parent.appendChild(o);
  return o;
}

export function showPause(parent: HTMLElement, onResume: () => void, onMenu: () => void): () => void {
  const resume = h('button', { class: 'btn primary shine', text: 'Weiter' });
  const menu = h('button', { class: 'btn', text: 'Menü' });
  const o = overlay(parent, h('div', { class: 'panel pause-panel' }, [h('h1', { class: 'outlined', text: 'Pause' }), h('div', { class: 'buttons' }, [resume, menu])]));
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

export interface ResultMission {
  text: string;
  /** Fortschritt vor dem Run */
  from: number;
  /** Fortschritt jetzt */
  to: number;
  goal: number;
  claimed: boolean;
}

export interface GameOverOptions {
  onRetry(): void;
  onMenu(): void;
  /** Eingesammelte Truhen öffnen; `done` kommt nach dem letzten Gewinn */
  openChests?: (done: () => void) => void;
  missions?: ResultMission[];
  sfx?: { tick(): void; reveal(rarity: Rarity): void; land(strength: number): void };
}

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function showGameOver(parent: HTMLElement, s: RunSummary, o: GameOverOptions): void {
  const win = !!s.title && s.title !== 'Wipeout!';
  const tl = new Timeline();
  const sfx = o.sfx;
  const STARS = CONFIG.results.stars;

  const title = h('div', { class: `result-title outlined ${win ? 'win' : ''}`, text: s.title ?? 'Wipeout!' });
  const score = h('div', { class: 'result-score outlined', text: '0' });
  const stars = STARS.map((_, i) => h('span', { class: `result-star s${i}`, html: ICONS.star }));
  const record = h('div', { class: 'result-record' }, [h('span', { class: 'outlined', text: 'Neuer Highscore!' })]);
  const best = h('div', { class: 'result-best soft', text: `Highscore ${formatNumber(Math.max(s.score, s.previousHighscore))} · Zeit ${fmtTime(s.duration)}` });

  // Statistik-Karten
  const stat = (ico: IconName | 'pearl', label: string, value: number, prefix = '') => {
    const v = h('div', { class: 'stat-value outlined', text: `${prefix}0` });
    const card = h('div', { class: 'stat-card card' }, [
      ico === 'pearl' ? h('span', { class: 'stat-ico pearl-icon' }) : icon(ico, 'stat-ico'),
      h('div', { class: 'stat-text' }, [v, h('div', { class: 'stat-label', text: label })]),
    ]);
    return { card, v, value, prefix };
  };
  const stats = [
    stat('pearl', 'Perlen', s.pearls, '+'),
    stat('monster', 'Monster', s.monstersDefeated),
    stat('trick', 'Tricks', s.tricksLanded),
    stat('combo', 'Beste Kombo', s.bestCombo, '×'),
    stat('xp', 'Erfahrung', s.xp, '+'),
    s.chests > 0 ? stat('chest', 'Truhen', s.chests) : stat('wave', 'Wellen', s.wavesRidden),
  ];

  // Tagesaufgaben
  const missions = (o.missions ?? []).map((m) => {
    const pct = (v: number) => `${(Math.max(0, Math.min(1, m.goal > 0 ? v / m.goal : 1)) * 100).toFixed(1)}%`;
    const fill = h('div', { class: 'goal-fill', attrs: { style: `width:${pct(m.from)}` } });
    const count = h('div', { class: 'rm-count outlined', text: `${formatNumber(Math.min(m.from, m.goal))} / ${formatNumber(m.goal)}` });
    const newlyDone = m.from < m.goal && m.to >= m.goal;
    const row = h('div', { class: `result-mission ${m.to >= m.goal ? 'done' : ''}` }, [
      h('div', { class: 'rm-text', text: m.text }),
      h('div', { class: 'rm-bar' }, [h('div', { class: 'goal-bar' }, [fill]), count]),
    ]);
    return { m, row, fill, count, pct, newlyDone };
  });

  const buttons = h('div', { class: 'result-buttons' });
  const skipHint = h('div', { class: 'result-skip outlined', text: 'Tippen zum Überspringen' });
  const box = h('div', { class: 'result' }, [
    h('div', { class: 'result-head' }, [title]),
    h('div', { class: 'result-body' }, [
      h('div', { class: 'result-left' }, [h('div', { class: 'result-score-label', text: 'Punkte' }), score, h('div', { class: 'result-stars' }, stars), record, best]),
      h('div', { class: 'result-right' }, [
        h('div', { class: 'result-stats' }, stats.map((x) => x.card)),
        ...(missions.length ? [h('div', { class: 'result-missions' }, [h('div', { class: 'rm-head outlined', text: 'Tagesaufgaben' }), ...missions.map((x) => x.row)])] : []),
      ]),
    ]),
    buttons,
    skipHint,
  ]);
  const root = h('div', { class: `overlay result-overlay interactive ${win ? 'win' : ''}` }, [h('div', { class: 'result-rays' }), box]);
  parent.appendChild(root);

  const close = () => {
    tl.dispose();
    window.removeEventListener('keydown', onKey);
    root.remove();
  };
  const btn = (label: string, cls: string, fn: () => void, ico?: IconName) => {
    const b = h('button', { class: `btn ${cls}` }, [...(ico ? [icon(ico)] : []), label]);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      fn();
    });
    return b;
  };
  const showFinalButtons = (instant: boolean) => {
    buttons.innerHTML = '';
    buttons.append(
      btn('Nochmal', 'primary shine', () => {
        close();
        o.onRetry();
      }),
      btn('Menü', 'wide', () => {
        close();
        o.onMenu();
      }),
    );
    buttons.classList.toggle('in', !instant);
  };
  const showButtons = (instant: boolean) => {
    skipHint.classList.add('hidden');
    if (!o.openChests) {
      showFinalButtons(instant);
      return;
    }
    const open = o.openChests;
    buttons.innerHTML = '';
    const chestBtn = btn(
      s.chests > 1 ? `${s.chests} Truhen öffnen` : 'Truhe öffnen',
      'primary shine chest-btn',
      () => {
        chestBtn.disabled = true;
        open(() => showFinalButtons(false));
      },
      'chest',
    );
    buttons.append(chestBtn);
    buttons.classList.toggle('in', !instant);
  };

  // --- Ablauf ---
  const T_SCORE = 650;
  const countMs = CONFIG.results.countUpMs;
  let starsLit = 0;
  const lightStars = (v: number, instant: boolean) => {
    while (starsLit < STARS.length && v >= STARS[starsLit]!) {
      const el = stars[starsLit]!;
      el.classList.add('lit');
      if (!instant) {
        sfx?.reveal((['common', 'rare', 'epic'] as const)[starsLit] ?? 'epic');
        confettiAt(root, el, { count: 14, spread: 90, colors: ['#ffd23f', '#fff6b8', '#ffffff'] });
      }
      starsLit++;
    }
  };
  tl.add(80, (instant) => {
    title.classList.add('in');
    if (!instant) {
      sfx?.land(1);
      box.classList.add('shake');
    }
  });
  tl.add(T_SCORE, (instant) => {
    let ticks = 0;
    tl.track(
      countUp(score, s.score, instant ? 0 : countMs, {
        onStep: (v) => {
          if (!instant && ticks++ % 3 === 0) sfx?.tick();
          lightStars(v, tl.skipped || instant);
        },
      }),
    );
  });
  stats.forEach((x, i) => {
    tl.add(900 + i * 130, (instant) => {
      x.card.classList.add('in');
      tl.track(countUp(x.v, x.value, instant ? 0 : 520, { format: (n) => `${x.prefix}${formatNumber(n)}` }));
    });
  });
  const T_MISSIONS = 900 + stats.length * 130 + 150;
  missions.forEach((x, i) => {
    tl.add(T_MISSIONS + i * 220, (instant) => {
      x.row.classList.add('in');
      if (instant) x.fill.style.transition = 'none';
      requestAnimationFrame(() => (x.fill.style.width = x.pct(x.m.to)));
      tl.track(countUp(x.count, Math.min(x.m.to, x.m.goal), instant ? 0 : 800, { from: Math.min(x.m.from, x.m.goal), format: (n) => `${formatNumber(n)} / ${formatNumber(x.m.goal)}` }));
      if (x.newlyDone) {
        const mark = () => {
          x.row.classList.add('fresh');
          x.row.appendChild(h('span', { class: 'rm-check outlined', text: '✓' }));
        };
        if (instant) mark();
        else
          setTimeout(() => {
            mark();
            sfx?.reveal('rare');
          }, 820);
      }
    });
  });
  const T_RECORD = T_SCORE + countMs + 120;
  if (s.newHighscore) {
    tl.add(T_RECORD, (instant) => {
      record.classList.add('show');
      if (!instant) {
        sfx?.reveal('legendary');
        confettiAt(root, record, { count: 60, spread: 260 });
      }
    });
  }
  const T_END = Math.max(T_RECORD + (s.newHighscore ? 450 : 100), T_MISSIONS + missions.length * 220 + 700);
  tl.add(T_END, (instant) => showButtons(instant));
  tl.play();

  const skip = () => {
    if (tl.finished) return;
    box.classList.add('instant');
    tl.skip();
  };
  root.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    skip();
  });
  function onKey(e: KeyboardEvent): void {
    if (e.code !== 'Space' && e.code !== 'Enter') return;
    e.preventDefault();
    if (!tl.finished) skip();
    else (buttons.querySelector('button:not(:disabled)') as HTMLButtonElement | null)?.click();
  }
  window.addEventListener('keydown', onKey);
}
