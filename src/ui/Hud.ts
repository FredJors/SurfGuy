/**
 * HUD: Herzen, Punkte (+Kombo), Perlen, Tempo, Richtung/Distanz zur Insel, Wellen-Timing.
 * Wichtige Infos oben und in der Mitte unten – nichts unter den Daumen.
 */
import { clamp01 } from '../core/math';
import { formatNumber, h, setText } from './dom';

export interface HudData {
  hearts: number;
  maxHearts: number;
  score: number;
  combo: number;
  multiplier: number;
  pearls: number;
  speed: number;
  speedMax: number;
  standSpeed: number;
  standing: boolean;
  /** Winkel zur Insel relativ zur Blickrichtung (rad, 0 = geradeaus, + = rechts) */
  islandAngle: number;
  islandDistance: number;
  zoneName: string;
  wave: {
    visible: boolean;
    /** Abstand des Kamms hinter dem Spieler (m) */
    distance: number;
    windowMin: number;
    windowMax: number;
    lookahead: number;
    inWindow: boolean;
    aligned: boolean;
    riding: boolean;
  };
  invulnerable: boolean;
}

export class Hud {
  readonly el: HTMLDivElement;
  readonly pauseButton: HTMLButtonElement;
  private readonly heartsEl: HTMLDivElement;
  private hearts: HTMLSpanElement[] = [];
  private readonly scoreEl: HTMLDivElement;
  private readonly comboEl: HTMLDivElement;
  private readonly pearlsEl: HTMLSpanElement;
  private readonly speedFill: HTMLDivElement;
  private readonly speedTick: HTMLDivElement;
  private readonly speedLabel: HTMLDivElement;
  private readonly arrow: HTMLDivElement;
  private readonly distEl: HTMLDivElement;
  private readonly zoneEl: HTMLDivElement;
  private readonly waveEl: HTMLDivElement;
  private readonly waveWindow: HTMLDivElement;
  private readonly waveMarker: HTMLDivElement;
  private readonly waveLabel: HTMLDivElement;
  private lastHearts = -1;

  constructor(parent: HTMLElement) {
    this.heartsEl = h('div', { class: 'hearts' });
    this.pearlsEl = h('span', { text: '0' });
    this.scoreEl = h('div', { class: 'score outlined', text: '0' });
    this.comboEl = h('div', { class: 'combo hidden', text: '×1' });
    this.waveWindow = h('div', { class: 'window' });
    this.waveMarker = h('div', { class: 'marker' });
    this.waveLabel = h('div', { class: 'label outlined', text: '' });
    this.waveEl = h('div', { class: 'wave-meter' }, [
      h('div', { class: 'track' }, [this.waveWindow, this.waveMarker, h('div', { class: 'player-dot' })]),
      this.waveLabel,
    ]);
    this.arrow = h('div', {
      class: 'arrow',
      html: '<svg viewBox="0 0 24 24"><path d="M12 2 L20 20 L12 15 L4 20 Z" fill="#ff8a3d" stroke="#1d2140" stroke-width="2" stroke-linejoin="round"/></svg>',
    });
    this.distEl = h('div', { class: 'dist outlined', text: '' });
    this.zoneEl = h('div', { class: 'zone-name outlined', text: '' });
    this.speedFill = h('div', { class: 'fill' });
    this.speedTick = h('div', { class: 'tick' });
    this.speedLabel = h('div', { class: 'speed-label outlined', text: '' });
    this.pauseButton = h('button', {
      class: 'btn small pause-btn',
      attrs: { 'aria-label': 'Pause' },
      html: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>',
    });

    this.el = h('div', { class: 'hud hidden' }, [
      h('div', { class: 'hud-tl' }, [this.heartsEl, h('span', { class: 'chip' }, [h('span', { class: 'pearl-icon' }), this.pearlsEl])]),
      h('div', { class: 'hud-tc' }, [this.scoreEl, this.comboEl, this.waveEl]),
      h('div', { class: 'hud-tr' }, [
        h('div', { class: 'compass' }, [h('div', {}, [this.distEl, this.zoneEl]), this.arrow]),
        this.pauseButton,
      ]),
      h('div', { class: 'hud-bc' }, [h('div', { class: 'speed' }, [this.speedFill, this.speedTick]), this.speedLabel]),
    ]);
    parent.appendChild(this.el);
  }

  show(): void {
    this.el.classList.remove('hidden');
  }

  hide(): void {
    this.el.classList.add('hidden');
  }

  update(d: HudData): void {
    // Herzen
    if (this.hearts.length !== d.maxHearts) {
      this.heartsEl.innerHTML = '';
      this.hearts = Array.from({ length: d.maxHearts }, () => h('span', { class: 'heart', text: '♥' }));
      this.hearts.forEach((e) => this.heartsEl.appendChild(e));
      this.lastHearts = -1;
    }
    if (d.hearts !== this.lastHearts) {
      this.hearts.forEach((e, i) => {
        const lost = i >= d.hearts;
        if (lost && !e.classList.contains('lost') && this.lastHearts !== -1) {
          e.classList.add('pop');
          setTimeout(() => e.classList.remove('pop'), 500);
        }
        e.classList.toggle('lost', lost);
      });
      this.lastHearts = d.hearts;
    }
    this.heartsEl.style.opacity = d.invulnerable ? (Math.floor(performance.now() / 120) % 2 ? '0.4' : '1') : '1';

    setText(this.scoreEl, formatNumber(d.score));
    setText(this.pearlsEl, formatNumber(d.pearls));
    this.comboEl.classList.toggle('hidden', d.combo < 2);
    setText(this.comboEl, `Kombo ×${d.multiplier.toFixed(1).replace('.0', '')}`);

    // Tempo
    this.speedFill.style.width = `${(clamp01(d.speed / d.speedMax) * 100).toFixed(1)}%`;
    this.speedTick.style.left = `${((d.standSpeed / d.speedMax) * 100).toFixed(1)}%`;
    setText(this.speedLabel, `${Math.round(d.speed * 3.6)} km/h · ${d.standing ? 'Stehen' : 'Paddeln'}`);

    // Insel-Kompass
    this.arrow.style.transform = `rotate(${d.islandAngle.toFixed(3)}rad)`;
    setText(this.distEl, `Insel ${formatNumber(d.islandDistance)} m`);
    setText(this.zoneEl, d.zoneName);

    // Wellen-Timing: Marker wandert von links (weit hinten) nach rechts (beim Spieler)
    const w = d.wave;
    this.waveEl.style.opacity = w.visible || w.riding ? '1' : '0';
    if (w.riding) {
      this.waveEl.classList.remove('go');
      setText(this.waveLabel, 'Wellenritt! Quer zur Welle fahren');
      this.waveMarker.style.left = '100%';
    } else if (w.visible) {
      const toX = (s: number) => (1 - clamp01((s - w.windowMin) / (w.lookahead - w.windowMin))) * 100;
      this.waveMarker.style.left = `${toX(w.distance).toFixed(1)}%`;
      const left = toX(w.windowMax);
      this.waveWindow.style.left = `${left.toFixed(1)}%`;
      this.waveWindow.style.width = `${(100 - left).toFixed(1)}%`;
      const go = w.inWindow;
      this.waveEl.classList.toggle('go', go && w.aligned);
      setText(
        this.waveLabel,
        go ? (w.aligned ? 'JETZT PADDELN!' : 'Zur Insel drehen!') : `Welle kommt · ${Math.max(0, Math.round(w.distance))} m`,
      );
    }
  }
}
