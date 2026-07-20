import { CalcEngineError } from '../errors';
import type { NumerologyNumber } from './types';

/**
 * The arithmetic every numerology number is built on: repeated digit-summing
 * down to a single digit, with two exceptions that carry meaning.
 *
 * **Master numbers** (11, 22, 33) stop the reduction — an 11 Life Path is not a
 * 2. **Karmic-debt numbers** (13, 14, 16, 19) do not stop it, but are recorded:
 * a 13 still reduces to 4, and the reading needs to know it arrived there via
 * 13 rather than via 22 or 40.
 */

/** The master numbers, which reduction stops at rather than passing through. */
export const MASTER_NUMBERS: readonly number[] = [11, 22, 33];

/** The karmic-debt numbers, recorded when passed through during reduction. */
export const KARMIC_DEBT_NUMBERS: readonly number[] = [13, 14, 16, 19];

export interface ReduceOptions {
  /**
   * Stop at 11/22/33 instead of reducing them. Defaults to `true`.
   * Set `false` where a plain digit is required — Pinnacle age ranges and
   * Challenge differences, which are arithmetic inputs rather than readings.
   */
  preserveMasters?: boolean;
}

/** Sum the decimal digits of a non-negative integer. */
export function digitSum(n: number): number {
  let total = 0;
  let remaining = n;
  while (remaining > 0) {
    total += remaining % 10;
    remaining = Math.floor(remaining / 10);
  }
  return total;
}

function assertNonNegativeInteger(n: number): void {
  if (!Number.isInteger(n) || n < 0) {
    throw new CalcEngineError('invalid_input', `expected a non-negative integer, got: ${n}`);
  }
}

/**
 * Reduce a raw sum to its numerology value, preserving master numbers and
 * recording any karmic debt passed through.
 *
 * The first debt number encountered wins — reduction is monotonically
 * decreasing, so at most one debt number can appear on any path anyway.
 */
export function reduceNumber(sum: number, options: ReduceOptions = {}): NumerologyNumber {
  assertNonNegativeInteger(sum);
  const { preserveMasters = true } = options;

  let current = sum;
  let karmicDebt: number | null = null;

  while (current > 9) {
    if (preserveMasters && MASTER_NUMBERS.includes(current)) break;
    if (karmicDebt === null && KARMIC_DEBT_NUMBERS.includes(current)) karmicDebt = current;
    current = digitSum(current);
  }

  return {
    value: current,
    isMaster: preserveMasters && MASTER_NUMBERS.includes(current),
    karmicDebt,
  };
}

/**
 * Collapse a value to a single digit 0–9, ignoring master numbers entirely.
 * Used where the number is an arithmetic operand rather than a reading.
 */
export function toSingleDigit(n: number): number {
  assertNonNegativeInteger(n);
  let current = n;
  while (current > 9) current = digitSum(current);
  return current;
}
