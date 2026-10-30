/**
 * Trick-System: Beim Absprung öffnet sich das Zeichenfenster (Zeitlupe), der Strich wird
 * offline erkannt ($1), die Genauigkeit bestimmt die Qualität, der passende Trick aus dem
 * Register wird ausgeführt und trifft Monster im Trefferbereich.
 */
import { CONFIG } from '../config/gameConfig';
import type { GameEventBus } from '../core/events';
import type { SaveData } from '../core/SaveGame';
import type { TimeController } from '../core/TimeController';
import type { ContentRegistries } from '../data';
import type { TrickDef, TrickQuality } from '../data/types';
import type { Effects } from '../fx/Effects';
import type { DrawSurface } from '../input/DrawSurface';
import type { InputManager, StrokePoint } from '../input/InputManager';
import type { Monster } from '../monsters/Monster';
import type { MonsterSystem } from '../monsters/MonsterSystem';
import { isUnlocked, type PlayerStats } from '../player/Progression';
import type { Surfer } from '../player/Surfer';
import type { TrickTarget } from '../ui/DrawingPanel';
import type { UI } from '../ui/UI';
import { DollarOneRecognizer } from './recognizer/DollarOne';

export function qualityFor(accuracy: number): TrickQuality | null {
  const q = CONFIG.trick.quality;
  if (accuracy >= q.perfect) return 'perfect';
  if (accuracy >= q.good) return 'good';
  if (accuracy >= q.okay) return 'okay';
  return null;
}

export class TrickSystem {
  readonly recognizer = new DollarOneRecognizer();
  private readonly trickBySymbol = new Map<string, TrickDef>();
  private drawing = false;
  private resolved = false;
  private hits = 0;
  /** Strich, der beim Ablauf der Zeit noch lief – wird im nächsten Frame ausgewertet */
  private pending: StrokePoint[] | null = null;
  lastStroke: readonly StrokePoint[] = [];
  private hintKey = '';

  constructor(
    private readonly bus: GameEventBus,
    private readonly content: ContentRegistries,
    input: InputManager,
    private readonly surface: DrawSurface,
    private readonly ui: UI,
    private readonly time: TimeController,
    private readonly surfer: Surfer,
    private readonly monsters: MonsterSystem,
    private readonly effects: Effects,
    private readonly getSave: () => SaveData,
    private readonly getStats: () => PlayerStats,
    private readonly debug: boolean,
  ) {
    for (const sym of content.symbols.all()) {
      for (const t of sym.templates) this.recognizer.addTemplate(sym.id, t);
    }
    for (const trick of content.tricks.all()) {
      for (const sym of trick.symbols) this.trickBySymbol.set(sym, trick);
    }
    this.refreshHints();

    bus.on('drawingStarted', (e) => this.open(e.duration));
    bus.on('drawingEnded', () => this.onDrawingEnded());
    bus.on('landed', () => this.completeTrick());
    // Trick in der Luft fertig (großer Sprung) → zählt sofort, nächster Trick möglich
    bus.on('surferStateChanged', (e) => {
      if (e.from === 'TrickPerforming' && e.to === 'Airborne') this.completeTrick();
    });
    input.onStroke({
      move: (_p, points) => {
        if (this.drawing) this.ui.drawing.drawStroke(points);
      },
      end: (points) => this.onStrokeEnd(points),
    });
  }

  /** Symbol-Hinweise im Zeichenfenster; Tricks späterer Kapitel erscheinen erst, wenn freigeschaltet. */
  private refreshHints(): void {
    const hints = this.content.symbols
      .all()
      .filter((s) => this.trickBySymbol.has(s.id))
      .map((s) => {
        const trick = this.trickBySymbol.get(s.id)!;
        return { symbol: s, trickName: trick.name, color: trick.color, locked: !this.isTrickUnlocked(trick), later: trick.unlock.type === 'chapter' };
      })
      .filter((h) => !(h.locked && h.later));
    const key = hints.map((h) => `${h.symbol.id}${h.locked ? '-' : '+'}`).join();
    if (key === this.hintKey) return;
    this.hintKey = key;
    this.ui.drawing.setSymbols(hints);
  }

  isTrickUnlocked(trick: TrickDef): boolean {
    return isUnlocked(trick.unlock, this.getSave(), this.getSave().unlocked.tricks, trick.id);
  }

  reset(): void {
    this.drawing = false;
    this.resolved = false;
    this.pending = null;
    this.surface.enabled = false;
    this.surface.cancel();
    this.ui.drawing.close();
    this.time.setScale(1, 0);
  }

  private open(duration: number): void {
    this.refreshHints();
    this.ui.drawing.setTarget(this.nearbyTarget());
    this.drawing = true;
    this.resolved = false;
    this.surface.enabled = true;
    this.ui.drawing.open(duration);
    // Zeitlupe so wählen, dass die Zeichenzeit genau zur Flugbahn passt
    const scale = Math.max(0.03, Math.min(1, this.surfer.drawGameTime / duration));
    this.time.setScale(scale, CONFIG.trick.timeRamp);
  }

  private onStrokeEnd(points: readonly StrokePoint[]): void {
    if (!this.drawing || this.resolved) return;
    this.lastStroke = points;
    if (this.debug) {
      console.info('[Trick] Strich (für eigene Symbol-Vorlagen):', JSON.stringify(points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))));
    }
    this.resolve(points);
  }

  /** Strich auswerten und Trick starten (oder Fehlversuch melden). */
  private resolve(points: readonly StrokePoint[]): void {
    this.resolved = true;
    this.surface.enabled = false;
    const res = this.recognizer.recognize(points);
    const quality = res.symbolId ? qualityFor(res.score) : null;
    const trick = res.symbolId ? this.trickBySymbol.get(res.symbolId) : undefined;
    if (this.debug) console.info('[Trick] Erkennung:', res.ranking.map((r) => `${r.symbolId} ${r.score.toFixed(3)}`).join(' | '));

    if (!trick || !quality) {
      this.fail(points.length < 5 ? 'noStroke' : 'unknown', res.score);
      return;
    }
    if (!this.isTrickUnlocked(trick)) {
      this.fail('locked', res.score);
      return;
    }

    const travel = trick.travel;
    const target =
      travel?.homingTag !== undefined
        ? this.monsters.findTarget(travel.homingTag, this.surfer.x, this.surfer.z, this.surfer.forwardX, this.surfer.forwardZ, travel.maxDistance ?? 16, 70)
        : null;
    // In der Nähe eines Bosses springt jeder Trick auf seinen Kopf
    const head = this.bossHead();
    const started = head ? this.surfer.startBossTrick(trick, quality, res.score, head) : this.surfer.startTrick(trick, quality, res.score, target);
    if (!started) {
      this.fail('timeout', res.score);
      return;
    }
    this.hits = 0;
    this.drawing = false;
    this.ui.drawing.setStrokeColor('#ffffff');
    this.ui.drawing.close({ symbolId: res.symbolId });
    this.time.setScale(1, CONFIG.trick.timeRamp);
    this.bus.emit('trickRecognized', { trickId: trick.id, symbolId: res.symbolId!, accuracy: res.score, quality });
    this.ui.feedback.trick(trick.name, CONFIG.trick.qualityLabel[quality], trick.color, quality);
  }

  /** Nächstes Monster für die Anzeige im Zeichenfenster; Schwächen nur, wenn schon einmal besiegt. */
  private nearbyTarget(): TrickTarget | null {
    const s = this.surfer;
    let best: Monster | null = null;
    let bestD = CONFIG.hud.targetHintRange;
    for (const m of this.monsters.monsters) {
      if (!m.isTargetable) continue;
      const d = Math.hypot(m.x - s.x, m.z - s.z);
      if (d < bestD) {
        best = m;
        bestD = d;
      }
    }
    const boss = this.monsters.boss;
    if (boss?.isTargetable && Math.hypot(boss.x - s.x, boss.z - s.z) <= (boss.def.behaviorParams?.trickRange ?? CONFIG.boss.trickRange)) best = boss;
    if (!best) return null;
    const known = (this.getSave().bestiary[best.def.id]?.defeated ?? 0) > 0;
    const multipliers = new Map<string, number>();
    if (known) {
      for (const [symbolId, trick] of this.trickBySymbol) {
        const ws = best.def.weaknesses.filter((w) => w.trick === trick.id).map((w) => w.multiplier);
        if (!ws.length) continue;
        const up = Math.max(...ws);
        multipliers.set(symbolId, up > 1 ? up : Math.min(...ws));
      }
    }
    return { name: best.def.name, multipliers, unknown: !known && best.def.weaknesses.length > 0 };
  }

  /** Kopf eines Bosses in Reichweite (oder null). */
  private bossHead(): { x: number; y: number; z: number } | null {
    const boss = this.monsters.boss;
    if (!boss || !boss.isTargetable) return null;
    const s = this.surfer;
    const range = boss.def.behaviorParams?.trickRange ?? CONFIG.boss.trickRange;
    if (Math.hypot(boss.x - s.x, boss.z - s.z) > range) return null;
    // Manche Bosse (Titan) erreicht man nur aus großen Sprüngen (Geysir, Rampe, Abprall)
    const minAir = boss.def.behaviorParams?.minAirtime ?? 0;
    if (s.airtime < minAir) {
      this.ui.feedback.toast('Zu niedrig für seinen Kopf – nimm einen Geysir oder eine Rampe!', 'warn', 3000);
      return null;
    }
    return boss.bounceTarget(this.monsters.waterAt(boss.x, boss.z));
  }

  private fail(reason: 'noStroke' | 'unknown' | 'timeout' | 'locked', accuracy: number): void {
    this.drawing = false;
    this.surface.enabled = false;
    this.ui.drawing.close({ symbolId: null });
    this.time.setScale(1, CONFIG.trick.timeRamp);
    this.bus.emit('trickFailed', { reason, accuracy });
    const msg = { noStroke: 'Kein Symbol', unknown: 'Symbol nicht erkannt', timeout: 'Zu spät!', locked: 'Trick noch gesperrt' }[reason];
    this.ui.feedback.toast(msg, 'warn', 0);
    // Zurück in den normalen Flug (Drawing → Airborne)
    if (this.surfer.fsm.is('Drawing')) this.surfer.fsm.transition('Airborne');
  }

  /** Zeit abgelaufen oder gelandet: laufenden Strich noch auswerten, sonst schließen. */
  private onDrawingEnded(): void {
    if (!this.drawing || this.resolved) return;
    if (this.surface.isDrawing) {
      const pts = this.surface.currentPoints.slice();
      this.surface.cancel();
      if (pts.length >= 5) {
        // Nicht mitten im Zustandswechsel auswerten → nächster Frame
        this.pending = pts;
        return;
      }
    }
    this.resolved = true;
    this.drawing = false;
    this.surface.enabled = false;
    this.surface.cancel();
    this.ui.drawing.close({ symbolId: null });
    this.time.setScale(1, CONFIG.trick.timeRamp);
    this.bus.emit('trickFailed', { reason: 'timeout', accuracy: 0 });
    this.ui.feedback.toast('Zu langsam!', 'warn', 0);
  }

  private completeTrick(): void {
    const trick = this.surfer.trick;
    if (!trick) return;
    this.applyHitIfDue(true);
    this.surfer.trick = null;
    this.bus.emit('trickLanded', { trickId: trick.def.id, quality: trick.quality, hits: this.hits, chain: this.surfer.trickChain });
    if (this.surfer.trickChain > 1) this.ui.feedback.stamp(`LUFT-KOMBO ×${this.surfer.trickChain}`, '#ff8ad8');
  }

  /** Trifft Monster, sobald der Trick seinen Trefferzeitpunkt erreicht. */
  private applyHitIfDue(force = false): void {
    const trick = this.surfer.trick;
    if (!trick || trick.hitDone) return;
    if (!force && this.surfer.trickProgress < trick.def.hitTime) return;
    trick.hitDone = true;
    const mul = CONFIG.trick.qualityMultiplier[trick.quality] * this.getStats().get('trickDamage');
    this.hits = this.monsters.applyTrickHit(trick.def, mul, this.surfer.x, this.surfer.y, this.surfer.z, this.surfer.forwardX, this.surfer.forwardZ);
    if (this.hits > 0) this.time.hitStop(CONFIG.combat.hitStop);
    // Sichtbarer Wirkungsbereich (auch ohne Monster)
    const area = trick.def.hitArea;
    const r = area.shape === 'circle' ? area.radius : area.range * 0.5;
    const cx = area.shape === 'circle' ? this.surfer.x : this.surfer.x + this.surfer.forwardX * r;
    const cz = area.shape === 'circle' ? this.surfer.z : this.surfer.z + this.surfer.forwardZ * r;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.effects.particles.emit({
        position: { x: cx + Math.cos(a) * r * 0.6, y: this.surfer.y + 0.5, z: cz + Math.sin(a) * r * 0.6 },
        count: 2,
        spread: 1.5,
        up: 1.5,
        life: [0.3, 0.6],
        size: [0.3, 0.6],
        color: trick.def.color,
        gravity: 4,
        drag: 2,
      });
    }
  }

  update(_dt: number, realDt: number): void {
    this.ui.drawing.tick(realDt);
    if (this.pending) {
      const pts = this.pending;
      this.pending = null;
      this.resolve(pts);
    }
    // Kopfsprung auf einen Boss trifft erst bei der Ankunft auf dem Kopf (siehe completeTrick)
    if (this.surfer.fsm.is('TrickPerforming') && !this.surfer.bossBounce) this.applyHitIfDue();
  }
}
