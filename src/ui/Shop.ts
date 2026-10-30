/**
 * Shop für Boards, Outfits (Skins) und Board-Designs. Die Auswahl wird sofort am Surfer in der
 * 3D-Szene gezeigt; gekauft wird mit Perlen, Designs gibt es nur aus Truhen.
 * Alle Inhalte kommen aus den Registern.
 */
import type { SaveData } from '../core/SaveGame';
import type { ContentRegistries } from '../data';
import type { BoardDef, BoardDesignDef, Rarity, SkinDef } from '../data/types';
import { itemStatus, type ShopKind } from '../player/Progression';
import { formatNumber, h } from './dom';
import { backButton } from './widgets';
import { describeModifier } from './labels';

export interface ShopCallbacks {
  /** Vorschau eines Skins/Boards/Designs am Surfer */
  preview(skinId: string, boardId: string, designId: string): void;
  buy(kind: ShopKind, id: string): boolean;
  equip(kind: ShopKind, id: string): boolean;
  equipDesign(id: string): boolean;
  close(): void;
}

type Tab = ShopKind | 'design';

export const RARITY_LABEL: Record<Rarity, string> = { common: 'Gewöhnlich', rare: 'Selten', epic: 'Episch', legendary: 'Legendär' };

/** Pseudo-Eintrag „Originalfarben“ im Design-Tab */
const ORIGINAL: BoardDesignDef = { id: '', name: 'Original', rarity: 'common', colors: { base: '', stripe: '', rail: '' } };

const BOARD_STATS: [keyof BoardDef['stats'], string][] = [
  ['speed', 'Tempo'],
  ['agility', 'Wendigkeit'],
  ['airtime', 'Airtime'],
  ['stability', 'Stabilität'],
];

export class ShopScreen {
  private readonly el: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private readonly detail: HTMLDivElement;
  private readonly pearlsEl: HTMLSpanElement;
  private readonly tabs: Record<Tab, HTMLButtonElement>;
  private kind: Tab = 'board';
  private selected: Record<Tab, string>;

  constructor(
    parent: HTMLElement,
    private readonly content: ContentRegistries,
    private readonly save: SaveData,
    private readonly cb: ShopCallbacks,
  ) {
    this.selected = { board: save.equipped.board, skin: save.equipped.skin, design: save.equipped.boardDesign };
    this.pearlsEl = h('span', { text: '0' });
    const close = backButton(() => this.close());
    this.tabs = {
      board: h('button', { class: 'tab', text: 'Boards' }),
      skin: h('button', { class: 'tab', text: 'Outfits' }),
      design: h('button', { class: 'tab', text: 'Designs' }),
    };
    this.tabs.board.addEventListener('click', () => this.setKind('board'));
    this.tabs.skin.addEventListener('click', () => this.setKind('skin'));
    this.tabs.design.addEventListener('click', () => this.setKind('design'));
    this.grid = h('div', { class: 'shop-grid' });
    this.detail = h('div', { class: 'shop-detail' });
    this.el = h('div', { class: 'side-panel interactive' }, [
      h('div', { class: 'side-header' }, [
        h('h2', { class: 'outlined', text: 'Shop' }),
        h('span', { class: 'chip' }, [h('span', { class: 'pearl-icon' }), this.pearlsEl]),
        close,
      ]),
      h('div', { class: 'tabs' }, [this.tabs.board, this.tabs.skin, this.tabs.design]),
      this.grid,
      this.detail,
    ]);
    parent.appendChild(this.el);
    this.setKind('board');
  }

  private setKind(kind: Tab): void {
    this.kind = kind;
    for (const k of Object.keys(this.tabs) as Tab[]) this.tabs[k].classList.toggle('active', kind === k);
    this.render();
  }

  private items(): (BoardDef | SkinDef)[] {
    return this.kind === 'board' ? this.content.boards.all() : this.content.skins.all();
  }

  private render(): void {
    this.pearlsEl.textContent = formatNumber(this.save.pearls);
    this.grid.innerHTML = '';
    if (this.kind === 'design') {
      this.renderDesigns();
      return;
    }
    const kind = this.kind;
    for (const def of this.items()) {
      const st = itemStatus(kind, def, this.save, this.content);
      const status = st.equipped
        ? h('span', { class: 'tag equipped', text: 'Ausgerüstet' })
        : st.owned
          ? h('span', { class: 'tag owned', text: 'Im Besitz' })
          : st.lockedReason
            ? h('span', { class: 'tag locked', text: 'Gesperrt' })
            : h('span', { class: `tag price ${st.canBuy ? '' : 'expensive'}` }, [h('span', { class: 'pearl-icon' }), formatNumber(st.price)]);
      const card = h('button', { class: `item-card ${this.selected[this.kind] === def.id ? 'selected' : ''} ${st.lockedReason ? 'is-locked' : ''}` }, [
        kind === 'board' ? boardSwatch(def as BoardDef) : skinSwatch(def as SkinDef),
        h('span', { class: 'item-name', text: def.name }),
        status,
      ]);
      card.addEventListener('click', () => this.select(def.id));
      this.grid.appendChild(card);
    }
    this.renderDetail(kind);
  }

  /** Design-Tab: Originalfarben + alle Designs (gesperrte zeigen ihre Seltenheit). */
  private renderDesigns(): void {
    const board = this.content.boards.tryGet(this.selected.board) ?? this.content.boards.all()[0]!;
    for (const d of [ORIGINAL, ...this.content.boardDesigns.all()]) {
      const owned = d.id === '' || this.save.unlocked.boardDesigns.includes(d.id);
      const equipped = this.save.equipped.boardDesign === d.id;
      const colors = d.id === '' ? board.colors : d.colors;
      const status = equipped
        ? h('span', { class: 'tag equipped', text: 'Ausgerüstet' })
        : owned
          ? h('span', { class: 'tag owned', text: 'Im Besitz' })
          : h('span', { class: `tag rarity ${d.rarity}`, text: RARITY_LABEL[d.rarity] });
      const card = h('button', { class: `item-card ${this.selected.design === d.id ? 'selected' : ''} ${owned ? '' : 'is-locked'}` }, [
        boardSwatch({ colors }),
        h('span', { class: 'item-name', text: d.name }),
        status,
      ]);
      card.addEventListener('click', () => this.select(d.id));
      this.grid.appendChild(card);
    }
    const d = this.selected.design === '' ? ORIGINAL : this.content.boardDesigns.tryGet(this.selected.design);
    this.detail.innerHTML = '';
    if (!d) return;
    const owned = d.id === '' || this.save.unlocked.boardDesigns.includes(d.id);
    const parts: HTMLElement[] = [h('div', { class: 'detail-name', text: d.name })];
    parts.push(h('div', { class: 'detail-desc', text: d.id === '' ? 'Die Originalfarben deines Boards.' : `${RARITY_LABEL[d.rarity]} · nur aus Truhen. Passt auf jedes Board.` }));
    const action = h('button', { class: 'btn' });
    if (this.save.equipped.boardDesign === d.id) {
      action.textContent = 'Ausgerüstet';
      action.disabled = true;
    } else if (owned) {
      action.textContent = 'Ausrüsten';
      action.classList.add('green');
      action.addEventListener('click', () => {
        if (this.cb.equipDesign(d.id)) this.render();
      });
    } else {
      action.textContent = '🔒 Aus Truhen';
      action.disabled = true;
    }
    parts.push(action);
    this.detail.append(...parts);
  }

  private select(id: string): void {
    this.selected[this.kind] = id;
    this.cb.preview(this.selected.skin, this.selected.board, this.selected.design);
    this.render();
  }

  private renderDetail(kind: ShopKind): void {
    const id = this.selected[kind];
    const def = this.items().find((d) => d.id === id);
    this.detail.innerHTML = '';
    if (!def) return;
    const st = itemStatus(kind, def, this.save, this.content);
    const parts: HTMLElement[] = [h('div', { class: 'detail-name', text: def.name })];
    if (kind === 'board') {
      const b = def as BoardDef;
      parts.push(h('div', { class: 'detail-desc', text: b.description }));
      const bars = h('div', { class: 'stat-bars' });
      for (const [key, label] of BOARD_STATS) {
        const v = b.stats[key];
        const pct = Math.max(4, Math.min(100, ((v - 0.7) / 0.6) * 100));
        const diff = Math.round((v - 1) * 100);
        bars.append(
          h('span', { class: 'stat-label', text: label }),
          h('span', { class: 'stat-bar' }, [h('span', { class: `stat-fill ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`, attrs: { style: `width:${pct}%` } })]),
          h('span', { class: 'stat-value', text: diff === 0 ? '±0' : `${diff > 0 ? '+' : ''}${diff} %` }),
        );
      }
      parts.push(bars);
      if (b.modifiers?.length) parts.push(h('div', { class: 'detail-mods', text: b.modifiers.map(describeModifier).join(' · ') }));
    }
    const action = h('button', { class: 'btn' });
    if (st.equipped) {
      action.textContent = 'Ausgerüstet';
      action.disabled = true;
    } else if (st.owned) {
      action.textContent = 'Ausrüsten';
      action.classList.add('green');
      action.addEventListener('click', () => {
        if (this.cb.equip(kind, def.id)) this.render();
      });
    } else if (st.lockedReason) {
      action.textContent = `🔒 ${st.lockedReason}`;
      action.disabled = true;
    } else {
      action.append(`Kaufen · `, h('span', { class: 'pearl-icon' }), ` ${formatNumber(st.price)}`);
      action.classList.add('primary');
      action.disabled = !st.canBuy;
      action.addEventListener('click', () => {
        if (this.cb.buy(kind, def.id)) {
          this.cb.equip(kind, def.id);
          this.render();
        }
      });
    }
    if (!st.owned && !st.lockedReason && !st.canBuy) parts.push(h('div', { class: 'detail-hint', text: 'Noch nicht genug Perlen – sammle sie auf den Wellen!' }));
    parts.push(action);
    this.detail.append(...parts);
  }

  close(): void {
    this.el.remove();
    this.cb.close();
  }
}

function boardSwatch(b: Pick<BoardDef, 'colors'>): HTMLElement {
  return h('span', {
    class: 'swatch board-swatch',
    attrs: {
      style: `background: linear-gradient(90deg, ${b.colors.base} 0 40%, ${b.colors.stripe} 40% 60%, ${b.colors.base} 60% 100%); border-color: ${b.colors.rail}`,
    },
  });
}

function skinSwatch(s: SkinDef): HTMLElement {
  return h('span', { class: 'swatch skin-swatch' }, [
    h('span', { class: 'skin-head', attrs: { style: `background:${s.colors.skin}; box-shadow: inset 0 0.35em 0 ${s.colors.hair}` } }),
    h('span', { class: 'skin-body', attrs: { style: `background: linear-gradient(180deg, ${s.colors.shirt} 0 60%, ${s.colors.shorts} 60% 100%)` } }),
  ]);
}
