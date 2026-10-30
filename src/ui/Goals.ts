/**
 * Fenster „Aufgaben“: Tagesaufgaben (heute) und Erfolge mit Stufen. Abholen gibt Perlen und
 * Erfahrung; sind alle drei Tagesaufgaben abgeholt, wartet eine Bonus-Truhe.
 */
import type { SaveData } from '../core/SaveGame';
import type { ContentRegistries } from '../data';
import type { AchievementDef } from '../data/types';
import {
  achievementReward,
  achievementState,
  bonusAvailable,
  missionDone,
  missionReward,
  missionText,
} from '../player/Goals';
import { formatNumber, h } from './dom';

export interface GoalsCallbacks {
  claimMission(index: number): boolean;
  claimAchievement(id: string): boolean;
  /** Bonus-Truhe öffnen (Fenster schließt sich, danach geht es wieder auf) */
  claimBonus(): void;
  close(): void;
}

type Tab = 'today' | 'achievements';
const DIFFICULTY = ['Leicht', 'Mittel', 'Schwer'];
const MEDALS = ['bronze', 'silver', 'gold'];

export class GoalsScreen {
  private readonly overlay: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private readonly tabs: Record<Tab, HTMLButtonElement>;
  private tab: Tab;

  constructor(
    parent: HTMLElement,
    private readonly content: ContentRegistries,
    private readonly save: SaveData,
    private readonly cb: GoalsCallbacks,
    initial: Tab = 'today',
  ) {
    this.tab = initial;
    const close = h('button', { class: 'btn small', text: 'Zurück' });
    close.addEventListener('click', () => this.close());
    this.tabs = {
      today: h('button', { class: 'tab', text: 'Heute' }),
      achievements: h('button', { class: 'tab', text: 'Erfolge' }),
    };
    this.tabs.today.addEventListener('click', () => this.setTab('today'));
    this.tabs.achievements.addEventListener('click', () => this.setTab('achievements'));
    this.body = h('div', { class: 'goals-body' });
    const panel = h('div', { class: 'panel goals-panel' }, [
      h('div', { class: 'side-header' }, [h('h2', { class: 'outlined', text: 'Aufgaben' }), h('div', { class: 'tabs' }, [this.tabs.today, this.tabs.achievements]), close]),
      this.body,
    ]);
    this.overlay = h('div', { class: 'overlay' }, [panel]);
    parent.appendChild(this.overlay);
    this.setTab(initial);
  }

  private setTab(t: Tab): void {
    this.tab = t;
    for (const k of Object.keys(this.tabs) as Tab[]) this.tabs[k].classList.toggle('active', k === t);
    this.render();
  }

  private render(): void {
    this.body.innerHTML = '';
    if (this.tab === 'today') this.renderToday();
    else this.renderAchievements();
  }

  private reward(r: { pearls: number; xp: number }): HTMLElement {
    return h('div', { class: 'goal-reward' }, [h('span', { class: 'pearl-icon' }), ` ${formatNumber(r.pearls)}  ·  XP ${formatNumber(r.xp)}`]);
  }

  private bar(value: number, goal: number): HTMLElement {
    const pct = Math.max(0, Math.min(1, goal > 0 ? value / goal : 1)) * 100;
    return h('div', { class: 'goal-bar' }, [h('div', { class: 'goal-fill', attrs: { style: `width:${pct.toFixed(1)}%` } })]);
  }

  private renderToday(): void {
    const S = this.save.missions;
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const mins = Math.max(0, Math.round((midnight.getTime() - now.getTime()) / 60000));
    this.body.appendChild(h('div', { class: 'goal-sub', text: `Neue Aufgaben in ${Math.floor(mins / 60)} h ${mins % 60} min` }));
    const list = h('div', { class: 'goal-list' });
    S.list.forEach((e, i) => {
      const done = missionDone(e);
      const btn = h('button', { class: `btn small ${e.claimed ? '' : done ? 'green' : 'disabled'}`, text: e.claimed ? '✓ Abgeholt' : done ? 'Abholen' : 'Läuft …' });
      btn.disabled = e.claimed || !done;
      btn.addEventListener('click', () => {
        if (this.cb.claimMission(i)) this.render();
      });
      const shown = Math.min(e.progress, e.goal);
      list.appendChild(
        h('div', { class: `goal-card ${done ? 'done' : ''} ${e.claimed ? 'claimed' : ''}` }, [
          h('div', { class: `goal-diff d${e.difficulty}`, text: DIFFICULTY[e.difficulty] ?? '' }),
          h('div', { class: 'goal-text', text: missionText(this.content, e) }),
          this.bar(e.progress, e.goal),
          h('div', { class: 'goal-count', text: `${formatNumber(Math.floor(shown * 10) / 10)} / ${formatNumber(e.goal)}` }),
          this.reward(missionReward(e)),
          btn,
        ]),
      );
    });
    this.body.appendChild(list);
    const bonus = bonusAvailable(this.save);
    const allDone = S.list.length > 0 && S.list.every((e) => e.claimed);
    const bonusBtn = h('button', { class: `btn small ${bonus ? 'primary' : 'disabled'}`, text: S.bonusClaimed ? '✓ Geöffnet' : 'Truhe öffnen' });
    bonusBtn.disabled = !bonus;
    bonusBtn.addEventListener('click', () => {
      if (!bonusAvailable(this.save)) return;
      this.overlay.remove();
      this.cb.claimBonus();
    });
    this.body.appendChild(
      h('div', { class: `goal-bonus ${bonus ? 'ready' : ''}` }, [
        h('div', { class: 'goal-chest' }),
        h('div', { class: 'goal-text', text: S.bonusClaimed ? 'Bonus-Truhe für heute geöffnet. Morgen gibt es neue Aufgaben!' : allDone ? 'Alle Aufgaben geschafft – die Bonus-Truhe wartet!' : 'Schaffe alle drei Aufgaben für eine Bonus-Truhe.' }),
        bonusBtn,
      ]),
    );
  }

  private renderAchievements(): void {
    const grid = h('div', { class: 'achievement-grid' });
    for (const a of this.content.achievements.all()) grid.appendChild(this.achievementCard(a));
    this.body.appendChild(grid);
  }

  private achievementCard(a: AchievementDef): HTMLElement {
    const st = achievementState(this.save, a);
    const single = a.tiers.length === 1;
    const medals = h(
      'div',
      { class: 'medals' },
      a.tiers.map((_, i) => {
        const kind = single ? 'gold' : MEDALS[i]!;
        return h('span', { class: `medal ${kind} ${i < st.reached ? 'on' : ''} ${i < st.claimed ? 'claimed' : ''}` });
      }),
    );
    const claimable = st.reached > st.claimed;
    const goal = st.next ?? a.tiers[a.tiers.length - 1]!;
    const desc = a.description.replace('{n}', formatNumber(goal));
    const parts: HTMLElement[] = [h('div', { class: 'achievement-name', text: a.name }), medals, h('div', { class: 'achievement-desc', text: desc })];
    if (!single || st.reached === 0) {
      parts.push(this.bar(st.value, goal));
      parts.push(h('div', { class: 'goal-count', text: st.next === null ? 'Alle Stufen erreicht!' : `${formatNumber(Math.floor(st.value * 10) / 10)} / ${formatNumber(goal)}` }));
    }
    if (claimable) {
      const btn = h('button', { class: 'btn small green', text: 'Abholen' });
      btn.addEventListener('click', () => {
        if (this.cb.claimAchievement(a.id)) this.render();
      });
      parts.push(this.reward(achievementReward(a, st.claimed)), btn);
    }
    return h('div', { class: `achievement-card ${claimable ? 'ready' : ''} ${st.reached > 0 ? 'got' : ''}` }, parts);
  }

  close(): void {
    this.overlay.remove();
    this.cb.close();
  }
}
