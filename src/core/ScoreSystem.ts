/**
 * Punkte, Kombo, Perlen und Erfahrung eines Runs – hängt sich nur an Events.
 */
import { CONFIG } from '../config/gameConfig';
import type { ContentRegistries } from '../data';
import type { PlayerStats } from '../player/Progression';
import type { GameEventBus } from './events';
import type { RunState } from './RunState';

const LAUNCH_LABEL: Record<string, string> = {
  ramp: 'Wrack-Sprung!',
  geyser: 'Geysir!',
  punch: 'Durchstoß!',
};

export class ScoreSystem {
  private offs: (() => void)[] = [];
  run: RunState | null = null;

  constructor(
    private readonly bus: GameEventBus,
    private readonly content: ContentRegistries,
    private readonly getStats: () => PlayerStats,
  ) {
    const S = CONFIG.score;
    const on = this.bus.on.bind(this.bus);
    this.offs.push(
      on('waveCaught', (e) => {
        this.add(Math.round(S.waveCatchPerMeter * e.height), 'Welle erwischt!', false);
        if (this.run) this.run.wavesRidden++;
      }),
      on('waveRideEnded', (e) => {
        const pts = Math.round(S.ridePerSecondPerMeter * e.height * e.duration);
        if (pts > 0) this.add(pts, `Wellenritt ${e.duration.toFixed(1)} s`, false);
      }),
      on('jump', (e) => this.add(Math.round(S.jump + S.airtimePerSecond * e.airtime), '', false)),
      on('launched', (e) => {
        const base = S.launch[e.source] ?? 0;
        if (base > 0) this.add(Math.round(base + S.launchPerAirSecond * e.airtime), LAUNCH_LABEL[e.source] ?? '', false);
      }),
      on('trickLanded', (e) => {
        const trick = this.content.tricks.get(e.trickId);
        const q = CONFIG.trick.qualityMultiplier[e.quality];
        const base = trick.points * q * this.getStats().get('trickPoints');
        if (this.run) {
          this.run.combo += 1;
          this.run.comboTimer = S.comboTimeout;
          this.run.bestCombo = Math.max(this.run.bestCombo, this.run.combo);
          this.run.tricksLanded++;
          this.bus.emit('comboChanged', { combo: this.run.combo, multiplier: this.multiplier });
        }
        this.add(Math.round(base), `${trick.name} – ${CONFIG.trick.qualityLabel[e.quality]}`, true);
      }),
      on('monsterHit', (e) => this.add(Math.round(e.damage * S.pointsPerDamage), e.weakness ? 'Schwachstelle!' : 'Treffer', true)),
      on('monsterDefeated', (e) => {
        if (!this.run) return;
        this.run.monstersDefeated++;
        // Perlen spritzen aus dem Monster und werden eingesammelt (PickupSystem → pearlCollected)
        this.run.xp += Math.round(e.rewards.xp * this.getStats().get('xpGain'));
        const name = this.content.monsters.tryGet(e.monsterId)?.name ?? 'Monster';
        this.add(e.rewards.points, `${name} besiegt!`, true);
      }),
      on('monsterEscaped', (e) => this.add(e.points, 'Entkommen', false)),
      on('pearlCollected', (e) => {
        if (!this.run) return;
        const run = this.run;
        // Bruchteile (z. B. +15 % Perlen) sammeln sich an, statt verloren zu gehen
        const gained = e.value * this.getStats().get('pearlGain') + run.pearlRemainder;
        const whole = Math.floor(gained + 1e-9);
        run.pearlRemainder = gained - whole;
        run.pearls += whole;
        this.add(S.pearl * e.value, '', false);
        // Perlenkette
        const P = CONFIG.pearls;
        run.pearlChain = run.pearlChainTimer > 0 ? run.pearlChain + 1 : 1;
        run.pearlChainTimer = P.chainWindow;
        run.bestPearlChain = Math.max(run.bestPearlChain, run.pearlChain);
        const bonus = P.chainMilestones.includes(run.pearlChain) ? run.pearlChain * P.chainBonusPerPearl : 0;
        this.bus.emit('pearlChain', { count: run.pearlChain, bonus });
        if (bonus) this.add(bonus, `Perlenkette ×${run.pearlChain}!`, false);
      }),
      on('playerHit', () => this.resetCombo()),
    );
  }

  get multiplier(): number {
    if (!this.run) return 1;
    const S = CONFIG.score;
    return Math.min(S.comboMax, 1 + Math.max(0, this.run.combo - 1) * S.comboStep);
  }

  add(points: number, reason: string, useCombo: boolean): void {
    if (!this.run || points <= 0) return;
    const mul = (useCombo ? this.multiplier : 1) * this.getStats().get('scoreGain');
    const total = Math.round(points * mul);
    this.run.score += total;
    this.bus.emit('scoreAdded', { points: total, reason, total: this.run.score, multiplier: mul });
  }

  resetCombo(): void {
    if (!this.run || this.run.combo === 0) return;
    this.run.combo = 0;
    this.bus.emit('comboChanged', { combo: 0, multiplier: 1 });
  }

  update(dt: number): void {
    if (!this.run) return;
    if (this.run.pearlChainTimer > 0) {
      this.run.pearlChainTimer -= dt;
      if (this.run.pearlChainTimer <= 0) this.run.pearlChain = 0;
    }
    if (this.run.combo > 0) {
      this.run.comboTimer -= dt;
      if (this.run.comboTimer <= 0) this.resetCombo();
    }
  }

  /** Erfahrung aus Punkten (am Run-Ende). */
  finalXp(): number {
    if (!this.run) return 0;
    const fromScore = Math.floor(this.run.score / 100) * CONFIG.score.xpPer100Points;
    return Math.round((this.run.xp + fromScore) * this.getStats().get('xpGain'));
  }

  dispose(): void {
    this.offs.forEach((off) => off());
  }
}
