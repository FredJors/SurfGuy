/**
 * Dauerhafter Spielstand in localStorage – versioniert, mit Migrationen.
 *
 * Neue Felder: SaveData erweitern, SAVE_VERSION erhöhen und in `migrations`
 * eine Funktion `alteVersion → alteVersion + 1` ergänzen.
 */

export interface BestiaryEntry {
  /** Wie oft angetroffen. */
  seen: number;
  /** Wie oft besiegt (alle Stufen). */
  defeated: number;
  /** Höchste besiegte Stufe (0 = noch nie besiegt). */
  highestTierDefeated: number;
  /** Siege je Stufe, Schlüssel = Stufe. */
  defeatedByTier: Record<string, number>;
}

export interface SaveData {
  version: number;
  pearls: number;
  xp: number;
  highscore: number;
  unlocked: {
    boards: string[];
    skins: string[];
    skills: string[];
    tricks: string[];
    /** Board-Designs (aus Truhen) */
    boardDesigns: string[];
  };
  equipped: {
    board: string;
    skin: string;
    /** Ausgerüstete aktive Fähigkeiten (max. 2 Plätze) */
    abilities: string[];
    /** Board-Design ('' = Originalfarben des Boards) */
    boardDesign: string;
  };
  /** Fortschritt in der Welt */
  progress: {
    /** Wächter der Insel (Riesenkrabbe) besiegt → Riff offen, Insel erreichbar */
    bossDefeated: boolean;
    /** Keoni im Surfshop getroffen (Story) */
    metKeoni: boolean;
    /** Höchstes erreichtes Kapitel (Geschichte): 1 = Paradies, 2 = Feuermeer, 3 = Eismeer */
    chapter: number;
    /** Gewähltes Kapitel (Welt, Monster); ab Kapitel 2 frei wählbar bis `chapter` */
    activeChapter: number;
    /** Keoni hat den Pfad in den Krater gezeigt (alle Kreaturen des Feuermeers besiegt) */
    volcanoOpen: boolean;
    /** Lava-Titan im Kratersee besiegt (Kapitel 2 abgeschlossen) */
    titanDefeated: boolean;
    /** Keoni hat den Weg in die Gletscherlagune gezeigt (alle Kreaturen des Eismeers besiegt) */
    glacierOpen: boolean;
    /** Frostkoloss besiegt (Kapitel 3 abgeschlossen) */
    colossusDefeated: boolean;
  };
  bestiary: Record<string, BestiaryEntry>;
  stats: {
    runs: number;
    totalPearls: number;
    /** Insgesamt verdiente Erfahrung (XP wird im Skillbaum ausgegeben, das hier nicht) */
    totalXp: number;
    totalMonstersDefeated: number;
    bestCombo: number;
    chestsOpened: number;
    tricksLanded: number;
    perfectTricks: number;
    /** Längste Airtime am Stück (s) */
    bestAirtime: number;
    /** Längste Luft-Kombo */
    maxAirCombo: number;
    rampJumps: number;
    geyserJumps: number;
    wavesCaught: number;
    /** Eingefrorene Monster (Frost-Tricks) */
    monstersFrozen: number;
  };
  /** Tagesaufgaben des aktuellen Tages */
  missions: {
    /** Datum (JJJJ-MM-TT, Ortszeit) */
    day: string;
    list: { id: string; difficulty: number; goal: number; progress: number; claimed: boolean }[];
    bonusClaimed: boolean;
  };
  /** Erfolge: id → Anzahl abgeholter Stufen */
  achievements: Record<string, number>;
  settings: {
    /** Grafikqualität: 'auto' passt die Auflösung an die Bildrate an. */
    quality: 'auto' | 'low' | 'high';
    /** Soundeffekte an/aus */
    sound: boolean;
  };
}

export const SAVE_VERSION = 7;

export function createDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    pearls: 0,
    xp: 0,
    highscore: 0,
    unlocked: { boards: ['classic'], skins: ['default'], skills: [], tricks: [], boardDesigns: [] },
    equipped: { board: 'classic', skin: 'default', abilities: [], boardDesign: '' },
    progress: {
      bossDefeated: false,
      metKeoni: false,
      chapter: 1,
      activeChapter: 1,
      volcanoOpen: false,
      titanDefeated: false,
      glacierOpen: false,
      colossusDefeated: false,
    },
    bestiary: {},
    stats: {
      runs: 0,
      totalPearls: 0,
      totalXp: 0,
      totalMonstersDefeated: 0,
      bestCombo: 0,
      chestsOpened: 0,
      tricksLanded: 0,
      perfectTricks: 0,
      bestAirtime: 0,
      maxAirCombo: 0,
      rampJumps: 0,
      geyserJumps: 0,
      wavesCaught: 0,
      monstersFrozen: 0,
    },
    missions: { day: '', list: [], bonusClaimed: false },
    achievements: {},
    settings: { quality: 'auto', sound: true },
  };
}

/** Migration von Version n auf n + 1. Schlüssel = Ausgangsversion. */
export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

export const migrations: Record<number, Migration> = {
  // v1 → v2 (Meilenstein 2): Fähigkeiten-Plätze; Gesamt-XP getrennt von ausgebbarer XP
  1: (d) => {
    const stats = (d.stats ?? {}) as Record<string, unknown>;
    const equipped = (d.equipped ?? {}) as Record<string, unknown>;
    return {
      ...d,
      equipped: { ...equipped, abilities: [] },
      stats: { ...stats, totalXp: typeof d.xp === 'number' ? d.xp : 0 },
    };
  },
  // v2 → v3: Truhen (Board-Designs) und Boss-Fortschritt
  2: (d) => {
    const unlocked = (d.unlocked ?? {}) as Record<string, unknown>;
    const equipped = (d.equipped ?? {}) as Record<string, unknown>;
    const stats = (d.stats ?? {}) as Record<string, unknown>;
    return {
      ...d,
      unlocked: { ...unlocked, boardDesigns: [] },
      equipped: { ...equipped, boardDesign: '' },
      progress: { bossDefeated: false },
      stats: { ...stats, chestsOpened: 0 },
    };
  },
  // v3 → v4: Story (Keoni) und Kapitel
  3: (d) => {
    const progress = (d.progress ?? {}) as Record<string, unknown>;
    return { ...d, progress: { ...progress, metKeoni: false, chapter: 1 } };
  },
  // v5 → v6: Tagesaufgaben, Erfolge, neue Statistiken (Felder ergänzt deepFill aus den Standardwerten)
  5: (d) => ({ ...d }),
  // v4 → v5: Kratersee und Lava-Titan
  4: (d) => {
    const progress = (d.progress ?? {}) as Record<string, unknown>;
    return { ...d, progress: { ...progress, volcanoOpen: false, titanDefeated: false } };
  },
  // v6 → v7: Kapitelwahl (aktives Kapitel = erreichtes), Kapitel 3 (Gletscherlagune, Frostkoloss)
  6: (d) => {
    const progress = (d.progress ?? {}) as Record<string, unknown>;
    const chapter = typeof progress.chapter === 'number' ? progress.chapter : 1;
    return { ...d, progress: { ...progress, activeChapter: chapter, glacierOpen: false, colossusDefeated: false } };
  },
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Fallback, falls localStorage nicht verfügbar ist (z. B. privater Modus). */
export class MemoryStorage implements StorageLike {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

export function getBrowserStorage(): StorageLike {
  try {
    const ls = globalThis.localStorage;
    const probe = '__surfguy_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    console.warn('[SaveGame] localStorage nicht verfügbar – Spielstand nur im Speicher.');
    return new MemoryStorage();
  }
}

export interface SaveStoreOptions {
  key?: string;
  version?: number;
  migrations?: Record<number, Migration>;
  defaults?: () => SaveData;
}

export class SaveStore {
  readonly key: string;
  private readonly version: number;
  private readonly migrations: Record<number, Migration>;
  private readonly defaults: () => SaveData;

  constructor(
    private readonly storage: StorageLike,
    options: SaveStoreOptions = {},
  ) {
    this.key = options.key ?? 'surfguy.save';
    this.version = options.version ?? SAVE_VERSION;
    this.migrations = options.migrations ?? migrations;
    this.defaults = options.defaults ?? createDefaultSave;
  }

  load(): SaveData {
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(this.key);
    } catch (err) {
      console.warn('[SaveGame] Lesen fehlgeschlagen', err);
    }
    if (!raw) return this.defaults();

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return this.migrate(parsed);
    } catch (err) {
      console.warn('[SaveGame] Spielstand beschädigt – starte neu (Sicherung unter *.corrupt).', err);
      try {
        this.storage.setItem(`${this.key}.corrupt`, raw);
      } catch {
        /* egal */
      }
      return this.defaults();
    }
  }

  save(data: SaveData): void {
    try {
      this.storage.setItem(this.key, JSON.stringify({ ...data, version: this.version }));
    } catch (err) {
      console.warn('[SaveGame] Speichern fehlgeschlagen', err);
    }
  }

  reset(): SaveData {
    try {
      this.storage.removeItem(this.key);
    } catch {
      /* egal */
    }
    return this.defaults();
  }

  /** Führt alle nötigen Migrationen aus und füllt fehlende Felder mit Standardwerten auf. */
  migrate(input: Record<string, unknown>): SaveData {
    let data = { ...input };
    let v = typeof data.version === 'number' ? data.version : 0;
    if (v > this.version) {
      console.warn(`[SaveGame] Spielstand-Version ${v} ist neuer als ${this.version} – lade best effort.`);
    }
    while (v < this.version) {
      const step = this.migrations[v];
      if (step) data = step(data);
      v += 1;
      data.version = v;
    }
    return deepFill(this.defaults(), data) as SaveData;
  }
}

/** Ergänzt fehlende Felder aus `defaults`, behält aber vorhandene (gültige) Werte. */
function deepFill(defaults: unknown, value: unknown): unknown {
  if (value === undefined || value === null) return defaults;
  if (Array.isArray(defaults)) return Array.isArray(value) ? value : defaults;
  if (typeof defaults === 'object' && defaults !== null) {
    if (typeof value !== 'object' || Array.isArray(value)) return defaults;
    const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    for (const [k, dv] of Object.entries(defaults)) {
      out[k] = deepFill(dv, (value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return typeof value === typeof defaults ? value : defaults;
}
