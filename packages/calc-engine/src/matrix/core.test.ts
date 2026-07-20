import { describe, expect, it } from 'vitest';
import { CalcEngineError } from '../errors';
import { computeCoreSquare } from './core';
import { isArcana } from './reduce';

describe('computeCoreSquare', () => {
  it('reduces the day, keeps the month, and digit-sums the year', () => {
    const core = computeCoreSquare('1987-01-29');
    expect(core.day).toBe(11); // 29 -> 2+9
    expect(core.month).toBe(1);
    expect(core.year).toBe(7); // 1987 -> 25 -> 7
  });

  it('derives the sum from the REDUCED cardinals, not the raw date', () => {
    // The load-bearing detail. 11 + 1 + 7 = 19. Deriving from the raw values
    // would give 29 + 1 + 1987 (or 29 + 1 + 25 = 55 -> 10) — a different, and
    // entirely plausible-looking, Matrix.
    expect(computeCoreSquare('1987-01-29').sum).toBe(19);
  });

  it('derives the centre from the reduced sum, not from twice the cardinal total', () => {
    // centre = day + month + year + sum, with `sum` already reduced.
    // 1990-11-22: 22+11+19 = 52 -> 7, so centre = 22+11+19+7 = 59 -> 14.
    // The tempting `2 * (22+11+19) = 104 -> 5` is a different number.
    const core = computeCoreSquare('1990-11-22');
    expect(core.sum).toBe(7);
    expect(core.centre).toBe(14);
  });

  it('keeps a birth day of exactly 22 as arcana 22', () => {
    expect(computeCoreSquare('1990-11-22').day).toBe(22);
  });

  it('keeps a year whose digit sum is exactly 22', () => {
    // 1975 -> 1+9+7+5 = 22, at the boundary and therefore not reduced further.
    expect(computeCoreSquare('1975-08-30').year).toBe(22);
  });

  it('reduces a two-pass year', () => {
    // 1999 -> 28 -> 10 needs the loop, not a single digit sum.
    expect(computeCoreSquare('1999-03-15').year).toBe(10);
  });

  it('never leaves the month unreduced-but-out-of-range', () => {
    // Months are 1-12, so this can never fire — asserted so the claim in the
    // doc comment is checked rather than asserted.
    for (let month = 1; month <= 12; month++) {
      const iso = `1990-${String(month).padStart(2, '0')}-15`;
      expect(computeCoreSquare(iso).month).toBe(month);
    }
  });

  it('produces only valid arcana across an exhaustive sweep of 1900-2030', () => {
    for (let year = 1900; year <= 2030; year++) {
      for (let month = 1; month <= 12; month++) {
        // 28 keeps every month legal without a calendar table; the day range's
        // own edges (29-31) are covered by the fixtures and the reduce suite.
        for (const day of [1, 9, 22, 28]) {
          const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const core = computeCoreSquare(iso);
          for (const [name, value] of Object.entries(core)) {
            expect(isArcana(value), `${iso} ${name} = ${value}`).toBe(true);
          }
        }
      }
    }
  });

  it.each(['1990-13-01', '1990-02-30', 'not-a-date', '1990-5-1'])('rejects %s', (bad) => {
    expect(() => computeCoreSquare(bad)).toThrow(CalcEngineError);
  });
});
