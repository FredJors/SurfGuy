/**
 * Tagesaufgaben und Erfolge (reine Logik, testbar; das Fenster ist ui/Goals.ts).
 *
 * - Jeden Tag drei Aufgaben (leicht, mittel, schwer); das Datum ist der Zufalls-Startwert, also
 *   haben alle am selben Tag dieselben Aufgaben. Passt eine Aufgabe nicht mehr zum Kapitel (z. B.
 *   Kraken im Feuermeer), wird sie ersetzt.
 * - Fortschritt kommt aus Spiel-Ereignissen (GoalTracker). 'sum' zählt über den Tag, 'best' ist der
 *   beste Wert in einem einzelnen Run.
 * - Erfolge hängen an lebenslangen Werten (Statistiken, Story) und haben Stufen.
 */
import { CONFIG } from '../config/gameConfig';
import type { GameEventBus } from '../core/events';
import { Rng } from '../core/Rng';
import type { SaveData } from '../core/SaveGame';
import type { ContentRegistries } from '../data';
import type { AchievementDef, AchievementStat, GoalCounter, MissionDef } from '../data/types';

export type MissionEntry = SaveData['missions']['list'][number];

/** Datum als Schlüssel (Ortszeit), z. B. „2026-10-30“. */
export function dayKey(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function fitsChapter(def: MissionDef, chapter: number): boolean {
  if (def.chapter === undefined) return true;
  return typeof def.chapter === 'number' ? def.chapter === chapter : def.chapter.includes(chapter);
}

function pickMission(content: ContentRegistries, rng: Rng, difficulty: number, chapter: number, exclude: readonly string[]): MissionEntry | null {
  const pool = content.missions.all().filter((m) => m.goals[difficulty]! > 0 && fitsChapter(m, chapter) && !exclude.includes(m.id));
  const def = rng.pick(pool);
  if (!def) return null;
  return { id: def.id, difficulty, goal: def.goals[difficulty]!, progress: 0, claimed: false };
}

/** Die drei Aufgaben eines Tages. */
export function rollDailyMissions(content: ContentRegistries, day: string, chapter: number): MissionEntry[] {
  const rng = new Rng(hashString(`${day}|${chapter}`));
  const list: MissionEntry[] = [];
  for (let d = 0; d < 3; d++) {
    const m = pickMission(content, rng, d, chapter, list.map((x) => x.id));
    if (m) list.push(m);
  }
  return list;
}

/**
 * Sorgt dafür, dass die Aufgaben von heute im Spielstand stehen. Gibt true zurück, wenn sich
 * etwas geändert hat (neuer Tag oder Aufgabe ersetzt).
 */
export function ensureDailyMissions(content: ContentRegistries, save: SaveData, now = new Date()): boolean {
  const day = dayKey(now);
  const chapter = save.progress.chapter;
  const M = save.missions;
  if (M.day !== day || M.list.length === 0) {
    M.day = day;
    M.list = rollDailyMissions(content, day, chapter);
    M.bonusClaimed = false;
    return true;
  }
  // Unerreichbar gewordene Aufgaben (falsches Kapitel, unbekannt) ersetzen
  let changed = false;
  const rng = new Rng(hashString(`${day}|swap|${chapter}`));
  M.list = M.list.map((e) => {
    const def = content.missions.tryGet(e.id);
    if (def && (fitsChapter(def, chapter) || e.progress >= e.goal)) return e;
    changed = true;
    return pickMission(content, rng, e.difficulty, chapter, M.list.map((x) => x.id)) ?? e;
  });
  return changed;
}

export function missionText(content: ContentRegistries, e: MissionEntry): string {
  const def = content.missions.tryGet(e.id);
  return (def?.text ?? e.id).replace('{n}', formatGoal(e.goal));
}

function formatGoal(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString('de-DE') : n.toLocaleString('de-DE', { maximumFractionDigits: 1 });
}

export function missionDone(e: MissionEntry): boolean {
  return e.progress >= e.goal;
}

export function missionReward(e: MissionEntry): { pearls: number; xp: number } {
  return CONFIG.goals.missionRewards[Math.max(0, Math.min(2, e.difficulty))]!;
}

/** Belohnung einer erfüllten Aufgabe abholen (Perlen + XP landen im Spielstand). */
export function claimMission(save: SaveData, index: number): { pearls: number; xp: number } | null {
  const e = save.missions.list[index];
  if (!e || e.claimed || !missionDone(e)) return null;
  e.claimed = true;
  const r = missionReward(e);
  save.pearls += r.pearls;
  save.xp += r.xp;
  save.stats.totalXp += r.xp;
  return r;
}

/** Alle drei geschafft und abgeholt → Bonus-Truhe verfügbar? */
export function bonusAvailable(save: SaveData): boolean {
  const L = save.missions.list;
  return !save.missions.bonusClaimed && L.length > 0 && L.every((e) => e.claimed);
}

/** Bonus abholen: Anzahl Truhen (0 = nicht verfügbar). */
export function claimBonus(save: SaveData): number {
  if (!bonusAvailable(save)) return 0;
  save.missions.bonusClaimed = true;
  return CONFIG.goals.bonusChests;
}

// ---------------------------------------------------------------------------
// Erfolge
// ---------------------------------------------------------------------------

export function achievementValue(save: SaveData, stat: AchievementStat): number {
  switch (stat) {
    case 'highscore':
      return save.highscore;
    case 'bossCrab':
      return save.progress.bossDefeated ? 1 : 0;
    case 'metKeoni':
      return save.progress.metKeoni ? 1 : 0;
    case 'bossTitan':
      return save.progress.titanDefeated ? 1 : 0;
    case 'bossColossus':
      return save.progress.colossusDefeated ? 1 : 0;
    case 'chapter':
      return save.progress.chapter;
    default:
      return save.stats[stat];
  }
}

export interface AchievementState {
  value: number;
  /** Erreichte Stufen */
  reached: number;
  /** Abgeholte Stufen */
  claimed: number;
  /** Ziel der nächsten Stufe (null = alle erreicht) */
  next: number | null;
}

export function achievementState(save: SaveData, def: AchievementDef): AchievementState {
  const value = achievementValue(save, def.stat);
  const reached = def.tiers.filter((t) => value >= t).length;
  const claimed = Math.min(reached, save.achievements[def.id] ?? 0);
  return { value, reached, claimed, next: def.tiers[reached] ?? null };
}

/** Belohnung einer Stufe; einstufige Erfolge zählen als Gold. */
export function achievementReward(def: AchievementDef, tierIndex: number): { pearls: number; xp: number } {
  const R = CONFIG.goals.achievementRewards;
  const i = def.tiers.length === 1 ? R.length - 1 : Math.min(R.length - 1, tierIndex);
  return R[i]!;
}

/** Nächste erreichte, noch nicht abgeholte Stufe abholen. */
export function claimAchievement(save: SaveData, def: AchievementDef): { pearls: number; xp: number } | null {
  const st = achievementState(save, def);
  if (st.claimed >= st.reached) return null;
  const r = achievementReward(def, st.claimed);
  save.achievements[def.id] = st.claimed + 1;
  save.pearls += r.pearls;
  save.xp += r.xp;
  save.stats.totalXp += r.xp;
  return r;
}

/** Wie viel gerade abgeholt werden kann (für den Hinweis-Punkt im Menü). */
export function claimableCount(content: ContentRegistries, save: SaveData): number {
  let n = save.missions.list.filter((e) => !e.claimed && missionDone(e)).length + (bonusAvailable(save) ? 1 : 0);
  for (const a of content.achievements.all()) {
    const st = achievementState(save, a);
    n += st.reached - st.claimed;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Fortschritt aus Ereignissen
// ---------------------------------------------------------------------------

export interface GoalListener {
  /** Eine Tagesaufgabe ist gerade erfüllt worden */
  missionCompleted(entry: MissionEntry, text: string): void;
  /** Ein Erfolg hat eine neue Stufe erreicht (tier = 0-basiert) */
  achievementReached(def: AchievementDef, tier: number): void;
}

/** Hört auf Spiel-Ereignisse und zählt Aufgaben, Statistiken und Erfolge mit. */
export class GoalTracker {
  private run: Partial<Record<GoalCounter, number>> = {};
  private reached = new Map<string, number>();
  private readonly offs: (() => void)[] = [];

  constructor(
    bus: GameEventBus,
    private readonly content: ContentRegistries,
    private readonly getSave: () => SaveData,
    private readonly listener: GoalListener,
  ) {
    this.syncReached();
    const S = () => this.getSave().stats;
    this.offs.push(
      bus.on('runStarted', () => {
        this.run = {};
        this.syncReached();
      }),
      bus.on('pearlCollected', (e) => this.track('pearls', e.value, 'add')),
      bus.on('monsterDefeated', (e) => this.track('monsters', 1, 'add', { monsterId: e.monsterId })),
      bus.on('monsterHit', (e) => {
        if (e.weakness) this.track('weaknessHits', 1, 'add');
      }),
      bus.on('trickLanded', (e) => {
        const s = S();
        s.tricksLanded++;
        this.track('tricks', 1, 'add', { trickId: e.trickId });
        if (e.quality === 'perfect') {
          s.perfectTricks++;
          this.track('perfectTricks', 1, 'add');
        }
        s.maxAirCombo = Math.max(s.maxAirCombo, e.chain);
        this.track('airCombo', e.chain, 'max');
        this.checkAchievements();
      }),
      bus.on('waveCaught', () => {
        S().wavesCaught++;
        this.track('waves', 1, 'add');
        this.checkAchievements();
      }),
      bus.on('launched', (e) => {
        if (e.source === 'ramp') {
          S().rampJumps++;
          this.track('rampJumps', 1, 'add');
        } else if (e.source === 'geyser') {
          S().geyserJumps++;
          this.track('geyserJumps', 1, 'add');
        } else if (e.source === 'punch') this.track('punches', 1, 'add');
        else if (e.source === 'bounce') this.track('headJumps', 1, 'add');
        this.checkAchievements();
      }),
      bus.on('monsterFrozen', () => {
        S().monstersFrozen++;
        this.track('frozen', 1, 'add');
        this.checkAchievements();
      }),
      bus.on('dolphinRide', (e) => {
        if (e.active) this.track('dolphinRides', 1, 'add');
      }),
      bus.on('pickupCollected', (e) => {
        if (this.content.pickups.tryGet(e.pickupId)?.chest) this.track('chests', 1, 'add');
      }),
      bus.on('landed', (e) => {
        const s = S();
        s.bestAirtime = Math.max(s.bestAirtime, Math.round(e.airtime * 10) / 10);
        this.track('airtime', e.airtime, 'max');
        this.checkAchievements();
      }),
      bus.on('scoreAdded', (e) => this.track('score', e.total, 'max')),
      bus.on('runEnded', () => this.checkAchievements()),
    );
  }

  dispose(): void {
    for (const off of this.offs) off();
  }

  /** Stand der erreichten Stufen übernehmen (ohne Meldung), z. B. nach dem Laden. */
  syncReached(): void {
    const save = this.getSave();
    for (const a of this.content.achievements.all()) this.reached.set(a.id, achievementState(save, a).reached);
  }

  /** Neue Erfolgsstufen melden (auch nach Story-Ereignissen von außen aufrufen). */
  checkAchievements(): void {
    const save = this.getSave();
    for (const a of this.content.achievements.all()) {
      const now = achievementState(save, a).reached;
      const before = this.reached.get(a.id) ?? 0;
      if (now > before) {
        this.reached.set(a.id, now);
        this.listener.achievementReached(a, now - 1);
      }
    }
  }

  private track(counter: GoalCounter, amount: number, kind: 'add' | 'max', ctx: { monsterId?: string; trickId?: string } = {}): void {
    const prev = this.run[counter] ?? 0;
    const runValue = kind === 'add' ? prev + amount : Math.max(prev, amount);
    this.run[counter] = runValue;
    const save = this.getSave();
    for (const e of save.missions.list) {
      if (e.claimed || missionDone(e)) continue;
      const def = this.content.missions.tryGet(e.id);
      if (!def || def.counter !== counter) continue;
      if (def.filter?.monsterId && def.filter.monsterId !== ctx.monsterId) continue;
      if (def.filter?.trickId && def.filter.trickId !== ctx.trickId) continue;
      if (def.mode === 'sum') e.progress += kind === 'add' ? amount : 0;
      else e.progress = Math.max(e.progress, runValue);
      if (missionDone(e)) {
        e.progress = Math.max(e.progress, e.goal);
        this.listener.missionCompleted(e, missionText(this.content, e));
      }
    }
  }
}
