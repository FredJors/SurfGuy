import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../config/gameConfig';
import { SYMBOLS } from '../../data/symbols';
import type { Point2 } from '../../data/types';
import { Rng } from '../../core/Rng';
import { DollarOneRecognizer, type Pt } from './DollarOne';
import { circle, lightning, spiral, zigzag } from './shapes';

function makeRecognizer(): DollarOneRecognizer {
  const r = new DollarOneRecognizer();
  for (const s of SYMBOLS) for (const t of s.templates) r.addTemplate(s.id, t);
  return r;
}

/** Simuliert eine menschliche Zeichnung: Rotation, Skalierung, Verzerrung, Zittern, ungleichmäßige Abtastung. */
function humanize(stroke: readonly Point2[], rng: Rng, jitter = 3.5): Pt[] {
  const rot = rng.range(-0.3, 0.3);
  const sx = rng.range(1.2, 3.2);
  const sy = sx * rng.range(0.75, 1.3);
  const ox = rng.range(0, 300);
  const oy = rng.range(0, 200);
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const out: Pt[] = [];
  let wobblePhase = rng.range(0, 6);
  for (const p of stroke) {
    if (rng.chance(0.25)) continue; // ungleichmäßige Abtastung
    wobblePhase += 0.3;
    const x = (p.x - 50) * sx;
    const y = (p.y - 50) * sy;
    out.push({
      x: ox + x * cos - y * sin + rng.range(-jitter, jitter) + Math.sin(wobblePhase) * 2,
      y: oy + x * sin + y * cos + rng.range(-jitter, jitter) + Math.cos(wobblePhase * 1.3) * 2,
    });
  }
  return out;
}

const cases: [string, (rng: Rng) => Point2[]][] = [
  ['circle', (rng) => circle(rng.chance(0.5), rng.range(-180, 180), 40, rng.range(0.95, 1.1))],
  ['spiral', (rng) => spiral(rng.chance(0.5), rng.chance(0.7), rng.range(1.8, 2.8), rng.range(-180, 180))],
  ['zigzag', (rng) => (rng.chance(0.5) ? zigzag(rng.pick([2, 2.5, 3]), rng.chance(0.5), rng.chance(0.5)) : lightning(rng.chance(0.5)))],
];

describe('$1-Erkennung', () => {
  const recognizer = makeRecognizer();

  for (const [expected, gen] of cases) {
    it(`erkennt "${expected}" zuverlässig (≥ 95 %)`, () => {
      const rng = new Rng(1234 + expected.length);
      const n = 200;
      let correct = 0;
      let accepted = 0;
      for (let i = 0; i < n; i++) {
        const res = recognizer.recognize(humanize(gen(rng), rng));
        if (res.symbolId === expected) correct++;
        if (res.symbolId === expected && res.score >= CONFIG.trick.quality.okay) accepted++;
      }
      expect(correct / n).toBeGreaterThanOrEqual(0.95);
      expect(accepted / n).toBeGreaterThanOrEqual(0.9);
    });
  }

  it('saubere Vorlagen ergeben "Perfekt"', () => {
    const res = recognizer.recognize(circle(true, -45).map((p) => ({ x: p.x * 2, y: p.y * 2 })));
    expect(res.symbolId).toBe('circle');
    expect(res.score).toBeGreaterThanOrEqual(CONFIG.trick.quality.perfect);
  });

  it('lehnt Gekritzel und gerade Linien ab', () => {
    const rng = new Rng(99);
    let rejected = 0;
    const n = 100;
    for (let i = 0; i < n; i++) {
      const pts: Pt[] = [];
      let x = 100;
      let y = 100;
      for (let k = 0; k < 30; k++) {
        x += rng.range(-40, 40);
        y += rng.range(-40, 40);
        pts.push({ x, y });
      }
      const res = recognizer.recognize(pts);
      if (res.score < CONFIG.trick.quality.okay) rejected++;
    }
    expect(rejected / n).toBeGreaterThanOrEqual(0.8);

    const line = recognizer.recognize(Array.from({ length: 20 }, (_, i) => ({ x: i * 10, y: 100 + i * 0.5 })));
    expect(line.score).toBeLessThan(CONFIG.trick.quality.okay);
  });

  it('ignoriert zu kurze Striche', () => {
    expect(recognizer.recognize([{ x: 0, y: 0 }, { x: 2, y: 2 }]).symbolId).toBeNull();
  });
});
