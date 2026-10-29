import { describe, expect, it } from 'vitest';
import { createRegistries, validateContent } from './index';

describe('Inhalte', () => {
  it('alle Querverweise sind gültig', () => {
    const c = createRegistries();
    expect(validateContent(c, ['kraken'])).toEqual([]);
  });

  it('enthält die Meilenstein-1-Tricks', () => {
    const c = createRegistries();
    expect(c.tricks.get('salto').symbols).toContain('circle');
    expect(c.tricks.get('board_spin').symbols).toContain('spiral');
    expect(c.tricks.get('board_slam').symbols).toContain('zigzag');
  });
});
