/**
 * Zentrale Register. Alle Inhalte werden hier aus den Datendateien geladen.
 * `validateContent` prüft Querverweise (z. B. ob ein Trick auf ein existierendes Symbol zeigt).
 */
import { Registry } from '../core/Registry';
import { ABILITIES } from './abilities';
import { BOARDS } from './boards';
import { MONSTERS } from './monsters';
import { POSES } from './poses';
import { SKILL_NODES } from './skills';
import { SKINS } from './skins';
import { SYMBOLS } from './symbols';
import { TRICKS } from './tricks';
import type {
  AbilityDef,
  BoardDef,
  MonsterDef,
  PoseDef,
  SkillNodeDef,
  SkinDef,
  SymbolDef,
  TrickDef,
  UnlockCondition,
  ZoneDef,
} from './types';
import { ZONES } from './zones';

export interface ContentRegistries {
  symbols: Registry<SymbolDef>;
  poses: Registry<PoseDef>;
  tricks: Registry<TrickDef>;
  boards: Registry<BoardDef>;
  skins: Registry<SkinDef>;
  abilities: Registry<AbilityDef>;
  skills: Registry<SkillNodeDef>;
  monsters: Registry<MonsterDef>;
  zones: Registry<ZoneDef>;
}

export function createRegistries(): ContentRegistries {
  return {
    symbols: new Registry<SymbolDef>('symbol').registerAll(SYMBOLS),
    poses: new Registry<PoseDef>('pose').registerAll(POSES),
    tricks: new Registry<TrickDef>('trick').registerAll(TRICKS),
    boards: new Registry<BoardDef>('board').registerAll(BOARDS),
    skins: new Registry<SkinDef>('skin').registerAll(SKINS),
    abilities: new Registry<AbilityDef>('ability').registerAll(ABILITIES),
    skills: new Registry<SkillNodeDef>('skill').registerAll(SKILL_NODES),
    monsters: new Registry<MonsterDef>('monster').registerAll(MONSTERS),
    zones: new Registry<ZoneDef>('zone').registerAll(ZONES),
  };
}

/** Prüft alle Querverweise. Gibt eine Liste lesbarer Fehler zurück (leer = alles gut). */
export function validateContent(c: ContentRegistries, knownBehaviors?: readonly string[], knownAbilityEffects?: readonly string[]): string[] {
  const errors: string[] = [];
  const check = (ok: boolean, msg: string) => {
    if (!ok) errors.push(msg);
  };
  const checkUnlock = (where: string, u: UnlockCondition) => {
    if (u.type === 'skill') check(c.skills.has(u.skillId), `${where}: unbekannter Skill "${u.skillId}"`);
    if (u.type === 'bestiary') check(c.monsters.has(u.monsterId), `${where}: unbekanntes Monster "${u.monsterId}"`);
  };

  for (const s of c.symbols.all()) {
    check(s.templates.length > 0, `Symbol ${s.id}: keine Vorlagen`);
  }

  const symbolOwners = new Map<string, string>();
  for (const t of c.tricks.all()) {
    check(t.symbols.length > 0, `Trick ${t.id}: kein Symbol`);
    for (const sym of t.symbols) {
      check(c.symbols.has(sym), `Trick ${t.id}: unbekanntes Symbol "${sym}"`);
      const owner = symbolOwners.get(sym);
      check(!owner, `Symbol "${sym}" ist doppelt belegt (${owner} und ${t.id})`);
      symbolOwners.set(sym, t.id);
    }
    for (const k of t.animation.poses) check(c.poses.has(k.pose), `Trick ${t.id}: unbekannte Pose "${k.pose}"`);
    check(t.duration > 0, `Trick ${t.id}: duration muss > 0 sein`);
    check(t.hitTime >= 0 && t.hitTime <= 1, `Trick ${t.id}: hitTime muss zwischen 0 und 1 liegen`);
    checkUnlock(`Trick ${t.id}`, t.unlock);
  }

  for (const b of c.boards.all()) checkUnlock(`Board ${b.id}`, b.unlock);
  for (const s of c.skins.all()) checkUnlock(`Skin ${s.id}`, s.unlock);

  for (const a of c.abilities.all()) {
    if (a.kind === 'active') {
      check(!!a.effect, `Fähigkeit ${a.id}: aktiv, aber ohne effect`);
      if (a.effect && knownAbilityEffects) check(knownAbilityEffects.includes(a.effect), `Fähigkeit ${a.id}: unbekannter Effekt "${a.effect}"`);
      check((a.cooldown ?? 0) > 0, `Fähigkeit ${a.id}: aktiv, aber ohne cooldown`);
    }
  }

  for (const n of c.skills.all()) {
    for (const r of n.requires) check(c.skills.has(r), `Skill ${n.id}: unbekannte Voraussetzung "${r}"`);
    if (n.grantsAbility) check(c.abilities.has(n.grantsAbility), `Skill ${n.id}: unbekannte Fähigkeit "${n.grantsAbility}"`);
    if (n.grantsTrick) check(c.tricks.has(n.grantsTrick), `Skill ${n.id}: unbekannter Trick "${n.grantsTrick}"`);
  }
  // Zyklen im Skillbaum erkennen
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (id: string): void => {
    if (done.has(id) || !c.skills.has(id)) return;
    if (visiting.has(id)) {
      errors.push(`Skillbaum: Zyklus bei "${id}"`);
      return;
    }
    visiting.add(id);
    for (const r of c.skills.get(id).requires) visit(r);
    visiting.delete(id);
    done.add(id);
  };
  for (const id of c.skills.ids()) visit(id);

  for (const m of c.monsters.all()) {
    if (knownBehaviors) check(knownBehaviors.includes(m.behavior), `Monster ${m.id}: unbekanntes Verhalten "${m.behavior}"`);
    for (const w of m.weaknesses) {
      check(c.tricks.has(w.trick), `Monster ${m.id}: Schwäche gegen unbekannten Trick "${w.trick}"`);
      if (w.tag) check(m.parts.some((p) => p.tag === w.tag), `Monster ${m.id}: Schwäche-Tag "${w.tag}" ohne passendes Teil`);
    }
    for (const z of Object.keys(m.zoneWeights)) check(c.zones.has(z), `Monster ${m.id}: unbekannte Zone "${z}"`);
    check(m.tiers.length > 0, `Monster ${m.id}: keine Stufen`);
  }

  return errors;
}
