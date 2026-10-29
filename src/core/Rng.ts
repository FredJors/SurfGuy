/** Deterministischer Zufall (mulberry32) – gleicher Seed, gleiche Welt. */
export class Rng {
  private state: number;

  constructor(readonly seed: number) {
    this.state = seed >>> 0;
  }

  static randomSeed(): number {
    return (Math.random() * 0xffffffff) >>> 0;
  }

  /** Gleichverteilt in [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Ganze Zahl in [min, max] (inklusive). */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  sign(): 1 | -1 {
    return this.next() < 0.5 ? -1 : 1;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('[Rng] pick aus leerer Liste');
    return items[Math.floor(this.next() * items.length)]!;
  }

  /** Gewichtete Auswahl; Einträge mit Gewicht ≤ 0 werden ignoriert. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T | undefined {
    let total = 0;
    for (const item of items) total += Math.max(0, weight(item));
    if (total <= 0) return undefined;
    let r = this.next() * total;
    for (const item of items) {
      const w = Math.max(0, weight(item));
      if (w <= 0) continue;
      r -= w;
      if (r < 0) return item;
    }
    return items[items.length - 1];
  }

  /** Unabhängiger Teil-Zufallsstrom (z. B. eigener Strom für Wellen und Monster). */
  fork(salt: number): Rng {
    return new Rng((Math.imul(this.seed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(salt, 0xc2b2ae35)) >>> 0);
  }
}
