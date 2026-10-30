/**
 * Zeichenfenster: öffnet sich mittig beim Absprung (Zeitlupe läuft im Hintergrund),
 * zeigt die verbleibende Zeit und daneben die möglichen Tricks als Raster.
 * Das Raster wächst mit: bis 3 Tricks eine Reihe, dann 2, 3, 4 Reihen mit beliebig vielen Spalten
 * (Grenzen in CONFIG.hud.trickRowsUpTo). Ist ein Monster in der Nähe, zeigen Schilder seine
 * bekannten Schwächen (×1,5 grün, ×0,5 rot).
 */
import { CONFIG } from '../config/gameConfig';
import type { SymbolDef } from '../data/types';
import type { StrokePoint } from '../input/InputManager';
import { h, strokeToSvg } from './dom';

export interface SymbolHint {
  symbol: SymbolDef;
  trickName: string;
  locked: boolean;
  /** Farbe des Tricks (Rand der Karte) */
  color?: string;
}

export interface TrickTarget {
  name: string;
  /** Schwächen je Symbol-ID (nur bekannte; fehlt = normal) */
  multipliers: ReadonlyMap<string, number>;
  /** Schwächen noch unbekannt (Monster nie besiegt) */
  unknown: boolean;
}

/** Spalten und Reihen für n Tricks. */
export function trickGrid(n: number, rowsUpTo: readonly number[] = CONFIG.hud.trickRowsUpTo): { cols: number; rows: number } {
  if (n <= 0) return { cols: 1, rows: 1 };
  let rows = rowsUpTo.findIndex((max) => n <= max) + 1;
  if (rows === 0) rows = rowsUpTo.length + 1;
  return { cols: Math.ceil(n / rows), rows: Math.ceil(n / Math.ceil(n / rows)) };
}

export class DrawingPanel {
  readonly el: HTMLDivElement;
  /** Fläche, auf der gezeichnet wird (wird an DrawSurface übergeben) */
  readonly surface: HTMLDivElement;
  readonly vignette: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly timerEl: HTMLDivElement;
  private readonly timerFill: HTMLDivElement;
  private readonly symbolsEl: HTMLDivElement;
  private readonly headEl: HTMLDivElement;
  private readonly hintEl: HTMLDivElement;
  private symbolEls = new Map<string, HTMLDivElement>();
  private duration = 1;
  private remaining = 0;
  private openFlag = false;
  private closeTimer: number | undefined;
  private color = '#ffffff';

  constructor(parent: HTMLElement) {
    this.vignette = h('div', { class: 'vignette' });
    parent.appendChild(this.vignette);
    this.canvas = h('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.timerFill = h('div', { class: 'timer-fill' });
    this.timerEl = h('div', { class: 'timer' }, [this.timerFill]);
    this.symbolsEl = h('div', { class: 'symbols' });
    this.headEl = h('div', { class: 'tricks-head outlined', text: 'Tricks' });
    this.hintEl = h('div', { class: 'draw-hint outlined', text: 'Zeichne ein Symbol!' });
    this.surface = h('div', { class: 'canvas-wrap' }, [this.canvas, this.hintEl]);
    this.el = h('div', { class: 'draw-panel hidden' }, [
      h('div', { class: 'draw-main' }, [this.timerEl, this.surface]),
      h('div', { class: 'tricks-box' }, [this.headEl, this.symbolsEl]),
    ]);
    parent.appendChild(this.el);
  }

  get isOpen(): boolean {
    return this.openFlag;
  }

  setSymbols(hints: SymbolHint[]): void {
    this.symbolsEl.innerHTML = '';
    this.symbolEls.clear();
    const { cols, rows } = trickGrid(hints.length);
    this.symbolsEl.style.setProperty('--cols', String(cols));
    this.symbolsEl.style.setProperty('--rows', String(rows));
    this.el.classList.toggle('many', rows >= 3);
    for (const s of hints) {
      const el = h('div', { class: `symbol ${s.locked ? 'locked' : ''}` }, [
        h('div', { class: 'sym-icon', html: strokeToSvg(s.symbol.preview, '#ffffff', '#0f1330') }),
        h('div', { class: 'sym-name outlined', text: s.trickName }),
      ]);
      if (s.color) el.style.setProperty('--trick', s.color);
      this.symbolEls.set(s.symbol.id, el);
      this.symbolsEl.appendChild(el);
    }
  }

  /** Ziel in der Nähe: Name in der Kopfzeile, Schwächen als Schilder an den Karten. */
  setTarget(target: TrickTarget | null): void {
    this.headEl.textContent = target ? `Gegen ${target.name}` : 'Tricks';
    this.headEl.classList.toggle('target', !!target);
    for (const [id, el] of this.symbolEls) {
      el.querySelector('.sym-badge')?.remove();
      const m = target?.multipliers.get(id) ?? 1;
      el.classList.toggle('weak', m > 1);
      el.classList.toggle('resist', m < 1);
      if (m !== 1) el.appendChild(h('div', { class: `sym-badge outlined ${m > 1 ? 'up' : 'down'}`, text: `×${String(m).replace('.', ',')}` }));
    }
    if (target?.unknown) this.headEl.textContent += ' · ?';
  }

  open(duration: number): void {
    window.clearTimeout(this.closeTimer);
    this.duration = duration;
    this.remaining = duration;
    this.openFlag = true;
    document.body.classList.add('drawing');
    this.el.classList.remove('hidden', 'fail', 'success');
    this.timerEl.classList.remove('low', 'crit');
    this.vignette.classList.add('on');
    this.hintEl.classList.remove('hidden');
    this.symbolEls.forEach((e) => e.classList.remove('lit'));
    this.resize();
    this.clear();
  }

  /** Schließt das Fenster; optional mit Ergebnis-Rückmeldung. */
  close(result: { symbolId: string | null; color?: string } | null = null): void {
    if (!this.openFlag) return;
    this.openFlag = false;
    document.body.classList.remove('drawing');
    this.vignette.classList.remove('on');
    if (result?.symbolId) {
      this.el.classList.add('success');
      this.symbolEls.get(result.symbolId)?.classList.add('lit');
      this.closeTimer = window.setTimeout(() => this.el.classList.add('hidden'), 420);
    } else if (result) {
      this.el.classList.add('fail');
      this.closeTimer = window.setTimeout(() => this.el.classList.add('hidden'), 420);
    } else {
      this.el.classList.add('hidden');
    }
  }

  setStrokeColor(color: string): void {
    this.color = color;
  }

  /** Verbleibende Zeit (echte Sekunden) herunterzählen. */
  tick(realDt: number): void {
    if (!this.openFlag) return;
    this.remaining = Math.max(0, this.remaining - realDt);
    const f = this.remaining / this.duration;
    this.timerFill.style.width = `${(f * 100).toFixed(1)}%`;
    this.timerEl.classList.toggle('low', f < 0.5 && f >= 0.25);
    this.timerEl.classList.toggle('crit', f < 0.25);
  }

  /** Zeichnet den Strich (Punkte in Bildschirmkoordinaten). */
  drawStroke(points: readonly StrokePoint[]): void {
    this.hintEl.classList.add('hidden');
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / Math.max(1, rect.width);
    const sy = this.canvas.height / Math.max(1, rect.height);
    ctx.setTransform(sx, 0, 0, sy, -rect.left * sx, -rect.top * sy);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
    if (points.length < 2) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [width, color] of [
      [18, '#0f1330'],
      [10, this.color],
    ] as const) {
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(points[0]!.x, points[0]!.y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i]!.x, points[i]!.y);
      ctx.stroke();
    }
  }

  clear(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const hgt = this.canvas.clientHeight;
    if (w && hgt) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(hgt * dpr);
    }
  }
}
