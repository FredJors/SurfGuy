/**
 * Spieltest-Bot (nur mit `?bot`): spielt das echte Spiel im Zeitraffer – ohne Rendern, mit
 * denselben Systemen wie ein Mensch. Er steuert über die Eingabe-Schnittstelle (Tempo, Lenken,
 * Springen) und zeichnet Symbole als Striche. Dabei zählt er mit, was passiert, und meldet
 * Auffälligkeiten: Fehler, Hänger (steckt fest), ungültige Positionen, Todesursachen.
 *
 * Aufruf in der Konsole: `await surfguyBot.runMany({ runs: 3, seconds: 240, mode: 'sea' })`
 */
import { wrapAngle } from '../core/math';
import type { Game } from '../core/Game';
import type { GameEvents } from '../core/events';
import type { MonsterDef, TrickDef } from '../data/types';
import type { StrokePoint } from '../input/InputManager';
import type { Monster } from '../monsters/Monster';
import { CONFIG } from '../config/gameConfig';

export interface BotOptions {
  runs: number;
  /** Spielzeit je Run (s) */
  seconds: number;
  mode: 'sea' | 'crater' | 'glacier';
  /** Bildrate der Simulation (Hz) */
  hz?: number;
}

export interface BotRunReport {
  mode: 'sea' | 'crater' | 'glacier';
  seconds: number;
  endedBy: 'gameover' | 'time' | 'victory' | 'error';
  heartsLeft: number;
  score: number;
  pearls: number;
  chests: number;
  spawned: Record<string, number>;
  defeated: Record<string, number>;
  escaped: number;
  hitsBy: Record<string, number>;
  tricks: { recognized: number; failed: number; landed: number; byTrick: Record<string, number>; failReasons: Record<string, number> };
  jumps: number;
  launches: Record<string, number>;
  maxAirtime: number;
  missionsCompleted: number;
  bossHpLeft: number | null;
  stuck: { t: number; x: number; z: number; state: string }[];
  anomalies: string[];
  /** Tutorial: geschaffte Schritte mit Zeitpunkt (s) und Ende (null = nicht beendet / keins) */
  tutorial: { steps: string[]; endedAt: number | null; skipped: boolean } | null;
}

interface GameInternals {
  update(dt: number, realDt: number): void;
  beginRun(mode: 'sea' | 'crater' | 'glacier'): void;
  endRun(showScreen: boolean): unknown;
  goHome(): void;
  gameOverTimer: number;
  phase: string;
  run: { hearts: number; maxHearts: number; score: number; pearls: number; chests: number } | null;
  cutscene: unknown;
  arenaOutroTimer: number;
  renderer: { setAnimationLoop(cb: (() => void) | null): void };
  frame(): void;
}


export class Bot {
  private report!: BotRunReport;
  private strokeAt = -1;
  private jumpCooldown = 0;
  private orbitDir = 1;
  private lowSpeedTime = 0;
  private t = 0;
  private victory = false;
  private targetMonster: Monster | null = null;
  /** Wartezeit auf einem Geysir (s) */
  private geyserWait = 0;
  private geyserId = -1;
  /** Ausweichen aktiv (Richtung) */
  private evade: number | null = null;

  constructor(private readonly game: Game) {}

  private get g(): GameInternals {
    return this.game as unknown as GameInternals;
  }

  /** Mehrere Runs nacheinander; gibt die Berichte zurück (auch als BOT_REPORT in der Konsole). */
  async runMany(opts: BotOptions): Promise<BotRunReport[]> {
    const out: BotRunReport[] = [];
    const g = this.g;
    g.renderer.setAnimationLoop(null);
    for (let i = 0; i < opts.runs; i++) {
      out.push(await this.runOnce(opts, i));
      // Fenster/Overlays eines Runs wegräumen
      document.querySelectorAll('.overlay').forEach((o) => o.remove());
    }
    this.game.goHome();
    g.renderer.setAnimationLoop(() => g.frame());
    console.info('BOT_REPORT ' + JSON.stringify(out));
    return out;
  }

  private async runOnce(opts: BotOptions, index: number): Promise<BotRunReport> {
    const g = this.g;
    const game = this.game;
    this.report = {
      mode: opts.mode,
      seconds: 0,
      endedBy: 'time',
      heartsLeft: 0,
      score: 0,
      pearls: 0,
      chests: 0,
      spawned: {},
      defeated: {},
      escaped: 0,
      hitsBy: {},
      tricks: { recognized: 0, failed: 0, landed: 0, byTrick: {}, failReasons: {} },
      jumps: 0,
      launches: {},
      maxAirtime: 0,
      missionsCompleted: 0,
      bossHpLeft: null,
      stuck: [],
      anomalies: [],
      tutorial: null,
    };
    this.t = 0;
    this.victory = false;
    this.lowSpeedTime = 0;
    this.orbitDir = index % 2 === 0 ? 1 : -1;
    const R = this.report;
    const inc = (m: Record<string, number>, k: string) => (m[k] = (m[k] ?? 0) + 1);
    const bus = game.bus;
    const offs = [
      bus.on('monsterSpawned', (e) => inc(R.spawned, `${e.monsterId}:${e.tier}`)),
      bus.on('monsterDefeated', (e) => inc(R.defeated, `${e.monsterId}:${e.tier}`)),
      bus.on('monsterEscaped', () => R.escaped++),
      bus.on('playerHit', (e) => inc(R.hitsBy, e.source)),
      bus.on('trickRecognized', (e) => {
        R.tricks.recognized++;
        inc(R.tricks.byTrick, e.trickId);
      }),
      bus.on('trickFailed', (e) => {
        R.tricks.failed++;
        inc(R.tricks.failReasons, e.reason);
      }),
      bus.on('trickLanded', () => R.tricks.landed++),
      bus.on('jump', () => R.jumps++),
      bus.on('launched', (e) => inc(R.launches, e.source)),
      bus.on('landed', (e) => (R.maxAirtime = Math.max(R.maxAirtime, e.airtime))),
      bus.on('tutorialStep', (e) => {
        R.tutorial ??= { steps: [], endedAt: null, skipped: false };
        if (e.done) R.tutorial.steps.push(`${e.stepId}@${Math.round(this.t)}`);
      }),
      bus.on('tutorialEnded', (e) => {
        R.tutorial ??= { steps: [], endedAt: null, skipped: false };
        R.tutorial.endedAt = Math.round(this.t);
        R.tutorial.skipped = e.skipped;
      }),
      bus.on('bossEvent', (e: GameEvents['bossEvent']) => {
        if (e.kind === 'defeated') this.victory = true;
      }),
    ];
    const missionsBefore = game.save.missions.list.filter((m) => m.progress >= m.goal).length;

    game.goHome();
    g.beginRun(opts.mode);
    const dt0 = 1 / (opts.hz ?? 30);
    let steps = 0;
    try {
      while (this.t < opts.seconds) {
        this.think(dt0);
        const dt = game.time.update(dt0);
        g.update(dt, dt0);
        this.t += dt0;
        this.check(dt0);
        const run = g.run;
        if (!run) break;
        if (run.hearts <= 0) {
          R.endedBy = 'gameover';
          break;
        }
        if (this.victory && opts.mode !== 'sea') {
          // Arena-Endgegner besiegt: Szene der Göttin überspringen
          R.endedBy = 'victory';
          g.arenaOutroTimer = -1;
          break;
        }
        if (this.victory && opts.mode === 'sea') {
          R.endedBy = 'victory';
          // Krabbe besiegt: weiterspielen bis zur Zeit
          this.victory = false;
        }
        if (++steps % 400 === 0) await new Promise((r) => setTimeout(r, 0));
      }
    } catch (err) {
      R.endedBy = 'error';
      R.anomalies.push(`Fehler: ${(err as Error)?.stack ?? String(err)}`);
    }
    const run = g.run;
    R.seconds = Math.round(this.t);
    R.heartsLeft = run?.hearts ?? 0;
    R.score = run?.score ?? 0;
    R.pearls = run?.pearls ?? 0;
    R.chests = run?.chests ?? 0;
    const boss = game.monsters.boss;
    R.bossHpLeft = boss ? Math.round((boss.hp / boss.maxHp) * 100) : null;
    R.missionsCompleted = game.save.missions.list.filter((m) => m.progress >= m.goal).length - missionsBefore;
    g.gameOverTimer = -1;
    if (g.run) g.endRun(false);
    for (const off of offs) off();
    return R;
  }

  /** Auffälligkeiten prüfen: ungültige Werte, Hänger. */
  private check(dt: number): void {
    const s = this.game.surfer;
    const R = this.report;
    if (!Number.isFinite(s.x) || !Number.isFinite(s.z) || !Number.isFinite(s.y)) {
      R.anomalies.push(`t=${this.t.toFixed(1)}: ungültige Position ${s.x},${s.y},${s.z}`);
      throw new Error('NaN-Position');
    }
    const water = this.game.world.heightAt(s.x, s.z);
    if (s.y < water - 3 || s.y > water + 120) R.anomalies.push(`t=${this.t.toFixed(1)}: Höhe ${s.y.toFixed(1)} (Wasser ${water.toFixed(1)}) in ${s.fsm.current}`);
    const cut = !!this.g.cutscene;
    const slow = s.speed < 0.6 && !s.isAirborne && !s.fsm.is('Wipeout', 'Walking') && !cut;
    this.lowSpeedTime = slow ? this.lowSpeedTime + dt : 0;
    if (this.lowSpeedTime > 6) {
      R.stuck.push({ t: Math.round(this.t), x: Math.round(s.x), z: Math.round(s.z), state: s.fsm.current ?? '' });
      this.lowSpeedTime = -30; // nicht dauernd melden
    }
    if (R.anomalies.length > 40) R.anomalies.length = 40;
  }

  // -------------------------------------------------------------------------
  // Entscheidungen
  // -------------------------------------------------------------------------

  private think(dt: number): void {
    const game = this.game;
    const s = game.surfer;
    const inp = game.input;
    inp.state.paddle = 1;
    inp.state.brake = 0;
    this.jumpCooldown -= dt;

    // Zeichenfenster offen → nach kurzer „Denkzeit“ ein Symbol zeichnen
    const tricks = game.tricks as unknown as { drawing: boolean };
    if (tricks.drawing) {
      if (this.strokeAt < 0) this.strokeAt = this.t + 0.25 + Math.random() * 0.35;
      if (this.t >= this.strokeAt) {
        this.strokeAt = -1;
        this.drawTrick();
      }
    } else this.strokeAt = -1;

    // Tutorial: den Anweisungen folgen
    const tut = game.tutorial?.step?.id;
    if (tut && this.tutorialStep(tut, dt)) return;

    this.evade = this.threatEscape();
    let heading = game.world.inCrater ? this.craterHeading(dt) : this.seaHeading();
    if (this.evade !== null) {
      heading = this.evade;
      inp.state.brake = 0;
    }
    const diff = wrapAngle(heading - s.heading);
    inp.state.steer = Math.max(-1, Math.min(1, -diff * 2.5));

    // Springen: Bedrohung (Ringwelle/Feuerstrahl/Welle von vorn) oder Monster in Reichweite
    const standing = s.fsm.is('Standing');
    if (standing && this.jumpCooldown <= 0) {
      const hint = (game as unknown as { punchOrRingHint(): { visible: boolean; inWindow: boolean } }).punchOrRingHint();
      const m = this.targetMonster;
      const mDist = m ? Math.hypot(m.x - s.x, m.z - s.z) : Infinity;
      const boss = game.monsters.boss;
      const range = boss ? (boss.def.behaviorParams?.trickRange ?? CONFIG.boss.trickRange) : 15;
      const bossDist = boss ? Math.hypot(boss.x - s.x, boss.z - s.z) : Infinity;
      const random = !game.world.inCrater && Math.random() < dt * 0.15;
      // Rammangriff (Hai, Seeschlange) kommt: drüberspringen
      const charging = game.monsters.monsters.some((x) => {
        const mode = (x as unknown as { mode?: string }).mode;
        return (mode === 'charge' || mode === 'lunge') && Math.hypot(x.x - s.x, x.z - s.z) < 9;
      });
      const wantJump = charging || (hint.visible && hint.inWindow) || (m && !m.def.boss && mDist < 14) || (boss && boss.isTargetable && bossDist < range * 0.85) || random;
      if (wantJump) {
        inp.triggerJump();
        this.jumpCooldown = 1.2;
      }
    }
  }

  /**
   * Tutorial-Schritt wie ein neuer Spieler befolgen. Gibt true zurück, wenn der Schritt die
   * Steuerung komplett übernimmt (sonst normales Verhalten, z. B. beim Kraken).
   */
  private tutorialStep(step: string, dt: number): boolean {
    const game = this.game;
    const s = game.surfer;
    const inp = game.input;
    const steerTo = (heading: number) => {
      inp.state.steer = Math.max(-1, Math.min(1, -wrapAngle(heading - s.heading) * 2.5));
    };
    const [ix, iz] = CONFIG.world.islandPosition;
    switch (step) {
      case 'paddle':
        inp.state.steer = 0;
        return true;
      case 'steer': {
        // nächste Perle voraus ansteuern
        let best: { x: number; z: number } | null = null;
        let bestD = Infinity;
        for (const p of [...game.pickups.positions('pearl'), ...game.pickups.positions('gold')]) {
          const d = Math.hypot(p.x - s.x, p.z - s.z);
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }
        if (best) steerTo(Math.atan2(best.x - s.x, best.z - s.z));
        return true;
      }
      case 'wave':
        // Zur Insel ausrichten (Welle kommt von hinten) und paddeln
        steerTo(Math.atan2(ix - s.x, iz - s.z));
        return true;
      case 'jump':
      case 'spiral':
        inp.state.steer = 0;
        if (s.fsm.is('Standing') && this.jumpCooldown <= 0) {
          inp.triggerJump();
          this.jumpCooldown = 1.2;
        }
        return true;
      case 'draw':
        return true;
    }
    void dt;
    return false;
  }

  /** Auf dem Meer: Monster angreifen, sonst um die Insel herum Wellen reiten (und Rampen mitnehmen). */
  private seaHeading(): number {
    const game = this.game;
    const s = game.surfer;
    const [ix, iz] = CONFIG.world.islandPosition;
    let best: Monster | null = null;
    let bestD = 90;
    for (const m of game.monsters.monsters) {
      if (!m.isTargetable) continue;
      const d = Math.hypot(m.x - s.x, m.z - s.z);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    // Ein Boss wird immer angesteuert, egal wie weit weg
    const boss = game.monsters.boss;
    if (boss && boss.isTargetable) {
      best = boss;
      bestD = Math.hypot(boss.x - s.x, boss.z - s.z);
    }
    this.targetMonster = best;
    if (best) {
      // Boss: bis in Trick-Reichweite, aber nicht dagegen fahren
      if (best.def.boss && bestD < 30) return Math.atan2(s.x - best.x, s.z - best.z) + Math.PI / 2;
      return Math.atan2(best.x - s.x, best.z - s.z);
    }
    // Rampe voraus?
    for (const w of game.world.ramps.wrecks) {
      const dx = w.x - s.x;
      const dz = w.z - s.z;
      const d = Math.hypot(dx, dz);
      if (d > 8 && d < 70) {
        const toward = Math.atan2(dx, dz);
        const along = Math.atan2(w.dirX, w.dirZ);
        if (Math.abs(wrapAngle(toward - s.heading)) < 0.5 && Math.abs(wrapAngle(along - s.heading)) < 0.6) return toward;
      }
    }
    // Um die Insel kreisen (quer zu den Wellen), Abstand halten
    const r = Math.hypot(s.x - ix, s.z - iz) || 1;
    const out = Math.atan2(s.x - ix, s.z - iz);
    const minR = game.world.reefOpen ? 220 : CONFIG.world.boundaryRadius + 70;
    const bias = r < minR ? 0.6 : r > 850 ? -0.6 : 0;
    return out + this.orbitDir * (Math.PI / 2) - this.orbitDir * bias;
  }

  /**
   * Angekündigte Einschläge (Felsbrocken, Feuerbälle, Lava-Ausbrüche, Muschel-Perlen) in der Nähe?
   * Dann davon weg steuern (wie ein aufmerksamer Mensch). null = keine Gefahr.
   */
  private threatEscape(): number | null {
    const s = this.game.surfer;
    let best: number | null = null;
    let bestD = Infinity;
    for (const m of this.game.monsters.monsters) {
      const any = m as unknown as Record<string, unknown>;
      const P = m.def.behaviorParams ?? {};
      // Angekündigte Rammbahn (Hai, Seeschlange): seitlich raus
      const mode = any.mode as string | undefined;
      if (mode === 'aim' || mode === 'rear' || mode === 'charge' || mode === 'lunge') {
        const dx = (any.chargeDirX ?? any.lungeX) as number | undefined;
        const dz = (any.chargeDirZ ?? any.lungeZ) as number | undefined;
        if (dx !== undefined && dz !== undefined) {
          const rx = s.x - m.x;
          const rz = s.z - m.z;
          const along = rx * dx + rz * dz;
          const side = rx * dz - rz * dx;
          if (along > -2 && along < 40 && Math.abs(side) < m.def.attack.radius + 3 && Math.abs(side) < bestD) {
            bestD = Math.abs(side);
            // senkrecht zur Bahn, auf der Seite, auf der man schon ist
            best = Math.atan2(dz, -dx) + (side >= 0 ? 0 : Math.PI);
          }
        }
      }
      const lists: [unknown, number][] = [
        [any.balls, P.ballRadius ?? 4],
        [any.rocks, P.rockRadius ?? 4],
        [any.shots, P.shotRadius ?? 3],
        [any.eruptions, P.slamRadius ?? 8],
      ];
      for (const [list, radius] of lists) {
        if (!Array.isArray(list)) continue;
        for (const t of list as { tx?: number; tz?: number; x?: number; z?: number; fired?: boolean }[]) {
          if (t.fired) continue;
          const tx = t.tx ?? t.x ?? 0;
          const tz = t.tz ?? t.z ?? 0;
          const d = Math.hypot(s.x - tx, s.z - tz);
          if (d < radius + 3 && d < bestD) {
            bestD = d;
            best = d < 0.5 ? s.heading + Math.PI / 2 : Math.atan2(s.x - tx, s.z - tz);
          }
        }
      }
    }
    return best;
  }

  /** Im Krater: einen Geysir ansteuern, dort auf den Ausbruch warten; nicht in den Titanen. */
  private craterHeading(dt: number): number {
    const game = this.game;
    const s = game.surfer;
    const c = game.world.arena;
    this.targetMonster = game.monsters.boss;
    const dc = Math.hypot(s.x - c.centerX, s.z - c.centerZ);
    if (dc < 24) return Math.atan2(s.x - c.centerX, s.z - c.centerZ);
    const list = game.world.geysers.geysers;
    let g = list.find((x) => x.id === this.geyserId);
    if (!g || this.geyserWait > 7) {
      // nächsten Geysir wählen (nicht den, auf dem gerade nichts passiert ist)
      const skip = this.geyserWait > 7 ? this.geyserId : -1;
      let bestD = Infinity;
      for (const x of list) {
        if (x.id === skip) continue;
        const d = Math.hypot(x.x - s.x, x.z - s.z);
        if (d < bestD) {
          bestD = d;
          g = x;
        }
      }
      this.geyserId = g?.id ?? -1;
      this.geyserWait = 0;
    }
    if (!g) return Math.atan2(c.centerX - s.x, c.centerZ - s.z);
    const d = Math.hypot(g.x - s.x, g.z - s.z);
    if (d < CONFIG.geysers.radius * 0.6) {
      this.geyserWait += dt;
      this.game.input.state.brake = 1;
      this.game.input.state.paddle = 0;
    }
    return Math.atan2(g.x - s.x, g.z - s.z);
  }

  /** Passendes Symbol als Strich „zeichnen“ (mit etwas Zittern wie ein Mensch). */
  private drawTrick(): void {
    const game = this.game;
    const tricks = game.content.tricks.all().filter((t) => (game.tricks as unknown as { isTrickUnlocked(t: TrickDef): boolean }).isTrickUnlocked(t));
    if (!tricks.length) return;
    const m = this.targetMonster;
    const weak = m ? this.weakTricks(m.def, tricks) : [];
    const pick = weak.length && Math.random() < 0.7 ? weak[Math.floor(Math.random() * weak.length)]! : tricks[Math.floor(Math.random() * tricks.length)]!;
    // Geführtes Zeichnen (Tutorial): das gesuchte Symbol
    const guide = game.tricks.guided;
    const symbol = game.content.symbols.tryGet(guide?.symbol ?? pick.symbols[0] ?? '');
    if (!symbol) return;
    const scale = 1.8 + Math.random() * 1.2;
    const ox = 120 + Math.random() * 200;
    const oy = 80 + Math.random() * 120;
    const rot = (Math.random() - 0.5) * 0.4;
    const pts: StrokePoint[] = symbol.preview.map((p, i) => {
      const x = (p.x - 50) * scale;
      const y = (p.y - 50) * scale;
      return {
        x: ox + x * Math.cos(rot) - y * Math.sin(rot) + (Math.random() - 0.5) * 6,
        y: oy + x * Math.sin(rot) + y * Math.cos(rot) + (Math.random() - 0.5) * 6,
        t: i * 12,
      };
    });
    game.input.emitStrokeEnd(pts);
  }

  private weakTricks(def: MonsterDef, unlocked: TrickDef[]): TrickDef[] {
    const ids = def.weaknesses.filter((w) => w.multiplier > 1).map((w) => w.trick);
    return unlocked.filter((t) => ids.includes(t.id));
  }
}
