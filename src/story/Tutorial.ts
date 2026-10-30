/**
 * Tutorial-Ablauf: der erste Run mit Anleitung (Schritte in data/tutorial.ts).
 * Jeder Schritt wartet auf eine Aktion des Spielers (Ereignisse über den Bus, Tempo usw.),
 * lobt kurz und geht dann weiter. Was „Perlenspur legen“, „Welle rufen“ oder „Kraken
 * auftauchen lassen“ konkret bedeutet, entscheidet der Host (core/Game.ts) – so bleibt
 * der Ablauf ohne Browser testbar.
 */
import { CONFIG } from '../config/gameConfig';
import type { GameEventBus } from '../core/events';
import { TUTORIAL_STEPS } from '../data/tutorial';
import type { TutorialStepDef } from '../data/types';

/** Geführtes Zeichnen (siehe TrickSystem.setGuide). */
export interface DrawGuide {
  /** Gesuchtes Symbol */
  symbol: string;
  /** Vorlage gestrichelt anzeigen (zum Nachfahren) */
  trace: boolean;
  /** Hinweis im Zeichenfenster */
  hint: string;
}

/** Was das Tutorial über den Surfer wissen muss. */
export interface TutorialSurferView {
  speed: number;
  standing: boolean;
  airborne: boolean;
  /** Eine Welle ist im Anmarsch (Wellen-Anzeige sichtbar) */
  waveNear: boolean;
  riding: boolean;
}

export interface TutorialHost {
  readonly isTouch: boolean;
  surfer(): TutorialSurferView;
  /** Schritt anzeigen (Coach: Text, Tasten/Geste, Fortschritt, HUD-Hervorhebung) */
  showStep(step: TutorialStepDef, index: number, total: number, text: string): void;
  /** Anweisung des laufenden Schritts ändern */
  setText(text: string): void;
  /** Schritt geschafft: Haken, Lob, Ton */
  praise(text: string): void;
  /** Perlenspur vor dem Spieler (zum Lenken) */
  pearlTrail(): void;
  /** Welle rufen, die den Spieler gleich erreicht */
  callWave(): void;
  /** Höhere Sprünge an/aus */
  setJumpBonus(on: boolean): void;
  /** Nächstes Zeichenfenster geführt (oder wieder normal) */
  guideDrawing(guide: DrawGuide | null): void;
  /** Trainings-Kraken vor dem Spieler auftauchen lassen */
  spawnKraken(): void;
  /** Lebt der Trainings-Kraken noch (bzw. taucht er gerade auf)? */
  krakenAlive(): boolean;
  /** Tutorial vorbei (geschafft oder übersprungen) */
  finish(skipped: boolean): void;
}

export class Tutorial {
  private index = -1;
  /** Pause nach dem Lob (echte s); danach nächster Schritt */
  private pause = -1;
  private timer = 0;
  private counter = 0;
  private waveTimer = -1;
  private noWave = 0;
  private finished = false;
  /** Ein Hinweis (z. B. „Mehr Tempo“) bleibt so lange stehen (echte s) */
  private hold = 0;
  private readonly offs: (() => void)[] = [];

  constructor(
    private readonly bus: GameEventBus,
    private readonly host: TutorialHost,
    readonly steps: readonly TutorialStepDef[] = TUTORIAL_STEPS,
  ) {
    const is = (id: TutorialStepDef['id']) => this.step?.id === id && this.pause < 0;
    this.offs.push(
      bus.on('pearlCollected', () => {
        if (is('steer')) this.counter++;
      }),
      bus.on('waveCaught', () => {
        if (is('wave')) this.complete();
      }),
      bus.on('drawingStarted', () => {
        // Sprung mit Zeichenfenster → gleich weiter zum Zeichnen (ohne Lob-Pause)
        if (is('jump')) this.next();
      }),
      bus.on('landed', () => {
        if (is('jump')) this.say(this.host.isTouch ? 'Zu kurz! Mehr Tempo – dann nochmal nach oben wischen!' : 'Zu kurz! Mehr Tempo – dann nochmal springen!', 2.5);
        // Zeichnen ohne Trick beendet (sollte im geführten Modus nicht vorkommen): nochmal springen
        if (is('draw')) this.goTo(this.index - 1);
      }),
      bus.on('trickLanded', (e) => {
        const want = this.step?.draw?.symbol;
        if (!want || this.pause >= 0) return;
        const trick = e.trickId;
        if ((is('draw') && trick === 'salto') || (is('spiral') && trick === 'board_spin')) this.complete();
      }),
      bus.on('monsterAttack', (e) => {
        if (is('dodge') && e.monsterId === 'kraken' && e.kind === 'tentacle') {
          this.complete(e.hit ? (this.host.isTouch ? 'Autsch! Nächstes Mal: Daumen zur Seite, raus aus dem Kreis.' : 'Autsch! Nächstes Mal: raus aus dem roten Kreis.') : undefined);
        }
      }),
      bus.on('monsterDefeated', (e) => {
        if (e.monsterId === 'kraken' && this.step && (this.step.id === 'fight' || this.step.id === 'dodge') && this.pause < 0) {
          // Auch wer ihn schon beim Ausweichen besiegt, ist fertig
          this.index = this.steps.findIndex((s) => s.id === 'fight');
          this.complete();
        }
      }),
    );
  }

  get active(): boolean {
    return this.index >= 0 && !this.finished;
  }

  get step(): TutorialStepDef | null {
    return this.active ? (this.steps[this.index] ?? null) : null;
  }

  get stepIndex(): number {
    return this.index;
  }

  start(): void {
    this.goTo(0);
  }

  /** Überspringen: sofort normales Spiel. */
  skip(): void {
    if (!this.active) return;
    this.end(true);
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }

  /** realDt = echte Sekunden (Pausen, Wiederholungen), unabhängig von der Zeitlupe. */
  update(realDt: number): void {
    const step = this.step;
    if (!step) return;
    if (this.pause >= 0) {
      this.pause -= realDt;
      if (this.pause < 0) this.next();
      return;
    }
    const T = CONFIG.tutorial;
    const s = this.host.surfer();
    this.timer += realDt;
    this.hold = Math.max(0, this.hold - realDt);
    switch (step.id) {
      case 'paddle':
        if (s.speed >= T.paddleSpeed) this.complete();
        break;
      case 'steer':
        if (this.counter >= T.pearls) this.complete();
        else if (this.timer > T.trailRetry) {
          this.timer = 0;
          this.host.pearlTrail();
        }
        break;
      case 'wave':
        this.watchWaves(realDt, s);
        break;
      case 'jump':
      case 'spiral':
        // Erst stehen, dann springen (Text passt sich an)
        if (!s.airborne && this.hold <= 0) this.host.setText(s.standing ? this.text(step) : this.host.isTouch ? 'Daumen nach oben – paddeln, bis du stehst!' : 'W halten – paddeln, bis du stehst!');
        break;
      case 'dodge':
      case 'fight':
        if (!this.host.krakenAlive()) this.host.spawnKraken();
        break;
    }
  }

  /** Welle rufen und neu rufen, wenn keine mehr in Sicht ist. */
  private watchWaves(realDt: number, s: TutorialSurferView): void {
    const T = CONFIG.tutorial;
    if (this.waveTimer > 0) {
      this.waveTimer -= realDt;
      if (this.waveTimer <= 0) this.host.callWave();
      return;
    }
    this.noWave = s.waveNear || s.riding ? 0 : this.noWave + realDt;
    if (this.noWave > T.waveRetry) {
      this.noWave = 0;
      this.say('Noch eine Welle! Bei „JETZT PADDELN“ – los!', 3);
      this.host.callWave();
    }
  }

  /** Hinweis zeigen und eine Weile stehen lassen. */
  private say(text: string, hold: number): void {
    this.hold = hold;
    this.host.setText(text);
  }

  private text(step: TutorialStepDef): string {
    return this.host.isTouch ? (step.textTouch ?? step.text) : step.text;
  }

  private complete(praise?: string): void {
    const step = this.step;
    if (!step || this.pause >= 0) return;
    this.host.praise(praise ?? step.praise);
    this.bus.emit('tutorialStep', { stepId: step.id, index: this.index, done: true });
    this.pause = CONFIG.tutorial.stepPause;
  }

  private next(): void {
    this.pause = -1;
    if (this.index + 1 >= this.steps.length) this.end(false);
    else this.goTo(this.index + 1);
  }

  private goTo(i: number): void {
    this.index = i;
    this.pause = -1;
    this.timer = 0;
    this.counter = 0;
    this.hold = 0;
    this.noWave = 0;
    this.waveTimer = -1;
    const step = this.steps[i]!;
    const T = CONFIG.tutorial;
    this.host.showStep(step, i, this.steps.length, this.text(step));
    // Sprünge sind ab dem Sprung-Schritt höher, das Zeichenfenster ist geführt
    this.host.setJumpBonus(step.id === 'jump' || step.id === 'draw' || step.id === 'spiral' || step.id === 'fight');
    const guided = step.id === 'jump' ? this.steps.find((s) => s.id === 'draw')?.draw : step.draw;
    this.host.guideDrawing(guided ? { symbol: guided.symbol, trace: guided.trace, hint: this.host.isTouch ? (guided.hintTouch ?? guided.hint) : guided.hint } : null);
    if (step.id === 'steer') this.host.pearlTrail();
    if (step.id === 'wave') this.waveTimer = T.wave.delay;
    if (step.id === 'dodge' && !this.host.krakenAlive()) this.host.spawnKraken();
    this.bus.emit('tutorialStep', { stepId: step.id, index: i, done: false });
  }

  private end(skipped: boolean): void {
    this.finished = true;
    this.host.setJumpBonus(false);
    this.host.guideDrawing(null);
    this.bus.emit('tutorialEnded', { skipped, stepIndex: this.index });
    this.host.finish(skipped);
  }
}
