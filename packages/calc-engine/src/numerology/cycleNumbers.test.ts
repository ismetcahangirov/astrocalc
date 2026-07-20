import { describe, expect, it } from 'vitest';
import { CalcEngineError } from '../errors';
import {
  birthdayNumber,
  maturityNumber,
  personalMonthNumber,
  personalYearNumber,
} from './cycleNumbers';

describe('birthdayNumber', () => {
  it('is the day of the month, never reduced', () => {
    expect(birthdayNumber('1990-03-07')).toBe(7);
    expect(birthdayNumber('1990-03-29')).toBe(29);
    expect(birthdayNumber('1990-03-31')).toBe(31);
  });
});

describe('maturityNumber', () => {
  it('reduces the sum of Life Path and Expression', () => {
    // 11 + 8 = 19 -> debt 19 -> 10 -> 1.
    expect(maturityNumber({ value: 11 }, { value: 8 })).toEqual({
      value: 1,
      isMaster: false,
      karmicDebt: 19,
    });
  });

  it('can itself be a master number', () => {
    // 5 + 6 = 11.
    expect(maturityNumber({ value: 5 }, { value: 6 })).toEqual({
      value: 11,
      isMaster: true,
      karmicDebt: null,
    });
  });

  it('can reach 33, the highest master', () => {
    // 11 + 22 = 33.
    expect(maturityNumber({ value: 11 }, { value: 22 }).value).toBe(33);
  });
});

describe('personalYearNumber', () => {
  it('sums the birth month, birth day and the reference year', () => {
    // Birth 1990-03-07, reference 2026: 3 + 7 + (2026 -> 10 -> 1) = 11 -> 2.
    expect(personalYearNumber('1990-03-07', '2026-07-20')).toBe(2);
  });

  it('changes with the reference year', () => {
    expect(personalYearNumber('1990-03-07', '2027-01-01')).not.toBe(
      personalYearNumber('1990-03-07', '2026-07-20'),
    );
  });

  it('ignores the reference day and month', () => {
    expect(personalYearNumber('1990-03-07', '2026-01-01')).toBe(
      personalYearNumber('1990-03-07', '2026-12-31'),
    );
  });

  it('always lands in 1-9', () => {
    for (let year = 2020; year <= 2035; year++) {
      const value = personalYearNumber('1990-03-07', `${year}-06-15`);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(9);
    }
  });

  it('rejects a malformed reference date', () => {
    expect(() => personalYearNumber('1990-03-07', 'July 2026')).toThrow(CalcEngineError);
  });
});

describe('personalMonthNumber', () => {
  it('adds the reference month to the personal year', () => {
    // Personal Year 2 + month 7 = 9.
    expect(personalMonthNumber('1990-03-07', '2026-07-20')).toBe(9);
  });

  it('always lands in 1-9 across a full calendar year', () => {
    for (let month = 1; month <= 12; month++) {
      const ref = `2026-${String(month).padStart(2, '0')}-15`;
      const value = personalMonthNumber('1990-03-07', ref);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(9);
    }
  });
});
