/**
 * Geschichte als Daten: Szenen aus Dialogzeilen, Kameraeinstellungen und Ereignissen.
 * Kameraeinstellungen: 'keoni', 'volcano', 'sea' (Insel), 'titan', 'craterSky' (Kratersee).
 * Ereignisse: 'pathGlow', 'rumble', 'eruption', 'chapter2', 'enterCrater', 'calm', 'chapterEnd',
 * 'frost', 'chapter3'.
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

/** Alle Kreaturen des Feuermeers besiegt: Keoni zeigt den Pfad in den Krater. */
export const KEONI_VOLCANO: CutsceneStep[] = [
  { shot: 'keoni', time: 1.4 },
  { say: 'Aloha! Seeschlange, Wal und Muschel – du hast das ganze Feuermeer bezwungen!' },
  { say: 'Jetzt bist du bereit. Der alte Pfad führt hinauf in den Krater … hinunter zum Kratersee.' },
  { shot: 'volcano', time: 2.4 },
  { event: 'pathGlow' },
  { say: 'Dort wacht Peles Wächter: der Lava-Titan. Er wirft Feuer, und der See bricht unter dir auf.' },
  { say: 'Aus dem Stand kommst du nicht an ihn heran. Lass dich von den Lava-Geysiren schleudern oder spring von den Basalt-Rampen – dann trägt dich jeder Trick bis auf seinen Kopf!' },
  { shot: 'keoni', time: 1.2 },
  { say: 'Ich spiel dir ein Lied für unterwegs. Malama pono – pass auf dich auf!' },
  { event: 'enterCrater' },
];

/** Erneuter Versuch über Keoni. */
export const KEONI_CRATER_AGAIN: CutsceneStep[] = [
  { shot: 'keoni', time: 1.2 },
  { say: 'Noch einmal in den Krater? Atme tief durch – und spring über die Glutwellen!' },
  { event: 'enterCrater' },
];

/** Nach dem Sieg über den Titan: die Schneegöttin kommt, das Meer friert → Kapitel 3. */
export const KEONI_FROST: CutsceneStep[] = [
  { shot: 'keoni', time: 1.4 },
  { say: 'Aloha, Held des Kraters! Du hast Pele besänftigt – der Vulkan schläft tief und fest.' },
  { say: 'Aber … spürst du das? Mein Atem dampft. Auf Hawaii! Das ist nicht normal …' },
  { shot: 'volcano', time: 2.6 },
  { event: 'frost' },
  { wait: 2.2 },
  { say: 'Poliʻahu! Die Schneegöttin vom Mauna Kea. Seit Urzeiten streitet sie mit Pele.' },
  { say: 'Jetzt, wo Pele schläft, legt sie ihren Mantel aus Schnee über die ganze Insel …' },
  { shot: 'sea', time: 2.8 },
  { wait: 2.6 },
  { shot: 'keoni', time: 1.6 },
  { say: 'Das Meer friert zu! Eisberge treiben heran – die schönsten Rampen, die du je gesehen hast. Und schau: Pinguine!' },
  { say: 'Aber Vorsicht: Eisbären auf den Schollen, Seeleoparden unter dem Eis und Narwale mit Hörnern wie Speere.' },
  { say: 'Hier, drei Frost-Tricks für dich. Und zieh dir was Warmes an! Malama pono!' },
  { event: 'chapter3' },
];

/** Kapitel 3: kurzer Gruß und Tipps. */
export const KEONI_ICE: CutsceneStep[] = [
  { shot: 'keoni', time: 1.2 },
  { say: 'Brrr! Aloha! Die Pinguine ziehen dich mit, wenn du dich hinter sie hängst – fast so schnell wie die Delfine.' },
  { say: 'Die Frostnova friert Monster kurz ein. Eingefroren nehmen sie mehr Schaden – nutz das!' },
];

/** Nach dem Sieg über den Titan, aber vor Kapitel 3 schon gesehen (z. B. alter Spielstand). */
export const KEONI_AFTER: CutsceneStep[] = [
  { shot: 'keoni', time: 1.2 },
  { say: 'Du hast Pele besänftigt! Die ganze Insel erzählt davon. Das Obsidian-Brett steht dir gut!' },
  { say: 'Komm vorbei, wann immer du willst – die Wellen hier gehören jetzt dir.' },
];

/** Sieg im Kratersee: Pele spricht, die Lava kühlt ab. */
export const PELE_END: CutsceneStep[] = [
  { shot: 'titan', time: 2.2 },
  { wait: 1.6 },
  { say: 'Kleiner Wellenreiter …', who: 'Pele' },
  { say: 'Du hast meinen Wächter besiegt. Seit tausend Jahren hat das niemand gewagt.', who: 'Pele' },
  { shot: 'craterSky', time: 3 },
  { event: 'calm' },
  { say: 'Das Feuer in meinem Herzen schläft wieder. Nimm dieses Brett aus Obsidian – geschmiedet in meinem Krater.', who: 'Pele' },
  { say: 'Doch wenn ich schlafe, erwacht meine alte Rivalin im Norden … Sprich mit Keoni. Und nun: reite die Wellen!', who: 'Pele' },
  { event: 'chapterEnd' },
];
