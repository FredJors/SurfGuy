/**
 * Soundeffekte, komplett im Browser erzeugt (Web Audio): Oszillatoren und gefiltertes Rauschen.
 * Keine Audiodateien nötig. Browser erlauben Ton erst nach einer Nutzeraktion → unlock().
 */
import { CONFIG } from '../config/gameConfig';

interface ToneOptions {
  freq: number;
  /** Endfrequenz (Glissando) */
  to?: number;
  type?: OscillatorType;
  dur: number;
  gain?: number;
  attack?: number;
  delay?: number;
}

interface NoiseOptions {
  dur: number;
  freq: number;
  to?: number;
  filter?: BiquadFilterType;
  q?: number;
  gain?: number;
  attack?: number;
  delay?: number;
}

/** Pentatonik (Halbtöne) – klingt in jeder Reihenfolge harmonisch. */
const PENTATONIC = [0, 2, 4, 7, 9];

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private ambience: GainNode | null = null;
  private nextPearlAt = 0;
  private enabled = true;

  /** Muss in einer Nutzeraktion (Tippen, Klick, Taste) aufgerufen werden. */
  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      // iOS: Ton auch bei Stummschalter spielen wie ein Spiel (Safari 16.4+)
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) session.type = 'playback';
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.enabled ? CONFIG.audio.volume : 0;
      const comp = ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(ctx.destination);
      const len = ctx.sampleRate * 2;
      this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.startAmbience();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(on ? CONFIG.audio.volume : 0, this.ctx.currentTime, 0.05);
  }

  private get live(): boolean {
    return !!this.ctx && this.enabled && this.ctx.state === 'running';
  }

  // -------------------------------------------------------------------------
  // Bausteine
  // -------------------------------------------------------------------------

  tone(o: ToneOptions): void {
    const ctx = this.ctx;
    if (!ctx || !this.live || !this.master) return;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
    const g = ctx.createGain();
    const peak = o.gain ?? 0.2;
    const attack = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.05);
  }

  noise(o: NoiseOptions): void {
    const ctx = this.ctx;
    if (!ctx || !this.live || !this.master || !this.noiseBuffer) return;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = o.filter ?? 'lowpass';
    f.Q.value = o.q ?? 1;
    f.frequency.setValueAtTime(o.freq, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
    const g = ctx.createGain();
    const peak = o.gain ?? 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (o.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + o.dur + 0.05);
  }

  private notes(freqs: readonly number[], step: number, o: Omit<ToneOptions, 'freq' | 'delay'>, delay = 0): void {
    freqs.forEach((freq, i) => this.tone({ ...o, freq, delay: delay + i * step }));
  }

  /** Meeresrauschen im Hintergrund (leise, langsam an- und abschwellend). */
  private startAmbience(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 520;
    const g = ctx.createGain();
    g.gain.value = CONFIG.audio.ambience;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = CONFIG.audio.ambience * 0.6;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(f).connect(g).connect(this.master);
    src.start();
    lfo.start();
    this.ambience = g;
  }

  // -------------------------------------------------------------------------
  // Spielgeräusche
  // -------------------------------------------------------------------------

  /** Perle: Tonhöhe steigt mit der Länge der Perlenkette. Viele Perlen auf einmal werden leicht gestaffelt. */
  pearl(chain: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.live) return;
    const n = Math.min(chain - 1, 14);
    const semis = PENTATONIC[n % 5]! + 12 * Math.floor(n / 5);
    const freq = 784 * Math.pow(2, semis / 12);
    const delay = Math.max(0, this.nextPearlAt - ctx.currentTime);
    this.nextPearlAt = ctx.currentTime + delay + 0.045;
    if (delay > 0.6) return; // nicht endlos stauen
    this.tone({ freq, dur: 0.18, gain: 0.16, delay });
    this.tone({ freq: freq * 2, type: 'triangle', dur: 0.09, gain: 0.05, delay });
  }

  /** Meilenstein einer Perlenkette (z. B. 10, 25, 50). */
  chainBonus(): void {
    this.notes([1047, 1319, 1568, 2093], 0.06, { dur: 0.22, gain: 0.12, type: 'triangle' });
  }

  click(): void {
    this.tone({ freq: 880, to: 1320, dur: 0.07, gain: 0.08 });
  }

  jump(): void {
    this.noise({ dur: 0.25, freq: 500, to: 1800, filter: 'bandpass', q: 1.2, gain: 0.22 });
  }

  /** Abheben von Rampe, Geysir oder Durchstoß. */
  launch(power = 1): void {
    this.noise({ dur: 0.55, freq: 300, to: 2600, filter: 'bandpass', q: 0.9, gain: 0.3 * power });
    this.tone({ freq: 220, to: 660, type: 'triangle', dur: 0.45, gain: 0.08 * power });
  }

  land(strength: number): void {
    this.noise({ dur: 0.35, freq: 1500, to: 180, gain: Math.min(0.4, 0.12 + 0.1 * strength) });
  }

  waveCaught(): void {
    this.noise({ dur: 0.5, freq: 700, to: 2200, filter: 'lowpass', gain: 0.18, attack: 0.08 });
    this.notes([523, 784], 0.08, { dur: 0.2, gain: 0.1 });
  }

  drawStart(): void {
    this.tone({ freq: 420, to: 140, dur: 0.35, gain: 0.14 });
  }

  trick(quality: 'okay' | 'good' | 'perfect'): void {
    const seq = quality === 'perfect' ? [523, 659, 784, 1047, 1319] : quality === 'good' ? [523, 659, 784, 1047] : [523, 659, 784];
    this.notes(seq, 0.07, { dur: 0.25, gain: 0.13, type: 'triangle' });
    if (quality === 'perfect') this.notes([2093, 2637, 3136], 0.05, { dur: 0.15, gain: 0.05 }, 0.35);
  }

  trickFailed(): void {
    this.tone({ freq: 330, to: 196, type: 'triangle', dur: 0.3, gain: 0.1 });
  }

  monsterHit(weakness: boolean): void {
    this.tone({ freq: weakness ? 330 : 220, to: 90, type: 'square', dur: 0.14, gain: 0.08 });
    this.noise({ dur: 0.12, freq: 2500, to: 400, gain: 0.18 });
  }

  monsterDefeated(): void {
    this.notes([392, 523, 659, 784], 0.09, { dur: 0.3, gain: 0.12, type: 'triangle' });
    this.tone({ freq: 1047, dur: 0.6, gain: 0.1, type: 'triangle', delay: 0.38 });
  }

  playerHit(): void {
    this.tone({ freq: 170, to: 45, dur: 0.4, gain: 0.32 });
    this.noise({ dur: 0.35, freq: 900, to: 120, gain: 0.25 });
  }

  warning(): void {
    this.notes([880, 660], 0.14, { dur: 0.12, gain: 0.06, type: 'square' });
  }

  bonk(): void {
    this.tone({ freq: 150, to: 70, type: 'square', dur: 0.15, gain: 0.1 });
    this.noise({ dur: 0.15, freq: 1200, to: 300, gain: 0.2 });
  }

  chest(): void {
    this.tone({ freq: 300, to: 900, type: 'triangle', dur: 0.25, gain: 0.12 });
    this.notes([784, 988, 1175, 1568, 1976], 0.05, { dur: 0.2, gain: 0.08 }, 0.15);
  }

  powerup(): void {
    this.tone({ freq: 400, to: 1600, dur: 0.4, gain: 0.12 });
    this.notes([1568, 2093], 0.08, { dur: 0.15, gain: 0.06, type: 'triangle' }, 0.3);
  }

  dolphin(): void {
    this.tone({ freq: 1800, to: 2700, dur: 0.12, gain: 0.05 });
    this.tone({ freq: 2200, to: 3000, dur: 0.1, gain: 0.04, delay: 0.14 });
  }

  geyser(distance: number): void {
    const k = Math.max(0, 1 - distance / 120);
    if (k <= 0) return;
    this.noise({ dur: 1.4, freq: 300, to: 1200, gain: 0.25 * k, attack: 0.15 });
  }

  ability(): void {
    this.tone({ freq: 500, to: 1000, dur: 0.25, gain: 0.1, type: 'triangle' });
  }

  comboUp(multiplier: number): void {
    this.tone({ freq: 660 * Math.min(2, 1 + (multiplier - 1) * 0.15), dur: 0.15, gain: 0.08, type: 'square', delay: 0.3 });
  }

  /** Boss brüllt (Erwachen, Wut). */
  roar(): void {
    this.tone({ freq: 110, to: 70, type: 'sawtooth', dur: 1.1, gain: 0.12, attack: 0.08 });
    this.tone({ freq: 165, to: 90, type: 'square', dur: 0.9, gain: 0.05, attack: 0.1 });
    this.noise({ dur: 1.1, freq: 600, to: 200, gain: 0.2, attack: 0.1 });
  }

  rockThrow(): void {
    this.noise({ dur: 0.45, freq: 250, to: 900, filter: 'bandpass', q: 1.5, gain: 0.18 });
  }

  rockImpact(distance: number): void {
    const k = Math.max(0.15, 1 - distance / 90);
    this.tone({ freq: 90, to: 40, dur: 0.45, gain: 0.3 * k });
    this.noise({ dur: 0.5, freq: 1400, to: 150, gain: 0.3 * k });
  }

  stomp(): void {
    this.tone({ freq: 60, to: 30, dur: 0.8, gain: 0.4 });
    this.noise({ dur: 0.9, freq: 500, to: 80, gain: 0.35 });
  }

  /** Feuerstrahl lädt auf (Lava-Titan) */
  beam(): void {
    this.tone({ freq: 120, to: 520, type: 'sawtooth', dur: 1.6, gain: 0.07, attack: 0.3 });
    this.noise({ dur: 1.8, freq: 300, to: 2400, filter: 'bandpass', q: 0.8, gain: 0.16, attack: 0.4 });
  }

  /** Seeschlange zischt */
  hiss(): void {
    this.noise({ dur: 0.7, freq: 4200, to: 2600, filter: 'bandpass', q: 2, gain: 0.16, attack: 0.05 });
  }

  /** Vorschnellen (Seeschlange) */
  lunge(): void {
    this.noise({ dur: 0.4, freq: 400, to: 1800, filter: 'bandpass', q: 1.2, gain: 0.2 });
    this.tone({ freq: 140, to: 80, type: 'sawtooth', dur: 0.3, gain: 0.06 });
  }

  /** Walgesang beim Abtauchen */
  whaleCall(): void {
    this.tone({ freq: 220, to: 340, type: 'sine', dur: 0.9, gain: 0.12, attack: 0.2 });
    this.tone({ freq: 340, to: 180, type: 'triangle', dur: 1.2, gain: 0.08, attack: 0.3 });
  }

  /** Wal bricht durch die Oberfläche */
  breach(): void {
    this.noise({ dur: 1.0, freq: 900, to: 250, gain: 0.3, attack: 0.02 });
    this.tone({ freq: 80, to: 45, dur: 0.7, gain: 0.25 });
  }

  /** Muschel spuckt */
  spit(): void {
    this.tone({ freq: 520, to: 260, type: 'square', dur: 0.12, gain: 0.07 });
    this.noise({ dur: 0.2, freq: 1500, to: 600, filter: 'bandpass', q: 2, gain: 0.12 });
  }

  /** Eisbär brüllt (kürzer und heller als der Boss) */
  growl(): void {
    this.tone({ freq: 160, to: 95, type: 'sawtooth', dur: 0.7, gain: 0.09, attack: 0.06 });
    this.noise({ dur: 0.7, freq: 900, to: 300, gain: 0.14, attack: 0.06 });
  }

  /** Eis knackt / bricht (Seeleopard, Frost) */
  iceCrack(): void {
    this.noise({ dur: 0.25, freq: 5200, to: 1800, filter: 'bandpass', q: 3, gain: 0.2 });
    this.tone({ freq: 1800, to: 900, type: 'triangle', dur: 0.12, gain: 0.06 });
    this.noise({ dur: 0.35, freq: 2600, to: 700, filter: 'bandpass', q: 2, gain: 0.12, delay: 0.08 });
  }

  /** Narwal stürmt los */
  charge(): void {
    this.noise({ dur: 0.6, freq: 300, to: 2200, filter: 'bandpass', q: 1, gain: 0.22 });
    this.tone({ freq: 300, to: 900, type: 'triangle', dur: 0.5, gain: 0.06 });
  }

  /** Trick prallt an der geschlossenen Muschel ab */
  clonk(): void {
    this.tone({ freq: 900, to: 760, type: 'triangle', dur: 0.18, gain: 0.12 });
    this.tone({ freq: 1350, type: 'sine', dur: 0.25, gain: 0.05 });
  }

  bossDefeated(): void {
    this.notes([392, 523, 659, 784, 1047], 0.12, { dur: 0.45, gain: 0.14, type: 'triangle' });
    this.notes([1319, 1568, 2093], 0.1, { dur: 0.6, gain: 0.08 }, 0.7);
  }

  /** Walze beim Truhen-Öffnen: kurzes Ticken pro Karte. */
  tick(): void {
    this.tone({ freq: 2300, type: 'triangle', dur: 0.04, gain: 0.07 });
  }

  /** Gewinn aus einer Truhe – je seltener, desto prächtiger. */
  reveal(rarity: 'common' | 'rare' | 'epic' | 'legendary'): void {
    const seq = {
      common: [523, 659],
      rare: [523, 659, 784],
      epic: [523, 659, 784, 1047],
      legendary: [523, 659, 784, 1047, 1319, 1568],
    }[rarity];
    this.notes(seq, 0.08, { dur: 0.3, gain: 0.13, type: 'triangle' });
    if (rarity === 'legendary' || rarity === 'epic') this.notes([2093, 2637, 3136, 2637, 3136], 0.06, { dur: 0.15, gain: 0.05 }, 0.45);
  }

  /** Lautstärke des Meeresrauschens (z. B. leiser im Menü). */
  setAmbience(level: number): void {
    if (this.ctx && this.ambience) this.ambience.gain.setTargetAtTime(CONFIG.audio.ambience * level, this.ctx.currentTime, 0.4);
  }
}
