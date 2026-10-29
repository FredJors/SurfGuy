/**
 * Kleiner, generischer Zustandsautomat. Zustände sind Objekte, die über `add`
 * registriert werden – neue Zustände lassen sich ergänzen, ohne die Maschine zu ändern.
 */
export interface State<Ctx, Id extends string> {
  readonly id: Id;
  /** Erlaubte Folgezustände. Fehlt die Liste, ist jeder Übergang erlaubt. */
  readonly next?: readonly Id[];
  enter?(ctx: Ctx, from: Id | null, data?: unknown): void;
  exit?(ctx: Ctx, to: Id): void;
  /** Gibt optional die id des nächsten Zustands zurück. */
  update?(ctx: Ctx, dt: number, timeInState: number): Id | void;
}

export type StateChangeListener<Id extends string> = (from: Id | null, to: Id) => void;

export class StateMachine<Ctx, Id extends string> {
  private readonly states = new Map<Id, State<Ctx, Id>>();
  private currentState: State<Ctx, Id> | null = null;
  private elapsed = 0;

  constructor(
    private readonly ctx: Ctx,
    private readonly onChange?: StateChangeListener<Id>,
  ) {}

  add(state: State<Ctx, Id>): this {
    if (this.states.has(state.id)) throw new Error(`[StateMachine] Zustand "${state.id}" existiert bereits`);
    this.states.set(state.id, state);
    return this;
  }

  has(id: Id): boolean {
    return this.states.has(id);
  }

  get current(): Id | null {
    return this.currentState?.id ?? null;
  }

  get timeInState(): number {
    return this.elapsed;
  }

  is(...ids: Id[]): boolean {
    return this.currentState !== null && ids.includes(this.currentState.id);
  }

  canTransition(to: Id): boolean {
    if (!this.states.has(to)) return false;
    const next = this.currentState?.next;
    return !next || next.includes(to);
  }

  /** Erzwingt einen Zustand (z. B. Neustart), ohne Übergangsregeln zu prüfen. */
  start(id: Id, data?: unknown): void {
    this.enter(id, data, true);
  }

  /** Wechselt den Zustand, wenn der Übergang erlaubt ist. Gibt `true` bei Erfolg zurück. */
  transition(to: Id, data?: unknown): boolean {
    if (!this.canTransition(to)) {
      if (import.meta.env?.DEV) console.warn(`[StateMachine] Übergang ${this.current} → ${to} nicht erlaubt`);
      return false;
    }
    this.enter(to, data, false);
    return true;
  }

  update(dt: number): void {
    if (!this.currentState) return;
    this.elapsed += dt;
    const next = this.currentState.update?.(this.ctx, dt, this.elapsed);
    if (next && next !== this.currentState.id) this.transition(next);
  }

  private enter(id: Id, data: unknown, force: boolean): void {
    const state = this.states.get(id);
    if (!state) throw new Error(`[StateMachine] unbekannter Zustand "${id}"`);
    const prev = this.currentState;
    if (prev && !force && prev.id === id) return;
    prev?.exit?.(this.ctx, id);
    this.currentState = state;
    this.elapsed = 0;
    state.enter?.(this.ctx, prev?.id ?? null, data);
    this.onChange?.(prev?.id ?? null, id);
  }
}
