/**
 * Tutorial: der erste Run mit Anleitung. Jeder Schritt = eine Aktion; weiter geht es erst,
 * wenn sie geschafft ist (Bedingungen in story/Tutorial.ts). Texte kurz halten – eine Zeile.
 */
import type { TutorialStepDef } from './types';

export const TUTORIAL_STEPS: readonly TutorialStepDef[] = [
  {
    id: 'paddle',
    text: 'Halt W gedrückt – paddeln!',
    textTouch: 'Linken Daumen nach oben schieben – paddeln!',
    keys: ['W'],
    gesture: 'paddle',
    praise: 'Gut so!',
  },
  {
    id: 'steer',
    text: 'Lenk mit A und D durch die Perlen!',
    textTouch: 'Daumen nach links und rechts – lenk durch die Perlen!',
    keys: ['A', 'D'],
    gesture: 'steer',
    praise: 'Perlen gesammelt!',
  },
  {
    id: 'wave',
    text: 'Welle kommt! Steht oben „JETZT PADDELN“ – W drücken!',
    textTouch: 'Welle kommt! Steht oben „JETZT PADDELN“ – Daumen nach oben!',
    keys: ['W'],
    gesture: 'paddle',
    focus: 'wave',
    praise: 'Welle erwischt!',
  },
  {
    id: 'jump',
    text: 'Du stehst! Jetzt springen!',
    textTouch: 'Du stehst! Rechts nach oben wischen – springen!',
    keys: ['Leertaste'],
    gesture: 'swipe',
    praise: 'Hoch hinaus!',
  },
  {
    id: 'draw',
    text: 'Die Zeit steht still – zeichne!',
    draw: { symbol: 'circle', trace: true, hint: 'Fahr den Kreis mit der Maus nach!', hintTouch: 'Fahr den Kreis mit dem Finger nach!' },
    praise: 'Salto! Stark!',
  },
  {
    id: 'spiral',
    text: 'Spring nochmal – und zeichne die Spirale!',
    textTouch: 'Wisch nach oben – und zeichne die Spirale!',
    keys: ['Leertaste'],
    gesture: 'swipe',
    draw: { symbol: 'spiral', trace: false, hint: 'Spirale! Rechts im Raster steht, wie sie aussieht.' },
    praise: 'Board-Wirbel!',
  },
  {
    id: 'dodge',
    text: 'Ein Kraken! Roter Kreis = gleich schlägt er zu. Weich aus!',
    textTouch: 'Ein Kraken! Roter Kreis = gleich schlägt er zu. Weich aus!',
    keys: ['A', 'D'],
    gesture: 'steer',
    praise: 'Ausgewichen!',
  },
  {
    id: 'fight',
    text: 'Fahr hin, spring und zeichne den Kreis – Salto auf seinen Kopf!',
    textTouch: 'Fahr hin, wisch nach oben und zeichne den Kreis – Salto auf seinen Kopf!',
    keys: ['Leertaste'],
    gesture: 'swipe',
    praise: 'Kraken besiegt!',
  },
];
