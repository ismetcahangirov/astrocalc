import { describe, expect, it } from 'vitest';
import { arcanaColors } from './palette';

describe('arcanaColors', () => {
  it('gives every arcana 1–22 a distinct fill', () => {
    const fills = Array.from({ length: 22 }, (_, i) => arcanaColors(i + 1).fill);
    expect(fills.every((f) => /^#[0-9A-Fa-f]{6}$/.test(f))).toBe(true);
    expect(new Set(fills).size).toBe(22);
  });

  it('pairs a light fill with dark ink and dark fills with white ink', () => {
    // 18 (gold, the centre) is the one light fill and reads with dark ink.
    expect(arcanaColors(18).ink).toBe('#1A1206');
    // A representative saturated fill takes white ink.
    expect(arcanaColors(6).ink).toBe('#FFFFFF');
  });

  it('falls back safely for a value outside 1–22 rather than returning undefined', () => {
    const c = arcanaColors(0);
    expect(c.fill).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(c.ink).toBe('#FFFFFF');
    expect(arcanaColors(23).fill).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
