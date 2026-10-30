/**
 * Die Kapitel der Geschichte (für Kapitelwahl, Menü und Welt). Ein Kapitel bestimmt Farbstimmung,
 * Rampen, Begleiter und welche Monster auftauchen (MonsterDef.chapter).
 */
export type ChapterTheme = 'paradise' | 'fire' | 'ice';

export interface ChapterInfo {
  readonly id: number;
  readonly name: string;
  /** Kurz: was erwartet einen dort */
  readonly tagline: string;
  readonly theme: ChapterTheme;
  /** Symbol (siehe ui/icons.ts) */
  readonly icon: 'palm' | 'volcano' | 'snowflake';
  /** Verlauf der Kapitel-Karte (oben, unten) */
  readonly colors: readonly [string, string];
  /** Endgegner-Arena, die man über das Menü betreten kann (nach Keonis Hinweis) */
  readonly arena?: { readonly label: string; readonly icon: 'volcano' | 'snowflake' };
  /** Endgegner dieses Kapitels (Monster-ID) */
  readonly boss: string;
}

export const CHAPTERS: readonly ChapterInfo[] = [
  {
    id: 1,
    name: 'Paradies',
    tagline: 'Kraken, Riffhai und Riesenqualle – Schiffswracks als Rampen',
    theme: 'paradise',
    icon: 'palm',
    colors: ['#4fd1ff', '#1f7fd8'],
    boss: 'giant_crab',
  },
  {
    id: 2,
    name: 'Feuermeer',
    tagline: 'Seeschlange, Buckelwal und Riesenmuschel – Vulkan-Trümmer als Rampen',
    theme: 'fire',
    icon: 'volcano',
    colors: ['#ff9a4a', '#c4302a'],
    arena: { label: 'Krater', icon: 'volcano' },
    boss: 'lava_titan',
  },
  {
    id: 3,
    name: 'Eismeer',
    tagline: 'Eisbär, Seeleopard und Narwal – Eisberge als Rampen, Pinguine als Begleiter',
    theme: 'ice',
    icon: 'snowflake',
    colors: ['#bff0ff', '#3a8fd8'],
    arena: { label: 'Gletscher', icon: 'snowflake' },
    boss: 'frost_colossus',
  },
];

export function chapterInfo(id: number): ChapterInfo {
  return CHAPTERS.find((c) => c.id === id) ?? CHAPTERS[0]!;
}
