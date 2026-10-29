/**
 * Zeichenfenster: öffnet sich mittig beim Absprung (Zeitlupe läuft im Hintergrund),
 * zeigt die verbleibende Zeit und die möglichen Symbole.
 */
import type { SymbolDef } from '../data/types';
import type { StrokePoint } from '../input/InputManager';
import { h, strokeToSvg } from './dom';

export interface SymbolHint {
  symbol: SymbolDef;
  trickName: string;
  locked: boolean;
}

export class DrawingPanel {
  readonly el: HTMLDivElement;
  /** Fläche, auf der gezeichnet wird (wird an DrawSurface übergeben) */
  readonly surface: HTMLDivElement;
  readonly vignette: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly timerFill: HTMLDivElement;
  private readonly symbolsEl: HTMLDivElement;
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
    this.timerFill = h('div');
    this.symbolsEl = h('div', { class: 'symbols' });
    this.hintEl = h('div', { class: 'draw-hint outlined', text: 'Zeichne ein Symbol!' });
    this.surface = h('div', { class: 'canvas-wrap' }, [this.canvas, this.hintEl]);
    this.el = h('div', { class: 'draw-panel hidden' }, [h('div', { class: 'timer' }, [this.timerFill]), this.surface, this.symbolsEl]);
    parent.appendChild(this.el);
  }

  get isOpen(): boolean {
    return this.openFlag;
  }

  setSymbols(hints: SymbolHint[]): void {
    this.symbolsEl.innerHTML = '';
    this.symbolEls.clear();
    for (const s of hints) {
      const el = h('div', { class: `symbol ${s.locked ? 'locked' : ''}`, html: strokeToSvg(s.symbol.preview) }, [s.trickName]);
      this.symbolEls.set(s.symbol.id, el);
      this.symbolsEl.appendChild(el);
    }
  }

  open(duration: number): void {
    window.clearTimeout(this.closeTimer);
    this.duration = duration;
    this.remaining = duration;
    this.openFlag = true;
    document.body.classList.add('drawing');
    this.el.classList.remove('hidden', 'fail', 'success');
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
    this.timerFill.style.width = `${((this.remaining / this.duration) * 100).toFixed(1)}%`;
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
      [16, '#1d2140'],
      [9, this.color],
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
