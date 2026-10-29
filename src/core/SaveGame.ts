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
  };
  equipped: {
    board: string;
    skin: string;
    /** Ausgerüstete aktive Fähigkeiten (max. 2 Plätze) */
    abilities: string[];
  };
  bestiary: Record<string, BestiaryEntry>;
  stats: {
    runs: number;
    totalPearls: number;
    /** Insgesamt verdiente Erfahrung (XP wird im Skillbaum ausgegeben, das hier nicht) */
    totalXp: number;
    totalMonstersDefeated: number;
    bestCombo: number;
  };
  settings: {
    /** Grafikqualität: 'auto' passt die Auflösung an die Bildrate an. */
    quality: 'auto' | 'low' | 'high';
  };
}

export const SAVE_VERSION = 2;

export function createDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    pearls: 0,
    xp: 0,
    highscore: 0,
    unlocked: { boards: ['classic'], skins: ['default'], skills: [], tricks: [] },
    equipped: { board: 'classic', skin: 'default', abilities: [] },
    bestiary: {},
    stats: { runs: 0, totalPearls: 0, totalXp: 0, totalMonstersDefeated: 0, bestCombo: 0 },
    settings: { quality: 'auto' },
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
