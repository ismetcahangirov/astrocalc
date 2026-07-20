import { CalcEngineError } from '../errors';

/**
 * The arithmetic every Matrix of Destiny position is built on: reduction into
 * the 1–22 Major Arcana range.
 *
 * This is *not* the numerology reduction in `../numerology/reduce.ts`, and the
 * two must not be merged. Numerology reduces to a single digit while preserving
 * the master numbers 11/22/33; the Matrix reduces to 1–22 and has no concept of
 * a master number, because 22 is simply the top of its range rather than a
 * special case. They share only the digit-sum helper's shape.
 *
 * **The reduction rule is a genuine fork between schools**, and picking the
 * wrong branch silently changes roughly half the octagram. Two rules are in
 * circulation for a sum above 22:
 *
 * 1. **Repeated digit-summing** — 29 → 2+9 = 11. This is the classical Natalia
 *    Ladini rule, and the one this engine implements (see
 *    `docs/superpowers/specs/2026-07-20-matrix-of-destiny-ladini-method.md`).
 * 2. **Subtracting 22** — 29 → 29 − 22 = 7. A documented non-Ladini variant.
 *
 * The two agree only by coincidence. They are not interchangeable, and a result
 * computed under one is not a "rounding difference" from the other — it is a
 * different chart. Since the app commits to Ladini (issue #67), rule 1 is the
 * only one implemented here; the divergence is recorded rather than supported,
 * because offering both would mean shipping two incompatible answers with no
 * basis for choosing between them.
 */

/** How many Major Arcana the Matrix reduces into. */
export const ARCANA_COUNT = 22;

/**
 * A Major Arcana number, 1–22.
 *
 * Spelled out as a literal union rather than aliased to `number` so an
 * out-of-range value is a compile error at every position in
 * {@link DestinyMatrix}, not something only {@link assertArcana} would catch at
 * runtime. That matters here more than it would for a numerology value: the
 * Matrix is a web of ~30 interdependent positions, and one position typed as a
 * bare `number` would quietly widen every sum derived from it.
 */
export type Arcana =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22;

/** Every Major Arcana in order, 1–22 — the enumeration order for content keys. */
export const ARCANA_VALUES: readonly Arcana[] = Array.from(
  { length: ARCANA_COUNT },
  (_, i) => (i + 1) as Arcana,
);

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

/** Whether a value is a valid Major Arcana number. */
export function isArcana(value: number): value is Arcana {
  return Number.isInteger(value) && value >= 1 && value <= ARCANA_COUNT;
}

/**
 * Narrow a number to {@link Arcana}, or throw.
 *
 * Every position in this module is produced by {@link reduceToArcana}, which
 * cannot return anything else — so this is a guard against a *future* position
 * being written that skips the reduction, not against user input. It is
 * deliberately kept even though it is unreachable today: an unreduced value
 * leaking into the result is exactly the kind of bug that would look plausible
 * on screen (a "23rd arcana" reads as a number, not as an error) and would only
 * surface as a missing interpretation row much later.
 */
export function assertArcana(value: number, label: string): Arcana {
  if (!isArcana(value)) {
    throw new CalcEngineError(
      'invalid_input',
      `${label} must be an arcana within [1, ${ARCANA_COUNT}], got ${value}`,
    );
  }
  return value;
}

/**
 * Reduce a positive sum into the 1–22 arcana range by repeated digit-summing.
 *
 * Note what this function does *not* do, both of which are load-bearing:
 *
 * - It never reduces a value that is already 1–22. A birth day of 22 stays 22;
 *   a day of 11 stays 11. The range's ceiling is a stopping point, not a
 *   number to be reduced past.
 * - It can never return 0. Digit-summing a positive integer always yields a
 *   positive integer, and the loop stops at 22, so the "is 22 the same as 0?"
 *   question some sources raise never arises here — 0 is simply not in the
 *   codomain. (It *would* arise under the subtract-22 rule, where 22 − 22 = 0;
 *   another reason that rule is not implemented.)
 *
 * @throws {CalcEngineError} `invalid_input` for a non-integer or a value below 1.
 */
export function reduceToArcana(sum: number): Arcana {
  if (!Number.isInteger(sum) || sum < 1) {
    throw new CalcEngineError('invalid_input', `expected a positive integer, got: ${sum}`);
  }

  let current = sum;
  while (current > ARCANA_COUNT) current = digitSum(current);
  return current as Arcana;
}

/** Reduce the sum of several already-reduced arcana into one — the shape almost every position takes. */
export function sumArcana(...values: number[]): Arcana {
  return reduceToArcana(values.reduce((total, value) => total + value, 0));
}
