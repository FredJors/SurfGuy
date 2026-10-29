/**
 * Spielt eine Szene aus Schritten ab: Dialogzeilen, Kameraeinstellungen, Pausen und Ereignisse
 * (z. B. Vulkanausbruch). Die Inhalte stehen als Daten in data/story.ts; was eine
 * Kameraeinstellung oder ein Ereignis bedeutet, entscheidet der Host (Game).
 */
import type { DialogBox } from '../ui/Dialog';

export type CutsceneStep =
  /** Dialogzeile (wartet auf Weiterklicken) */
  | { readonly say: string; readonly who?: string }
  /** Kamera fährt zu einer benannten Einstellung (läuft im Hintergrund weiter) */
  | { readonly shot: string; readonly time?: number }
  | { readonly wait: number }
  /** Ereignis beim Host; dessen Rückgabe = Wartezeit in Sekunden */
  | { readonly event: string };

export interface CutsceneHost {
  readonly dialog: DialogBox;
  shot(name: string, time: number): void;
  event(name: string): number;
}

export class Cutscene {
  private index = -1;
  private waitLeft = 0;
  private waitingForClick = false;
  done = false;

  constructor(
    private readonly steps: readonly CutsceneStep[],
    private readonly host: CutsceneHost,
    private readonly defaultSpeaker: string,
    private readonly onDone: () => void,
  ) {
    this.next();
  }

  private next(): void {
    this.index++;
    const step = this.steps[this.index];
    if (!step) {
      this.host.dialog.hide();
      this.done = true;
      this.onDone();
      return;
    }
    if ('say' in step) {
      this.waitingForClick = true;
      this.host.dialog.show({ who: step.who ?? this.defaultSpeaker, text: step.say }, () => {
        this.waitingForClick = false;
        this.next();
      });
    } else if ('shot' in step) {
      this.host.shot(step.shot, step.time ?? 1.5);
      this.next();
    } else if ('wait' in step) {
      this.host.dialog.hide();
      this.waitLeft = step.wait;
    } else {
      this.host.dialog.hide();
      this.waitLeft = this.host.event(step.event);
      if (this.waitLeft <= 0) this.next();
    }
  }

  /** Echte Sekunden (läuft auch während Zeitlupe gleichmäßig). */
  update(realDt: number): void {
    if (this.done || this.waitingForClick) return;
    if (this.waitLeft > 0) {
      this.waitLeft -= realDt;
      if (this.waitLeft <= 0) this.next();
    }
  }
}
