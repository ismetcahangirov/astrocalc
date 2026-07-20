import { describe, expect, it } from 'vitest';
import { CalcEngineError } from '../errors';
import { digitSum, reduceNumber, toSingleDigit } from './reduce';

describe('digitSum', () => {
  it('sums the decimal digits', () => {
    expect(digitSum(1990)).toBe(19);
    expect(digitSum(7)).toBe(7);
    expect(digitSum(0)).toBe(0);
  });
});

describe('reduceNumber', () => {
  it('reduces to a single digit', () => {
    // 1990 -> 19 -> 10 -> 1: passes through 19, itself a karmic-debt number,
    // so it must be recorded (see the karmic-debt tests below).
    expect(reduceNumber(1990)).toEqual({ value: 1, isMaster: false, karmicDebt: 19 });
    expect(reduceNumber(7)).toEqual({ value: 7, isMaster: false, karmicDebt: null });
  });

  it('preserves master numbers instead of reducing them', () => {
    expect(reduceNumber(11)).toEqual({ value: 11, isMaster: true, karmicDebt: null });
    expect(reduceNumber(22)).toEqual({ value: 22, isMaster: true, karmicDebt: null });
    expect(reduceNumber(33)).toEqual({ value: 33, isMaster: true, karmicDebt: null });
  });

  it('reduces master numbers when asked to', () => {
    expect(reduceNumber(11, { preserveMasters: false })).toEqual({
      value: 2,
      isMaster: false,
      karmicDebt: null,
    });
  });

  it('records karmic debt seen during reduction, then keeps reducing', () => {
    expect(reduceNumber(13)).toEqual({ value: 4, isMaster: false, karmicDebt: 13 });
    expect(reduceNumber(14)).toEqual({ value: 5, isMaster: false, karmicDebt: 14 });
    expect(reduceNumber(16)).toEqual({ value: 7, isMaster: false, karmicDebt: 16 });
    expect(reduceNumber(19)).toEqual({ value: 1, isMaster: false, karmicDebt: 19 });
  });

  it('records karmic debt reached at an intermediate step, not just the first sum', () => {
    // 49 -> 13 -> 4: the debt is only visible mid-reduction.
    expect(reduceNumber(49)).toEqual({ value: 4, isMaster: false, karmicDebt: 13 });
  });

  it('reports no debt for two-digit sums that are not debt numbers', () => {
    expect(reduceNumber(12).karmicDebt).toBeNull();
    expect(reduceNumber(15).karmicDebt).toBeNull();
  });

  it('leaves single-digit input untouched', () => {
    for (let n = 0; n <= 9; n++) {
      expect(reduceNumber(n)).toEqual({ value: n, isMaster: false, karmicDebt: null });
    }
  });

  it('rejects negative or non-integer input', () => {
    expect(() => reduceNumber(-1)).toThrow(CalcEngineError);
    expect(() => reduceNumber(1.5)).toThrow(CalcEngineError);
    expect(() => reduceNumber(Number.NaN)).toThrow(CalcEngineError);
  });
});

describe('toSingleDigit', () => {
  it('always collapses to 0-9, masters included', () => {
    expect(toSingleDigit(11)).toBe(2);
    expect(toSingleDigit(22)).toBe(4);
    expect(toSingleDigit(33)).toBe(6);
    expect(toSingleDigit(1990)).toBe(1);
    expect(toSingleDigit(0)).toBe(0);
  });

  it('rejects negative or non-integer input', () => {
    expect(() => toSingleDigit(-5)).toThrow(CalcEngineError);
  });
});
