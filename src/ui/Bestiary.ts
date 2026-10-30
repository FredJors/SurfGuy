/**
 * Bestiarium: alle Monsterarten aus dem Register mit Bild, Stufen-Fortschritt, Zählern,
 * Vorkommen und – nach dem ersten Sieg – ihren Schwächen. Unbekannte Monster bleiben „???“.
 */
import type { SaveData } from '../core/SaveGame';
import type { ContentRegistries } from '../data';
import type { MonsterDef } from '../data/types';
import { bestiaryProgress, monsterZones } from '../player/Progression';
import { formatNumber, h } from './dom';
import { backButton } from './widgets';

export interface BestiaryCallbacks {
  /** Liefert ein Bild (Data-URL) des Monsters; silhouette für unbekannte */
  thumbnail(def: MonsterDef, silhouette: boolean): string;
  close(): void;
}

export class BestiaryScreen {
  private readonly overlay: HTMLDivElement;

  private readonly seal: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private readonly tabs = new Map<number, HTMLButtonElement>();

  constructor(
    parent: HTMLElement,
    private readonly content: ContentRegistries,
    private readonly save: SaveData,
    private readonly cb: BestiaryCallbacks,
  ) {
    const close = backButton(() => this.close());
    this.seal = h('div', { class: 'seal' });
    this.grid = h('div', { class: 'bestiary-grid' });
    // Reiter je erreichtem Kapitel (ab Kapitel 2)
    const tabRow = h('div', { class: 'tabs' });
    for (let c = 1; c <= save.progress.chapter && save.progress.chapter > 1; c++) {
      const t = h('button', { class: 'tab', text: `Kapitel ${c}` });
      t.addEventListener('click', () => this.show(c));
      this.tabs.set(c, t);
      tabRow.appendChild(t);
    }
    const panel = h('div', { class: 'panel bestiary-panel' }, [
      h('div', { class: 'side-header' }, [h('h2', { class: 'outlined', text: 'Bestiarium' }), tabRow, close]),
      this.seal,
      this.grid,
    ]);
    this.overlay = h('div', { class: 'overlay' }, [panel]);
    parent.appendChild(this.overlay);
    this.show(save.progress.activeChapter);
  }

  /** Kapitel zeigen: Fortschritt (Kapitel 1: Siegel des Vulkans = Weg zum Wächter) und seine Monster. */
  private show(chapter: number): void {
    for (const [c, t] of this.tabs) t.classList.toggle('active', c === chapter);
    const progress = bestiaryProgress(this.content, this.save, chapter);
    const pct = progress.total ? (progress.done / progress.total) * 100 : 0;
    const label = ['Siegel des Vulkans', 'Kreaturen des Feuermeers', 'Kreaturen des Eismeers'][chapter - 1] ?? `Kapitel ${chapter}`;
    this.seal.innerHTML = '';
    this.seal.append(
      h('div', { class: 'seal-label', text: `${label}: ${progress.done} / ${progress.total} Stufen` }),
      h('div', { class: 'seal-bar' }, [h('div', { class: 'seal-fill', attrs: { style: `width:${pct.toFixed(1)}%` } })]),
      h('div', { class: 'seal-hint', text: sealHint(this.save, chapter, progress.done >= progress.total) }),
    );
    this.grid.innerHTML = '';
    // Monster dieses Kapitels; ohne Reiter (nur Kapitel 1 erreicht) auch die späteren als Andeutung
    const list = this.content.monsters.all().filter((m) => (m.chapter ?? 1) === chapter || (this.tabs.size === 0 && (m.chapter ?? 1) > chapter));
    for (const m of list) this.grid.appendChild(this.card(m));
    this.grid.scrollTop = 0;
  }

  private card(m: MonsterDef): HTMLElement {
    const e = this.save.bestiary[m.id];
    const seen = !!e && e.seen > 0;
    const defeated = !!e && e.defeated > 0;
    const img = h('img', { class: 'monster-img', attrs: { alt: seen ? m.name : 'Unbekannt', src: this.cb.thumbnail(m, !seen) } });
    const stars = h(
      'div',
      { class: 'tiers' },
      m.tiers.map((t) => {
        const done = (e?.highestTierDefeated ?? 0) >= t.tier;
        return h('span', { class: `tier ${done ? 'done' : ''}`, attrs: { title: seen ? t.name : '???' } }, [done ? '★' : '☆']);
      }),
    );
    const parts: HTMLElement[] = [img, h('div', { class: 'monster-name', text: seen ? m.name : '???' }), stars];
    if (!seen) {
      const later = (m.chapter ?? 1) > this.save.progress.chapter;
      parts.push(h('div', { class: 'monster-info', text: later ? 'Noch nie gesehen. Es heißt, es schläft tief unter dem Vulkan …' : 'Noch nie gesehen. Wo es wohl lauert?' }));
    } else {
      parts.push(h('div', { class: 'monster-info', text: m.description }));
      parts.push(h('div', { class: 'monster-counts', text: `Gesehen ${e!.seen}× · Besiegt ${e!.defeated}×` }));
      parts.push(h('div', { class: 'monster-meta', text: `Vorkommen: ${monsterZones(this.content, m.id).join(', ')}` }));
      const tierNames = m.tiers.map((t) => `${(e?.highestTierDefeated ?? 0) >= t.tier ? '✓' : '·'} ${t.name}`).join('  ');
      parts.push(h('div', { class: 'monster-meta', text: tierNames }));
      if (!m.boss) {
        const best = e?.highestTierDefeated ?? 0;
        const next = m.tiers.find((t) => t.tier === Math.min(m.tiers.length, best + 1))!;
        parts.push(h('div', { class: 'monster-next', text: best >= m.tiers.length ? 'Alle Stufen besiegt ✓' : `Nächste Begegnung: Stufe ${next.tier} – ${next.name}` }));
      }
      if (defeated) {
        const fmt = (w: { trick: string; tag?: string; multiplier: number }) => {
          const trick = this.content.tricks.tryGet(w.trick)?.name ?? w.trick;
          return `${trick} ×${String(w.multiplier).replace('.', ',')}`;
        };
        const weak = m.weaknesses.filter((w) => w.multiplier > 1).map(fmt);
        const strong = m.weaknesses.filter((w) => w.multiplier < 1).map(fmt);
        parts.push(h('div', { class: 'monster-weak', text: weak.length ? `Anfällig für: ${weak.join(', ')}` : 'Keine besonderen Schwächen' }));
        if (strong.length) parts.push(h('div', { class: 'monster-weak resist', text: `Robust gegen: ${strong.join(', ')}` }));
        parts.push(
          h('div', { class: 'monster-meta' }, [
            'Belohnung: ',
            h('span', { class: 'pearl-icon' }),
            ` ${formatNumber(m.rewards.pearls)} · XP ${formatNumber(m.rewards.xp)} (je Stufe mehr)`,
          ]),
        );
      } else {
        parts.push(h('div', { class: 'monster-weak hidden-weak', text: 'Schwächen: besiege es, um sie zu erfahren.' }));
      }
    }
    return h('div', { class: `monster-card ${seen ? '' : 'unknown'}` }, parts);
  }

  close(): void {
    this.overlay.remove();
    this.cb.close();
  }
}

/** Hinweis unter dem Fortschrittsbalken: was als Nächstes zu tun ist. */
function sealHint(save: SaveData, chapter: number, allDone: boolean): string {
  const P = save.progress;
  if (chapter >= 3) {
    if (P.colossusDefeated) return 'Der Frostkoloss ist besiegt – Kapitel 3 geschafft!';
    if (P.glacierOpen) return 'Der Frostkoloss wartet in der Gletscherlagune – Knopf „Gletscher“ im Menü.';
    if (allDone) return 'Alle Kreaturen besiegt – Keoni erwartet dich am Surfshop!';
    return 'Das Meer ist gefroren. Besiege Eisbär, Seeleopard und Narwal auf jeder Stufe!';
  }
  if (chapter === 2) {
    if (P.titanDefeated) return 'Peles Wächter ist besiegt – Kapitel 2 geschafft!';
    if (P.volcanoOpen) return 'Der Lava-Titan wartet im Kratersee – Knopf „Krater“ im Menü.';
    if (allDone) return 'Alle Kreaturen besiegt – Keoni erwartet dich am Surfshop!';
    return 'Der Vulkan ist erwacht. Besiege Seeschlange, Wal und Muschel auf jeder Stufe!';
  }
  if (P.bossDefeated) return 'Der Wächter der Insel ist besiegt – das Riff ist offen! Lauf zum Surfshop auf der Insel.';
  if (allDone) return 'Alle Siegel gebrochen – der Wächter der Insel erwartet dich vor dem Riff!';
  return 'Besiege jede Monsterart auf höchster Stufe, um den Wächter der Insel herauszufordern.';
}
