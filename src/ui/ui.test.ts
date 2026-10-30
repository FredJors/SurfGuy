import { describe, expect, it } from 'vitest';
import { trickGrid } from './DrawingPanel';
import { Timeline } from './widgets';

describe('Trick-Raster', () => {
  it('6 Tricks = 3 über 3; wächst danach in Reihen und Spalten', () => {
    expect(trickGrid(3)).toEqual({ cols: 3, rows: 1 });
    expect(trickGrid(6)).toEqual({ cols: 3, rows: 2 });
    expect(trickGrid(8)).toEqual({ cols: 4, rows: 2 });
    expect(trickGrid(9)).toEqual({ cols: 3, rows: 3 });
    expect(trickGrid(12)).toEqual({ cols: 4, rows: 3 });
    expect(trickGrid(20)).toEqual({ cols: 5, rows: 4 });
    // jede Anzahl passt hinein, ohne eine ganze Reihe leer zu lassen
    for (let n = 1; n <= 40; n++) {
      const { cols, rows } = trickGrid(n);
      expect(cols * rows).toBeGreaterThanOrEqual(n);
      expect(cols * (rows - 1)).toBeLessThan(n);
    }
  });
});

describe('Zeitleiste (Spielende/Truhen)', () => {
  it('Überspringen führt alle offenen Schritte sofort und in Reihenfolge aus', () => {
    (globalThis as { window?: unknown }).window ??= globalThis;
    const tl = new Timeline();
    const seen: string[] = [];
    let finished = 0;
    tl.add(500, (instant) => seen.push(`b${instant ? '!' : ''}`));
    tl.add(100, (instant) => {
      seen.push(`a${instant ? '!' : ''}`);
      tl.track({ finish: () => finished++ });
    });
    tl.play();
    expect(tl.finished).toBe(false);
    tl.skip();
    expect(seen).toEqual(['a!', 'b!']);
    expect(finished).toBe(1);
    expect(tl.finished).toBe(true);
    // später gemeldete Animationen enden sofort
    tl.track({ finish: () => finished++ });
    expect(finished).toBe(2);
    tl.dispose();
  });
});
