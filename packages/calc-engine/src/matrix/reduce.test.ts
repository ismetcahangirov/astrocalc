import { describe, expect, it } from 'vitest';
import { CalcEngineError } from '../errors';
import {
  ARCANA_COUNT,
  ARCANA_VALUES,
  assertArcana,
  digitSum,
  isArcana,
  reduceToArcana,
  sumArcana,
} from './reduce';

describe('digitSum', () => {
  it.each([
    [0, 0],
    [7, 7],
    [10, 1],
    [29, 11],
    [52, 7],
    [59, 14],
    [88, 16],
    [1990, 19],
    [1987, 25],
  ])('digitSum(%i) = %i', (input, expected) => {
    expect(digitSum(input)).toBe(expected);
  });
});

describe('reduceToArcana', () => {
  it('leaves every value already within 1–22 untouched', () => {
    for (const value of ARCANA_VALUES) {
      expect(reduceToArcana(value)).toBe(value);
    }
  });

  it('keeps 22 as 22 rather than reducing or zeroing it', () => {
    // The boundary is a strict `> 22`. Both alternatives are things real
    // sources do: reducing would give 4, and the rejected subtract-22 rule
    // would give 0. See the method spec, §1.
    expect(reduceToArcana(22)).toBe(22);
  });

  it.each([
    [23, 5],
    [24, 6],
    [25, 7],
    [26, 8],
    [27, 9],
    [28, 10],
    [29, 11],
    [30, 3],
    [31, 4],
  ])('reduces a birth day of %i to arcana %i', (day, expected) => {
    expect(reduceToArcana(day)).toBe(expected);
  });

  it('is not monotonic across the day range, and that is correct', () => {
    // Day 30 gives a *lower* arcana than day 29 (3 vs 11), because 3+0 < 2+9.
    // Asserted explicitly so nobody "fixes" it into an ordering.
    expect(reduceToArcana(30)).toBeLessThan(reduceToArcana(29));
  });

  it.each([
    [33, 6],
    [38, 11],
    [41, 5],
    [45, 9],
    [52, 7],
    [59, 14],
    [88, 16],
  ])('reduces the derived sum %i to %i', (sum, expected) => {
    expect(reduceToArcana(sum)).toBe(expected);
  });

  it('never returns a value outside 1–22, for every sum the Matrix can reach', () => {
    // 88 is the ceiling: four arcana of 22, which is `centre` and
    // `ancestralCentre`'s worst case.
    for (let n = 1; n <= 88; n++) {
      const result = reduceToArcana(n);
      expect(isArcana(result)).toBe(true);
    }
  });

  it('never returns 19–22 for an input above 22', () => {
    // A structural invariant from the method spec (§1): the largest digit sum
    // of a two-digit number is 18, so the top four arcana can only ever appear
    // when the raw value was already within range. Worth pinning down — it is
    // the property that makes a single-pass digit sum accidentally equivalent
    // to a looped one for this input range, and a future reader comparing this
    // engine against a single-pass reference implementation needs to know why
    // the two agree.
    for (let n = 23; n <= 88; n++) {
      expect(reduceToArcana(n)).toBeLessThanOrEqual(18);
    }
  });

  it('never returns 0, for any reachable input', () => {
    for (let n = 1; n <= 200; n++) {
      expect(reduceToArcana(n)).toBeGreaterThan(0);
    }
  });

  it('loops rather than digit-summing once, for values a single pass would miss', () => {
    // Unreachable through the Matrix's own arithmetic, but the loop is what
    // makes the function correct as written rather than correct by accident:
    // 9999 -> 36 -> 9 needs two passes.
    expect(reduceToArcana(9999)).toBe(9);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects %s', (value) => {
    expect(() => reduceToArcana(value)).toThrow(CalcEngineError);
  });
});

describe('sumArcana', () => {
  it('sums then reduces, rather than reducing then summing', () => {
    // 22 + 11 = 33 -> 6. Reducing each operand first would leave 22 + 11
    // unchanged and give a different answer.
    expect(sumArcana(22, 11)).toBe(6);
  });

  it('handles the four-operand case the two centres use', () => {
    expect(sumArcana(6, 3, 8, 11)).toBe(10);
  });
});

describe('isArcana', () => {
  it.each([1, 11, 22])('accepts %i', (value) => {
    expect(isArcana(value)).toBe(true);
  });

  it.each([0, 23, -1, 1.5])('rejects %s', (value) => {
    expect(isArcana(value)).toBe(false);
  });
});

describe('assertArcana', () => {
  it('returns the value when it is in range', () => {
    expect(assertArcana(22, 'centre')).toBe(22);
  });

  it('names the offending position in the message', () => {
    expect(() => assertArcana(23, 'centre')).toThrow(/centre/);
  });
});

describe('ARCANA_VALUES', () => {
  it('enumerates 1–22 in order', () => {
    expect(ARCANA_VALUES).toHaveLength(ARCANA_COUNT);
    expect(ARCANA_VALUES[0]).toBe(1);
    expect(ARCANA_VALUES[ARCANA_COUNT - 1]).toBe(22);
  });
});
