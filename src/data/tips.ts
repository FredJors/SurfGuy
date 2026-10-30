/**
 * Einmalige Tipps: erscheinen, wenn etwas zum ersten Mal vorkommt (Auslöser in core/Game.ts).
 * Im Run spricht Keoni über Funk, im Menü hängt eine Sprechblase an der passenden Kachel.
 */
import type { TipDef } from './types';

export const TIPS: readonly TipDef[] = [
  { id: 'wreck', where: 'run', text: 'Ein Wrack! Übers Heck die Rampe hoch – riesiger Sprung, Zeit für mehrere Tricks!' },
  { id: 'geyser', where: 'run', text: 'Ein Geysir! Blubbert er, fahr drüber – er schleudert dich hoch hinaus.' },
  {
    id: 'punch',
    where: 'run',
    text: 'Welle von vorn! Spring, wenn „SPRING“ steht – Durchstoß mit Tempo-Schub!',
    textTouch: 'Welle von vorn! Wisch nach oben, wenn „SPRING“ steht – Durchstoß!',
  },
  { id: 'hit', where: 'run', text: 'Autsch, ein Herz weg! Nach einem Treffer bist du kurz unverwundbar.' },
  { id: 'weakness', where: 'run', text: 'Jedes Monster hat Schwächen – im Zeichenfenster stehen sie an den Tricks (×2).' },
  { id: 'shop', where: 'menu', tile: 'shop', text: 'Neues Board drin!' },
  { id: 'skills', where: 'menu', tile: 'skills', text: 'Skill freischalten!' },
  { id: 'goals', where: 'menu', tile: 'goals', text: 'Belohnung abholen!' },
  { id: 'bestiary', where: 'menu', tile: 'bestiary', text: 'Schwächen nachlesen!' },
];
