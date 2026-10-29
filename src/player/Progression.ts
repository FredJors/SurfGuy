/**
 * Verbindet dauerhaften Fortschritt (Spielstand) mit Spielerwerten und Freischaltungen:
 * - Grundwerte + Board + Skills + Fähigkeiten → berechnete Endwerte (Modifikator-System)
 * - Shop: Boards und Skins kaufen und ausrüsten
 * - Skillbaum: Knoten freischalten, aktive Fähigkeiten ausrüsten
 *
 * Alles hier sind reine Funktionen auf Spielstand + Registern (gut testbar, kein DOM).
 */
import { CONFIG } from '../config/gameConfig';
import { StatSheet } from '../core/Modifiers';
import type { SaveData } from '../core/SaveGame';
import type { ContentRegistries } from '../data';
import type { AbilityDef, BoardDef, Modifier, PlayerStatId, SkillNodeDef, SkinDef, UnlockCondition } from '../data/types';

export type PlayerStats = StatSheet<PlayerStatId>;

/** Max. Anzahl ausgerüsteter aktiver Fähigkeiten. */
export const ABILITY_SLOTS = 2;

/** Übersetzt die Board-Basiswerte (Faktoren) in Modifikatoren. */
export function boardModifiers(board: BoardDef): Modifier[] {
  const s = board.stats;
  return [
    { stat: 'maxSpeed', op: 'mul', value: s.speed },
    { stat: 'cruiseSpeed', op: 'mul', value: s.speed },
    { stat: 'paddleSpeed', op: 'mul', value: s.speed },
    { stat: 'turnRate', op: 'mul', value: s.agility },
    { stat: 'jumpPower', op: 'mul', value: s.airtime },
    { stat: 'stability', op: 'mul', value: s.stability },
    ...(board.modifiers ?? []),
  ];
}

export function createPlayerStats(content: ContentRegistries, save: SaveData): PlayerStats {
  const sheet: PlayerStats = new StatSheet<PlayerStatId>({ ...CONFIG.playerBase });
  const board = content.boards.tryGet(save.equipped.board) ?? content.boards.all()[0]!;
  sheet.addSource({ id: `board:${board.id}`, modifiers: boardModifiers(board) });

  for (const skillId of save.unlocked.skills) {
    const node = content.skills.tryGet(skillId);
    if (!node) continue;
    if (node.modifiers) sheet.addSource({ id: `skill:${node.id}`, modifiers: node.modifiers });
    const ability = node.grantsAbility ? content.abilities.tryGet(node.grantsAbility) : undefined;
    // Passive Fähigkeiten wirken immer, aktive nur über ihren Effekt
    if (ability?.kind === 'passive' && ability.modifiers) sheet.addSource({ id: `ability:${ability.id}`, modifiers: ability.modifiers });
  }
  return sheet;
}

// ---------------------------------------------------------------------------
// Freischaltbedingungen
// ---------------------------------------------------------------------------

/**
 * Ist die Bedingung erfüllt? `pearls` ist keine Sperre, sondern der Preis (immer „erfüllt“).
 */
export function conditionMet(cond: UnlockCondition, save: SaveData): boolean {
  switch (cond.type) {
    case 'default':
    case 'pearls':
      return true;
    case 'xp':
      return save.stats.totalXp >= cond.amount;
    case 'skill':
      return save.unlocked.skills.includes(cond.skillId);
    case 'bestiary':
      return (save.bestiary[cond.monsterId]?.highestTierDefeated ?? 0) >= cond.tier;
    case 'highscore':
      return save.highscore >= cond.score;
  }
}

/** Ist ein Inhalt freigeschaltet (Bedingung erfüllt bzw. bereits im Besitz)? */
export function isUnlocked(cond: UnlockCondition, save: SaveData, ownedIds: readonly string[] = [], id?: string): boolean {
  if (id && ownedIds.includes(id)) return true;
  if (cond.type === 'pearls') return false; // muss gekauft werden
  return conditionMet(cond, save);
}

/** Lesbarer Text für eine Bedingung, z. B. „Kraken Stufe 2 besiegen“. */
export function describeCondition(cond: UnlockCondition, content: ContentRegistries): string {
  switch (cond.type) {
    case 'default':
      return 'Von Anfang an';
    case 'pearls':
      return `${cond.amount} Perlen`;
    case 'xp':
      return `${cond.amount} Erfahrung gesammelt`;
    case 'skill':
      return `Skill „${content.skills.tryGet(cond.skillId)?.name ?? cond.skillId}“`;
    case 'bestiary':
      return `${content.monsters.tryGet(cond.monsterId)?.name ?? cond.monsterId} Stufe ${cond.tier} besiegen`;
    case 'highscore':
      return `Highscore ${cond.score.toLocaleString('de-DE')}`;
  }
}

// ---------------------------------------------------------------------------
// Shop: Boards & Skins
// ---------------------------------------------------------------------------

export type ShopKind = 'board' | 'skin';

export interface ItemStatus {
  owned: boolean;
  equipped: boolean;
  /** Freischaltbedingung erfüllt (Preis zählt nicht dazu) */
  conditionMet: boolean;
  price: number;
  /** Kann jetzt gekauft werden */
  canBuy: boolean;
  /** Warum gesperrt (null = nicht gesperrt) */
  lockedReason: string | null;
}

function ownedList(kind: ShopKind, save: SaveData): string[] {
  return kind === 'board' ? save.unlocked.boards : save.unlocked.skins;
}

export function itemStatus(kind: ShopKind, def: BoardDef | SkinDef, save: SaveData, content: ContentRegistries): ItemStatus {
  const owned = ownedList(kind, save).includes(def.id) || def.unlock.type === 'default';
  const equipped = (kind === 'board' ? save.equipped.board : save.equipped.skin) === def.id;
  const met = conditionMet(def.unlock, save);
  const price = def.price;
  return {
    owned,
    equipped,
    conditionMet: met,
    price,
    canBuy: !owned && met && save.pearls >= price,
    lockedReason: !owned && !met ? describeCondition(def.unlock, content) : null,
  };
}

/** Kauft einen Gegenstand (zieht Perlen ab). Gibt true bei Erfolg zurück. */
export function buyItem(kind: ShopKind, id: string, save: SaveData, content: ContentRegistries): boolean {
  const def = kind === 'board' ? content.boards.tryGet(id) : content.skins.tryGet(id);
  if (!def) return false;
  const st = itemStatus(kind, def, save, content);
  if (!st.canBuy) return false;
  save.pearls -= st.price;
  ownedList(kind, save).push(id);
  return true;
}

/** Rüstet einen Gegenstand aus, wenn er im Besitz ist. */
export function equipItem(kind: ShopKind, id: string, save: SaveData, content: ContentRegistries): boolean {
  const def = kind === 'board' ? content.boards.tryGet(id) : content.skins.tryGet(id);
  if (!def || !itemStatus(kind, def, save, content).owned) return false;
  if (kind === 'board') save.equipped.board = id;
  else save.equipped.skin = id;
  return true;
}

// ---------------------------------------------------------------------------
// Skillbaum
// ---------------------------------------------------------------------------

export type SkillState = 'owned' | 'available' | 'unaffordable' | 'locked';

export function skillState(content: ContentRegistries, save: SaveData, skillId: string): SkillState {
  const node = content.skills.get(skillId);
  if (save.unlocked.skills.includes(skillId)) return 'owned';
  if (!node.requires.every((r) => save.unlocked.skills.includes(r))) return 'locked';
  return canAfford(node, save) ? 'available' : 'unaffordable';
}

function canAfford(node: SkillNodeDef, save: SaveData): boolean {
  return save.xp >= (node.cost.xp ?? 0) && save.pearls >= (node.cost.pearls ?? 0);
}

/** Kann ein Skill-Knoten freigeschaltet werden (Voraussetzungen + Kosten)? */
export function canUnlockSkill(content: ContentRegistries, save: SaveData, skillId: string): boolean {
  return skillState(content, save, skillId) === 'available';
}

/**
 * Schaltet einen Skill frei (zieht XP/Perlen ab). Gewährt er eine aktive Fähigkeit und ist
 * ein Platz frei, wird sie direkt ausgerüstet.
 */
export function unlockSkill(content: ContentRegistries, save: SaveData, skillId: string): boolean {
  if (!canUnlockSkill(content, save, skillId)) return false;
  const node = content.skills.get(skillId);
  save.xp -= node.cost.xp ?? 0;
  save.pearls -= node.cost.pearls ?? 0;
  save.unlocked.skills.push(skillId);
  if (node.grantsTrick && !save.unlocked.tricks.includes(node.grantsTrick)) save.unlocked.tricks.push(node.grantsTrick);
  const ability = node.grantsAbility ? content.abilities.tryGet(node.grantsAbility) : undefined;
  if (ability?.kind === 'active' && save.equipped.abilities.length < ABILITY_SLOTS) save.equipped.abilities.push(ability.id);
  return true;
}

// ---------------------------------------------------------------------------
// Aktive Fähigkeiten
// ---------------------------------------------------------------------------

/** Alle freigeschalteten aktiven Fähigkeiten (über Skills gewährt). */
export function unlockedActiveAbilities(content: ContentRegistries, save: SaveData): AbilityDef[] {
  const out: AbilityDef[] = [];
  for (const skillId of save.unlocked.skills) {
    const id = content.skills.tryGet(skillId)?.grantsAbility;
    const ability = id ? content.abilities.tryGet(id) : undefined;
    if (ability?.kind === 'active' && !out.includes(ability)) out.push(ability);
  }
  return out;
}

/** Ausgerüstete aktive Fähigkeiten in Platz-Reihenfolge (nur gültige). */
export function equippedAbilities(content: ContentRegistries, save: SaveData): AbilityDef[] {
  const unlocked = unlockedActiveAbilities(content, save);
  return save.equipped.abilities
    .map((id) => unlocked.find((a) => a.id === id))
    .filter((a): a is AbilityDef => !!a)
    .slice(0, ABILITY_SLOTS);
}

/** Fähigkeit aus-/einrüsten. Bei vollen Plätzen wird die älteste ersetzt. */
export function toggleAbility(content: ContentRegistries, save: SaveData, abilityId: string): boolean {
  const i = save.equipped.abilities.indexOf(abilityId);
  if (i >= 0) {
    save.equipped.abilities.splice(i, 1);
    return true;
  }
  if (!unlockedActiveAbilities(content, save).some((a) => a.id === abilityId)) return false;
  save.equipped.abilities.push(abilityId);
  while (save.equipped.abilities.length > ABILITY_SLOTS) save.equipped.abilities.shift();
  return true;
}

// ---------------------------------------------------------------------------
// Bestiarium
// ---------------------------------------------------------------------------

/**
 * Fortschritt Richtung Boss (Meilenstein 3): Summe der besiegten Stufen über alle Monsterarten.
 * Alle Arten auf höchster Stufe besiegt → done === total.
 */
export function bestiaryProgress(content: ContentRegistries, save: SaveData): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const m of content.monsters.all()) {
    total += m.tiers.length;
    done += Math.min(m.tiers.length, save.bestiary[m.id]?.highestTierDefeated ?? 0);
  }
  return { done, total };
}

/** In welchen Zonen taucht ein Monster auf? (Namen, nach Gewicht sortiert) */
export function monsterZones(content: ContentRegistries, monsterId: string): string[] {
  const m = content.monsters.get(monsterId);
  return content.zones
    .all()
    .filter((z) => (m.zoneWeights[z.id] ?? 0) > 0)
    .sort((a, b) => (m.zoneWeights[b.id] ?? 0) - (m.zoneWeights[a.id] ?? 0))
    .map((z) => z.name);
}
