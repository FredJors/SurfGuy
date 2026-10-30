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
  /** An Land zu Fuß unterwegs */
  walking?: boolean;
  /** Ziel des Kompasses (Standard „Insel“, z. B. „Surfshop“) */
  targetName?: string;
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
  /** Länge der laufenden Perlenkette */
  pearlChain: number;
  /** Eingesammelte Truhen (Öffnen nach dem Run) */
  chests: number;
  /** Laufende Power-ups mit Restanteil 0..1 */
  powerups: { id: string; icon: string; color: string; remaining: number }[];
  /** 0..1: Stärke der Tempo-Streifen am Bildrand */
  speedLines: number;
  /** Welle von vorn: Hinweis zum Durchstoß (ring = Ringwelle des Bosses: einfach springen) */
  punch: { visible: boolean; inWindow: boolean; distance: number; ring: boolean; label?: string };
  /** Endgegner-Leiste (null = kein Boss) */
  boss: { name: string; hp: number; enraged: boolean } | null;
  /** Weg zum nächsten Geysir (nur nahe der Insel) */
  geyser: { visible: boolean; angle: number; distance: number };
  /** Pro Fähigkeiten-Platz: Abklingzeit 0..1 und ob gerade wirksam (z. B. Schild) */
  abilities: { cooldown: number; active: boolean; usable: boolean }[];
}

export interface HudAbility {
  icon: string;
  name: string;
  key: string;
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
  readonly pearlChip: HTMLSpanElement;
  private readonly chainEl: HTMLSpanElement;
  private lastChain = 0;
  private lastPearls = 0;
  private readonly powerupBox: HTMLDivElement;
  private readonly chestChip: HTMLSpanElement;
  private readonly chestCount: HTMLSpanElement;
  private lastChests = 0;
  private readonly powerupEls = new Map<string, { el: HTMLDivElement; bar: HTMLDivElement }>();
  private readonly speedLinesEl: HTMLDivElement;
  private readonly punchEl: HTMLDivElement;
  private readonly bossEl: HTMLDivElement;
  private readonly bossName: HTMLDivElement;
  private readonly bossFill: HTMLDivElement;
  private readonly bossLag: HTMLDivElement;
  private bossHpShown = 1;
  private readonly geyserEl: HTMLDivElement;
  private readonly geyserArrow: HTMLDivElement;
  private readonly geyserDist: HTMLSpanElement;
  private readonly abilityBox: HTMLDivElement;
  private abilityButtons: HTMLButtonElement[] = [];
  /** Wird aufgerufen, wenn ein Fähigkeiten-Knopf gedrückt wird */
  onAbility: (slot: number) => void = () => {};

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
    this.abilityBox = h('div', { class: 'abilities' });
    this.pauseButton = h('button', {
      class: 'btn small pause-btn',
      attrs: { 'aria-label': 'Pause' },
      html: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>',
    });

    this.chainEl = h('span', { class: 'chain-badge hidden', text: '' });
    this.pearlChip = h('span', { class: 'chip pearl-chip' }, [h('span', { class: 'pearl-icon' }), this.pearlsEl, this.chainEl]);
    this.powerupBox = h('div', { class: 'powerups' });
    this.chestCount = h('span', { text: '0' });
    this.chestChip = h('span', { class: 'chip chest-chip hidden' }, [h('span', { class: 'chest-icon' }), this.chestCount]);
    this.speedLinesEl = h('div', { class: 'speed-lines' });
    this.punchEl = h('div', { class: 'punch-prompt outlined hidden', text: '' });
    this.bossName = h('div', { class: 'boss-name outlined', text: '' });
    this.bossFill = h('div', { class: 'boss-fill' });
    this.bossLag = h('div', { class: 'boss-lag' });
    this.bossEl = h('div', { class: 'boss-bar hidden' }, [this.bossName, h('div', { class: 'boss-track' }, [this.bossLag, this.bossFill, h('div', { class: 'boss-half' })])]);
    this.geyserArrow = h('div', {
      class: 'arrow small',
      html: '<svg viewBox="0 0 24 24"><path d="M12 2 L20 20 L12 15 L4 20 Z" fill="#ffd23f" stroke="#1d2140" stroke-width="2" stroke-linejoin="round"/></svg>',
    });
    this.geyserDist = h('span', { text: '' });
    this.geyserEl = h('div', { class: 'geyser-hint hidden' }, [h('span', { class: 'outlined', text: 'Geysir ' }), this.geyserDist, this.geyserArrow]);

    this.el = h('div', { class: 'hud hidden' }, [
      this.speedLinesEl,
      h('div', { class: 'hud-tl' }, [this.heartsEl, h('div', { class: 'hud-row' }, [this.pearlChip, this.chestChip]), this.powerupBox]),
      h('div', { class: 'hud-tc' }, [this.scoreEl, this.comboEl, this.bossEl, this.waveEl]),
      h('div', { class: 'hud-tr' }, [
        h('div', { class: 'compass' }, [h('div', {}, [this.distEl, this.zoneEl]), this.arrow]),
        this.geyserEl,
        this.pauseButton,
        this.abilityBox,
      ]),
      h('div', { class: 'hud-bc' }, [this.punchEl, h('div', { class: 'speed' }, [this.speedFill, this.speedTick]), this.speedLabel]),
    ]);
    parent.appendChild(this.el);
  }

  /** Belegt die Fähigkeiten-Knöpfe (bei Run-Start). */
  setAbilities(list: HudAbility[], showKeys: boolean): void {
    this.abilityBox.innerHTML = '';
    this.abilityButtons = list.map((a, i) => {
      const b = h('button', { class: 'ability-btn', attrs: { 'aria-label': a.name, title: a.name } }, [
        h('span', { class: 'ability-icon', text: a.icon }),
        ...(showKeys ? [h('span', { class: 'ability-key', text: a.key })] : []),
      ]);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onAbility(i);
      });
      this.abilityBox.appendChild(b);
      return b;
    });
  }

  /** Kurzes Aufploppen (CSS-Animation neu starten). */
  bump(el: HTMLElement): void {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  show(): void {
    this.el.classList.remove('hidden');
    this.lastPearls = 0;
    this.lastChain = -1;
    this.lastChests = -1;
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

    d.abilities.forEach((a, i) => {
      const b = this.abilityButtons[i];
      if (!b) return;
      b.style.setProperty('--cd', `${(a.cooldown * 360).toFixed(1)}deg`);
      b.classList.toggle('cooling', a.cooldown > 0);
      b.classList.toggle('active', a.active);
      b.classList.toggle('ready', a.cooldown <= 0 && a.usable);
    });

    setText(this.scoreEl, formatNumber(d.score));
    setText(this.pearlsEl, formatNumber(d.pearls));
    if (d.pearls > this.lastPearls) this.bump(this.pearlChip);
    this.lastPearls = d.pearls;
    if (d.chests !== this.lastChests) {
      this.chestChip.classList.toggle('hidden', d.chests === 0);
      setText(this.chestCount, String(d.chests));
      if (d.chests > this.lastChests) this.bump(this.chestChip);
      this.lastChests = d.chests;
    }

    // Perlenkette
    if (d.pearlChain !== this.lastChain) {
      this.chainEl.classList.toggle('hidden', d.pearlChain < 3);
      if (d.pearlChain >= 3) {
        setText(this.chainEl, `×${d.pearlChain}`);
        this.bump(this.chainEl);
      }
      this.lastChain = d.pearlChain;
    }

    // Power-ups
    for (const p of d.powerups) {
      let e = this.powerupEls.get(p.id);
      if (!e) {
        const bar = h('div', { class: 'pu-bar' });
        const el = h('div', { class: 'powerup-chip' }, [h('span', { class: 'pu-icon outlined', text: p.icon }), h('div', { class: 'pu-track' }, [bar])]);
        el.style.setProperty('--pu', p.color);
        this.powerupBox.appendChild(el);
        e = { el, bar };
        this.powerupEls.set(p.id, e);
      }
      e.bar.style.width = `${(clamp01(p.remaining) * 100).toFixed(1)}%`;
      e.el.classList.toggle('ending', p.remaining < 0.2);
    }
    for (const [id, e] of this.powerupEls) {
      if (!d.powerups.some((p) => p.id === id)) {
        e.el.remove();
        this.powerupEls.delete(id);
      }
    }

    this.speedLinesEl.style.opacity = d.speedLines.toFixed(2);

    // Welle von vorn → Durchstoß
    this.punchEl.classList.toggle('hidden', !d.punch.visible);
    this.punchEl.classList.toggle('go', d.punch.inWindow);
    if (d.punch.visible) {
      const near = d.punch.ring ? '↑ SPRING!' : '↑ SPRING – DURCHSTOSS!';
      const far = d.punch.ring ? (d.punch.label ?? 'Ringwelle!') : `Welle von vorn · ${Math.max(0, Math.round(d.punch.distance))} m`;
      setText(this.punchEl, d.punch.inWindow ? near : far);
    }

    // Endgegner
    this.bossEl.classList.toggle('hidden', !d.boss);
    if (d.boss) {
      setText(this.bossName, d.boss.name);
      this.bossFill.style.width = `${(d.boss.hp * 100).toFixed(1)}%`;
      // Verzögerter Balken zeigt, wie viel der letzte Treffer abgezogen hat
      this.bossHpShown = Math.max(d.boss.hp, this.bossHpShown - 0.004);
      this.bossLag.style.width = `${(this.bossHpShown * 100).toFixed(1)}%`;
      this.bossEl.classList.toggle('enraged', d.boss.enraged);
    } else {
      this.bossHpShown = 1;
    }

    // Weg zum Geysir
    this.geyserEl.classList.toggle('hidden', !d.geyser.visible);
    if (d.geyser.visible) {
      this.geyserArrow.style.transform = `rotate(${d.geyser.angle.toFixed(3)}rad)`;
      setText(this.geyserDist, `${Math.round(d.geyser.distance)} m`);
    }
    this.comboEl.classList.toggle('hidden', d.combo < 2);
    setText(this.comboEl, `Kombo ×${d.multiplier.toFixed(1).replace('.0', '')}`);

    // Tempo
    this.speedFill.style.width = `${(clamp01(d.speed / d.speedMax) * 100).toFixed(1)}%`;
    this.speedTick.style.left = `${((d.standSpeed / d.speedMax) * 100).toFixed(1)}%`;
    setText(this.speedLabel, `${Math.round(d.speed * 3.6)} km/h · ${d.walking ? 'Laufen' : d.standing ? 'Stehen' : 'Paddeln'}`);

    // Insel-Kompass
    this.arrow.style.transform = `rotate(${d.islandAngle.toFixed(3)}rad)`;
    setText(this.distEl, `${d.targetName ?? 'Insel'} ${formatNumber(d.islandDistance)} m`);
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
