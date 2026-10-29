/**
 * Generisches Register für typisierte Datendefinitionen (Tricks, Boards, Monster …).
 * Neue Inhalte = neuer Dateneintrag, kein Umbau von bestehendem Code.
 */
export interface Identified {
  readonly id: string;
}

export class Registry<T extends Identified> {
  private readonly items = new Map<string, T>();

  constructor(readonly kind: string) {}

  register(def: T): T {
    if (!def.id) throw new Error(`[Registry:${this.kind}] Eintrag ohne id`);
    if (this.items.has(def.id)) {
      throw new Error(`[Registry:${this.kind}] doppelte id "${def.id}"`);
    }
    this.items.set(def.id, def);
    return def;
  }

  registerAll(defs: readonly T[]): this {
    for (const def of defs) this.register(def);
    return this;
  }

  get(id: string): T {
    const def = this.items.get(id);
    if (!def) throw new Error(`[Registry:${this.kind}] unbekannte id "${id}"`);
    return def;
  }

  tryGet(id: string): T | undefined {
    return this.items.get(id);
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  all(): T[] {
    return [...this.items.values()];
  }

  ids(): string[] {
    return [...this.items.keys()];
  }

  filter(predicate: (def: T) => boolean): T[] {
    return this.all().filter(predicate);
  }

  get size(): number {
    return this.items.size;
  }
}
