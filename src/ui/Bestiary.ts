/**
 * Bestiarium: alle Monsterarten aus dem Register mit Bild, Stufen-Fortschritt, Zählern,
 * Vorkommen und – nach dem ersten Sieg – ihren Schwächen. Unbekannte Monster bleiben „???“.
 */
import type { SaveData } from '../core/SaveGame';
import type { ContentRegistries } from '../data';
import type { MonsterDef } from '../data/types';
import { bestiaryProgress, monsterZones } from '../player/Progression';
import { formatNumber, h } from './dom';

export interface BestiaryCallbacks {
  /** Liefert ein Bild (Data-URL) des Monsters; silhouette für unbekannte */
  thumbnail(def: MonsterDef, silhouette: boolean): string;
  close(): void;
}

export class BestiaryScreen {
  private readonly overlay: HTMLDivElement;

  constructor(
    parent: HTMLElement,
    private readonly content: ContentRegistries,
    private readonly save: SaveData,
    private readonly cb: BestiaryCallbacks,
  ) {
    const close = h('button', { class: 'btn small', text: 'Zurück' });
    close.addEventListener('click', () => this.close());
    // Kapitel 1: Siegel des Vulkans (Weg zum Wächter); danach Fortschritt im Feuermeer
    const fire = save.progress.chapter >= 2;
    const progress = bestiaryProgress(content, save, fire ? 2 : 1);
    const pct = progress.total ? (progress.done / progress.total) * 100 : 0;
    const panel = h('div', { class: 'panel bestiary-panel' }, [
      h('div', { class: 'side-header' }, [h('h2', { class: 'outlined', text: 'Bestiarium' }), close]),
      h('div', { class: 'seal' }, [
        h('div', { class: 'seal-label', text: `${fire ? 'Kreaturen des Feuermeers' : 'Siegel des Vulkans'}: ${progress.done} / ${progress.total} Stufen` }),
        h('div', { class: 'seal-bar' }, [h('div', { class: 'seal-fill', attrs: { style: `width:${pct.toFixed(1)}%` } })]),
        h('div', {
          class: 'seal-hint',
          text: fire
            ? save.progress.titanDefeated
              ? 'Peles Wächter ist besiegt – Kapitel 2 geschafft!'
              : save.progress.volcanoOpen
                ? 'Der Lava-Titan wartet im Kratersee – Knopf „Krater“ im Menü.'
                : progress.done >= progress.total
                  ? 'Alle Kreaturen besiegt – Keoni erwartet dich am Surfshop!'
                  : 'Der Vulkan ist erwacht. Besiege Seeschlange, Wal und Muschel auf jeder Stufe!'
            : save.progress.bossDefeated
              ? 'Der Wächter der Insel ist besiegt – das Riff ist offen! Lauf zum Surfshop auf der Insel.'
              : progress.done >= progress.total
                ? 'Alle Siegel gebrochen – der Wächter der Insel erwartet dich vor dem Riff!'
                : 'Besiege jede Monsterart auf höchster Stufe, um den Wächter der Insel herauszufordern.',
        }),
      ]),
      h('div', { class: 'bestiary-grid' }, content.monsters.all().map((m) => this.card(m))),
    ]);
    this.overlay = h('div', { class: 'overlay' }, [panel]);
    parent.appendChild(this.overlay);
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
