/**
 * Skillbaum: Knoten aus data/skills.ts, angeordnet nach `position`, Linien für `requires`.
 * Freischalten kostet Erfahrung und/oder Perlen. Aktive Fähigkeiten lassen sich hier ausrüsten.
 */
import type { SaveData } from '../core/SaveGame';
import type { ContentRegistries } from '../data';
import type { SkillNodeDef } from '../data/types';
import { ABILITY_SLOTS, equippedAbilities, skillState, unlockedActiveAbilities } from '../player/Progression';
import { formatNumber, h } from './dom';
import { describeModifier } from './labels';

export interface SkillTreeCallbacks {
  unlock(skillId: string): boolean;
  toggleAbility(abilityId: string): boolean;
  close(): void;
}

const BRANCHES = ['Surfen', 'Tricks', 'Überleben'];

export class SkillTreeScreen {
  private readonly overlay: HTMLDivElement;
  private readonly tree: HTMLDivElement;
  private readonly detail: HTMLDivElement;
  private readonly slots: HTMLDivElement;
  private readonly xpEl: HTMLSpanElement;
  private readonly pearlsEl: HTMLSpanElement;
  private selected: string;

  constructor(
    parent: HTMLElement,
    private readonly content: ContentRegistries,
    private readonly save: SaveData,
    private readonly cb: SkillTreeCallbacks,
  ) {
    const nodes = content.skills.all();
    this.selected = nodes.find((n) => skillState(content, save, n.id) === 'available')?.id ?? nodes[0]?.id ?? '';
    this.xpEl = h('span', { text: '0' });
    this.pearlsEl = h('span', { text: '0' });
    const close = h('button', { class: 'btn small', text: 'Zurück' });
    close.addEventListener('click', () => this.close());
    this.tree = h('div', { class: 'skill-tree' });
    this.detail = h('div', { class: 'skill-detail' });
    this.slots = h('div', { class: 'ability-slots' });
    const rows = Math.max(...nodes.map((n) => n.position.row)) + 1;
    this.tree.style.setProperty('--rows', String(rows));
    const panel = h('div', { class: 'panel tree-panel' }, [
      h('div', { class: 'side-header' }, [
        h('h2', { class: 'outlined', text: 'Skillbaum' }),
        h('span', { class: 'chip' }, ['XP ', this.xpEl]),
        h('span', { class: 'chip' }, [h('span', { class: 'pearl-icon' }), this.pearlsEl]),
        close,
      ]),
      h('div', { class: 'tree-body' }, [
        h('div', { class: 'tree-scroll' }, [h('div', { class: 'branch-labels' }, BRANCHES.map((b) => h('span', { class: 'outlined', text: b }))), this.tree]),
        h('div', { class: 'tree-side' }, [this.detail, this.slots]),
      ]),
    ]);
    this.overlay = h('div', { class: 'overlay' }, [panel]);
    parent.appendChild(this.overlay);
    this.render();
  }

  private icon(n: SkillNodeDef): string {
    if (n.icon) return n.icon;
    const ability = n.grantsAbility ? this.content.abilities.tryGet(n.grantsAbility) : undefined;
    return ability?.icon ?? n.name.charAt(0);
  }

  private render(): void {
    this.xpEl.textContent = formatNumber(this.save.xp);
    this.pearlsEl.textContent = formatNumber(this.save.pearls);
    const nodes = this.content.skills.all();
    const rows = Math.max(...nodes.map((n) => n.position.row)) + 1;

    // Verbindungslinien (SVG in Spalten-/Zeilen-Einheiten, gestreckt auf die Baumfläche)
    const lines = nodes
      .flatMap((n) =>
        n.requires.map((r) => {
          const p = this.content.skills.get(r);
          const owned = this.save.unlocked.skills.includes(r) && this.save.unlocked.skills.includes(n.id);
          const ready = this.save.unlocked.skills.includes(r);
          return `<line x1="${(p.position.col + 0.5) * 100}" y1="${(p.position.row + 0.5) * 100}" x2="${(n.position.col + 0.5) * 100}" y2="${(n.position.row + 0.5) * 100}" class="${owned ? 'owned' : ready ? 'ready' : ''}"/>`;
        }),
      )
      .join('');
    this.tree.innerHTML = `<svg class="tree-lines" viewBox="0 0 300 ${rows * 100}" preserveAspectRatio="none">${lines}</svg>`;

    for (const n of nodes) {
      const state = skillState(this.content, this.save, n.id);
      const btn = h('button', { class: `skill-node ${state} ${this.selected === n.id ? 'selected' : ''}`, attrs: { 'aria-label': n.name } }, [
        h('span', { class: 'skill-icon', text: this.icon(n) }),
        h('span', { class: 'skill-name', text: n.name }),
      ]);
      btn.style.setProperty('--x', String((n.position.col + 0.5) / 3));
      btn.style.setProperty('--row', String(n.position.row));
      btn.addEventListener('click', () => {
        this.selected = n.id;
        this.render();
      });
      this.tree.appendChild(btn);
    }
    this.renderDetail();
    this.renderSlots();
  }

  private renderDetail(): void {
    this.detail.innerHTML = '';
    const n = this.content.skills.tryGet(this.selected);
    if (!n) return;
    const state = skillState(this.content, this.save, n.id);
    const ability = n.grantsAbility ? this.content.abilities.tryGet(n.grantsAbility) : undefined;
    const parts: HTMLElement[] = [h('div', { class: 'detail-name', text: `${this.icon(n)}  ${n.name}` }), h('div', { class: 'detail-desc', text: n.description })];
    const effects = [...(n.modifiers ?? []), ...(ability?.kind === 'passive' ? (ability.modifiers ?? []) : [])].map(describeModifier);
    if (ability?.kind === 'active') effects.push(`Abklingzeit ${ability.cooldown} s`);
    if (effects.length) parts.push(h('div', { class: 'detail-mods', text: effects.join(' · ') }));

    if (n.requires.length) {
      parts.push(
        h(
          'div',
          { class: 'requires' },
          n.requires.map((r) => {
            const ok = this.save.unlocked.skills.includes(r);
            return h('span', { class: `req ${ok ? 'ok' : ''}`, text: `${ok ? '✓' : '✗'} ${this.content.skills.get(r).name}` });
          }),
        ),
      );
    }

    if (state === 'owned') {
      parts.push(h('div', { class: 'tag equipped owned-tag', text: 'Freigeschaltet' }));
      if (ability?.kind === 'active') {
        const equipped = this.save.equipped.abilities.includes(ability.id);
        const b = h('button', { class: `btn small ${equipped ? '' : 'green'}`, text: equipped ? 'Ablegen' : 'Ausrüsten' });
        b.addEventListener('click', () => {
          if (this.cb.toggleAbility(ability.id)) this.render();
        });
        parts.push(b);
      }
    } else {
      const cost = h('div', { class: 'cost' });
      if (n.cost.xp) cost.append(h('span', { class: `chip ${this.save.xp >= n.cost.xp ? '' : 'short'}` }, [`XP ${formatNumber(n.cost.xp)}`]));
      if (n.cost.pearls) {
        cost.append(h('span', { class: `chip ${this.save.pearls >= n.cost.pearls ? '' : 'short'}` }, [h('span', { class: 'pearl-icon' }), formatNumber(n.cost.pearls)]));
      }
      parts.push(cost);
      const b = h('button', { class: 'btn primary small', text: 'Freischalten' });
      b.disabled = state !== 'available';
      if (state === 'locked') b.textContent = 'Erst Voraussetzungen';
      if (state === 'unaffordable') b.textContent = 'Zu teuer';
      b.addEventListener('click', () => {
        if (this.cb.unlock(n.id)) this.render();
      });
      parts.push(b);
    }
    this.detail.append(...parts);
  }

  private renderSlots(): void {
    this.slots.innerHTML = '';
    const unlocked = unlockedActiveAbilities(this.content, this.save);
    const equipped = equippedAbilities(this.content, this.save);
    const boxes: HTMLElement[] = [];
    for (let i = 0; i < ABILITY_SLOTS; i++) {
      const a = equipped[i];
      boxes.push(h('span', { class: `slot ${a ? 'filled' : ''}`, attrs: { title: a?.name ?? 'leer' } }, [a ? a.icon : '–']));
    }
    this.slots.append(
      h('span', { class: 'slots-label', text: unlocked.length ? 'Fähigkeiten im Run:' : 'Aktive Fähigkeiten: noch keine freigeschaltet' }),
      ...(unlocked.length ? boxes : []),
    );
  }

  close(): void {
    this.overlay.remove();
    this.cb.close();
  }
}
