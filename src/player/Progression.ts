/**
 * Verbindet dauerhaften Fortschritt (Spielstand) mit Spielerwerten:
 * Grundwerte aus der Konfiguration + Board + Skills + Fähigkeiten → berechnete Endwerte.
 */
import { CONFIG } from '../config/gameConfig';
import { StatSheet } from '../core/Modifiers';
import type { SaveData } from '../core/SaveGame';
import type { ContentRegistries } from '../data';
import type { BoardDef, Modifier, PlayerStatId, UnlockCondition } from '../data/types';

export type PlayerStats = StatSheet<PlayerStatId>;

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
    if (ability?.modifiers) sheet.addSource({ id: `ability:${ability.id}`, modifiers: ability.modifiers });
  }
  return sheet;
}

/** Ist eine Freischaltbedingung erfüllt? (Kauf-Bedingungen gelten als erfüllt, wenn bereits gekauft.) */
export function isUnlocked(cond: UnlockCondition, save: SaveData, ownedIds: readonly string[] = [], id?: string): boolean {
  if (id && ownedIds.includes(id)) return true;
  switch (cond.type) {
    case 'default':
      return true;
    case 'pearls':
      return false; // muss gekauft werden (Shop ab Meilenstein 2)
    case 'xp':
      return save.xp >= cond.amount;
    case 'skill':
      return save.unlocked.skills.includes(cond.skillId);
    case 'bestiary':
      return (save.bestiary[cond.monsterId]?.highestTierDefeated ?? 0) >= cond.tier;
    case 'highscore':
      return save.highscore >= cond.score;
  }
}

/** Kann ein Skill-Knoten freigeschaltet werden (Voraussetzungen + Kosten)? */
export function canUnlockSkill(content: ContentRegistries, save: SaveData, skillId: string): boolean {
  const node = content.skills.get(skillId);
  if (save.unlocked.skills.includes(skillId)) return false;
  if (!node.requires.every((r) => save.unlocked.skills.includes(r))) return false;
  return save.xp >= (node.cost.xp ?? 0) && save.pearls >= (node.cost.pearls ?? 0);
}
