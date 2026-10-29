/**
 * Shop für Boards und Outfits (Skins). Die Auswahl wird sofort am Surfer in der 3D-Szene
 * gezeigt; gekauft wird mit Perlen. Alle Inhalte kommen aus den Registern.
 */
import type { SaveData } from '../core/SaveGame';
import type { ContentRegistries } from '../data';
import type { BoardDef, SkinDef } from '../data/types';
import { itemStatus, type ShopKind } from '../player/Progression';
import { formatNumber, h } from './dom';
import { describeModifier } from './labels';

export interface ShopCallbacks {
  /** Vorschau eines Skins/Boards am Surfer */
  preview(skinId: string, boardId: string): void;
  buy(kind: ShopKind, id: string): boolean;
  equip(kind: ShopKind, id: string): boolean;
  close(): void;
}

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
  private readonly tabs: Record<ShopKind, HTMLButtonElement>;
  private kind: ShopKind = 'board';
  private selected: Record<ShopKind, string>;

  constructor(
    parent: HTMLElement,
    private readonly content: ContentRegistries,
    private readonly save: SaveData,
    private readonly cb: ShopCallbacks,
  ) {
    this.selected = { board: save.equipped.board, skin: save.equipped.skin };
    this.pearlsEl = h('span', { text: '0' });
    const close = h('button', { class: 'btn small', text: 'Zurück' });
    close.addEventListener('click', () => this.close());
    this.tabs = {
      board: h('button', { class: 'tab', text: 'Boards' }),
      skin: h('button', { class: 'tab', text: 'Outfits' }),
    };
    this.tabs.board.addEventListener('click', () => this.setKind('board'));
    this.tabs.skin.addEventListener('click', () => this.setKind('skin'));
    this.grid = h('div', { class: 'shop-grid' });
    this.detail = h('div', { class: 'shop-detail' });
    this.el = h('div', { class: 'side-panel interactive' }, [
      h('div', { class: 'side-header' }, [
        h('h2', { class: 'outlined', text: 'Shop' }),
        h('span', { class: 'chip' }, [h('span', { class: 'pearl-icon' }), this.pearlsEl]),
        close,
      ]),
      h('div', { class: 'tabs' }, [this.tabs.board, this.tabs.skin]),
      this.grid,
      this.detail,
    ]);
    parent.appendChild(this.el);
    this.setKind('board');
  }

  private setKind(kind: ShopKind): void {
    this.kind = kind;
    this.tabs.board.classList.toggle('active', kind === 'board');
    this.tabs.skin.classList.toggle('active', kind === 'skin');
    this.render();
  }

  private items(): (BoardDef | SkinDef)[] {
    return this.kind === 'board' ? this.content.boards.all() : this.content.skins.all();
  }

  private render(): void {
    this.pearlsEl.textContent = formatNumber(this.save.pearls);
    this.grid.innerHTML = '';
    for (const def of this.items()) {
      const st = itemStatus(this.kind, def, this.save, this.content);
      const status = st.equipped
        ? h('span', { class: 'tag equipped', text: 'Ausgerüstet' })
        : st.owned
          ? h('span', { class: 'tag owned', text: 'Im Besitz' })
          : st.lockedReason
            ? h('span', { class: 'tag locked', text: 'Gesperrt' })
            : h('span', { class: `tag price ${st.canBuy ? '' : 'expensive'}` }, [h('span', { class: 'pearl-icon' }), formatNumber(st.price)]);
      const card = h('button', { class: `item-card ${this.selected[this.kind] === def.id ? 'selected' : ''} ${st.lockedReason ? 'is-locked' : ''}` }, [
        this.kind === 'board' ? boardSwatch(def as BoardDef) : skinSwatch(def as SkinDef),
        h('span', { class: 'item-name', text: def.name }),
        status,
      ]);
      card.addEventListener('click', () => this.select(def.id));
      this.grid.appendChild(card);
    }
    this.renderDetail();
  }

  private select(id: string): void {
    this.selected[this.kind] = id;
    this.cb.preview(this.selected.skin, this.selected.board);
    this.render();
  }

  private renderDetail(): void {
    const id = this.selected[this.kind];
    const def = this.items().find((d) => d.id === id);
    this.detail.innerHTML = '';
    if (!def) return;
    const st = itemStatus(this.kind, def, this.save, this.content);
    const parts: HTMLElement[] = [h('div', { class: 'detail-name', text: def.name })];
    if (this.kind === 'board') {
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
        if (this.cb.equip(this.kind, def.id)) this.render();
      });
    } else if (st.lockedReason) {
      action.textContent = `🔒 ${st.lockedReason}`;
      action.disabled = true;
    } else {
      action.append(`Kaufen · `, h('span', { class: 'pearl-icon' }), ` ${formatNumber(st.price)}`);
      action.classList.add('primary');
      action.disabled = !st.canBuy;
      action.addEventListener('click', () => {
        if (this.cb.buy(this.kind, def.id)) {
          this.cb.equip(this.kind, def.id);
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

function boardSwatch(b: BoardDef): HTMLElement {
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
