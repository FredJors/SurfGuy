/** Aktive Fähigkeiten während eines Runs: Plätze, Abklingzeiten, Auslösen. */
import type { AbilityDef } from '../data/types';
import { ABILITY_EFFECTS, type AbilityContext } from './abilityEffects';

export interface AbilitySlot {
  readonly def: AbilityDef;
  /** Verbleibende Abklingzeit (s) */
  cooldown: number;
}

export class AbilitySystem {
  slots: AbilitySlot[] = [];

  /** Zu Run-Beginn mit den ausgerüsteten Fähigkeiten belegen. */
  setup(defs: readonly AbilityDef[]): void {
    this.slots = defs.map((def) => ({ def, cooldown: 0 }));
  }

  clear(): void {
    this.slots = [];
  }

  /** Abklingzeit 0..1 (1 = gerade benutzt, 0 = bereit). */
  cooldownFraction(i: number): number {
    const s = this.slots[i];
    if (!s || !s.def.cooldown) return 0;
    return Math.max(0, s.cooldown / s.def.cooldown);
  }

  canUse(i: number, ctx: AbilityContext): boolean {
    const slot = this.slots[i];
    if (!slot || slot.cooldown > 0) return false;
    const effect = slot.def.effect ? ABILITY_EFFECTS[slot.def.effect] : undefined;
    return !!effect && (effect.canUse?.(ctx, slot.def) ?? true);
  }

  /** Löst Platz i aus. Gibt true zurück, wenn die Fähigkeit gewirkt hat. */
  trigger(i: number, ctx: AbilityContext): boolean {
    if (!this.canUse(i, ctx)) return false;
    const slot = this.slots[i]!;
    ABILITY_EFFECTS[slot.def.effect!]!.activate(ctx, slot.def);
    slot.cooldown = slot.def.cooldown ?? 0;
    ctx.bus.emit('abilityUsed', { abilityId: slot.def.id, slot: i });
    return true;
  }

  update(dt: number): void {
    for (const s of this.slots) s.cooldown = Math.max(0, s.cooldown - dt);
  }
}
