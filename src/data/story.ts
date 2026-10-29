/**
 * Geschichte als Daten: Szenen aus Dialogzeilen, Kameraeinstellungen und Ereignissen.
 * Kameraeinstellungen: 'keoni', 'volcano', 'sea'. Ereignisse: 'pathGlow', 'rumble', 'eruption', 'chapter2'.
 */
import type { CutsceneStep } from '../story/Cutscene';

/** Erstes Treffen mit Keoni im Surfshop → Vulkanausbruch → Kapitel 2. */
export const KEONI_INTRO: CutsceneStep[] = [
  { shot: 'keoni', time: 1.4 },
  { say: 'Aloha, kleiner Wellenreiter! Du hast den Wächter vor dem Riff besiegt? Respekt!' },
  { say: 'Ich bin Keoni. Ich spiele hier für die Wellen – und ich hüte einen alten Pfad.' },
  { shot: 'volcano', time: 2.6 },
  { event: 'pathGlow' },
  { say: 'Siehst du ihn? Er führt hinauf in den Vulkan, zum Herzen der Insel.' },
  { say: 'Von dort kamen all die Monster. Und seit der Wächter fort ist …' },
  { event: 'rumble' },
  { say: '… grollt der Berg. Hörst du das? Oh, oh …' },
  { event: 'eruption' },
  { shot: 'sea', time: 2.8 },
  { wait: 3.4 },
  { shot: 'keoni', time: 1.6 },
  { say: 'Pele ist erwacht! Das Meer ist jetzt voller Feuer – und neue Kreaturen steigen auf!' },
  { say: 'Eine Seeschlange, ein riesiger Wal und eine Muschel, so groß wie mein Laden …' },
  { say: 'Nimm dein Brett. Und hier – drei neue Tricks, die wirst du brauchen. Malama pono!' },
  { event: 'chapter2' },
];

/** Später: kurzer Gruß und ein Tipp. */
export const KEONI_LATER: CutsceneStep[] = [
  { shot: 'keoni', time: 1.2 },
  { say: 'Aloha! Die Vulkan-Trümmer im Wasser sind perfekte Rampen – flieg hoch und zeig deine neuen Tricks!' },
  { say: 'Und Vorsicht: Die Muschel spuckt, wenn sie offen ist. Genau dann ist sie aber auch verwundbar.' },
];
