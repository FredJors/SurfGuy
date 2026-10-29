/**
 * Modifikator-System: Boards, Skills und Fähigkeiten verändern Werte über einen
 * gemeinsamen Mechanismus. Der Endwert wird berechnet, nie hart gesetzt:
 *
 *   final = (basis + Σ add) × (1 + Σ addPct) × Π mul
 *
 * anschließend optional begrenzt durch `min`/`max`-Modifikatoren.
 */
export type ModifierOp = 'add' | 'addPct' | 'mul' | 'min' | 'max';

export interface Modifier<S extends string = string> {
  readonly stat: S;
  readonly op: ModifierOp;
  readonly value: number;
}

export interface ModifierSource<S extends string = string> {
  /** Eindeutige Quelle, z. B. "board:classic" oder "skill:paddle_1". */
  readonly id: string;
  readonly modifiers: readonly Modifier<S>[];
}

export function applyModifiers<S extends string>(base: number, stat: S, modifiers: Iterable<Modifier<S>>): number {
  let add = 0;
  let pct = 0;
  let mul = 1;
  let lo = -Infinity;
  let hi = Infinity;
  for (const m of modifiers) {
    if (m.stat !== stat) continue;
    switch (m.op) {
      case 'add':
        add += m.value;
        break;
      case 'addPct':
        pct += m.value;
        break;
      case 'mul':
        mul *= m.value;
        break;
      case 'min':
        lo = Math.max(lo, m.value);
        break;
      case 'max':
        hi = Math.min(hi, m.value);
        break;
    }
  }
  const value = (base + add) * (1 + pct) * mul;
  return Math.min(hi, Math.max(lo, value));
}

/** Hält Basiswerte und Modifikator-Quellen und berechnet (gecachte) Endwerte. */
export class StatSheet<S extends string> {
  private readonly base: Record<S, number>;
  private readonly sources = new Map<string, ModifierSource<S>>();
  private cache = new Map<S, number>();

  constructor(base: Record<S, number>) {
    this.base = { ...base };
  }

  setBase(stat: S, value: number): void {
    this.base[stat] = value;
    this.cache.clear();
  }

  getBase(stat: S): number {
    return this.base[stat];
  }

  addSource(source: ModifierSource<S>): void {
    this.sources.set(source.id, source);
    this.cache.clear();
  }

  removeSource(id: string): void {
    if (this.sources.delete(id)) this.cache.clear();
  }

  hasSource(id: string): boolean {
    return this.sources.has(id);
  }

  clearSources(): void {
    this.sources.clear();
    this.cache.clear();
  }

  get(stat: S): number {
    let v = this.cache.get(stat);
    if (v === undefined) {
      v = applyModifiers(this.base[stat], stat, this.allModifiers());
      this.cache.set(stat, v);
    }
    return v;
  }

  snapshot(): Record<S, number> {
    const out = {} as Record<S, number>;
    for (const stat of Object.keys(this.base) as S[]) out[stat] = this.get(stat);
    return out;
  }

  private *allModifiers(): Iterable<Modifier<S>> {
    for (const src of this.sources.values()) yield* src.modifiers;
  }
}
