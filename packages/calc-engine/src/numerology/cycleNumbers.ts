import { parseIsoDate } from '../date-parsing';
import { reduceNumber, toSingleDigit } from './reduce';
import type { NumerologyNumber } from './types';

/**
 * Numbers beyond the core four: one more fixed number from the birth date, one
 * derived from the core four, and the two that move with the calendar.
 *
 * Personal Year and Personal Month depend on "now", which would make them the
 * only impure functions in the domain. They take the reference date as an
 * **explicit required parameter** instead — so they stay pure and testable, and
 * the caller decides which timezone "today" is read in. The backend passes the
 * user's local date; a test passes a fixed one.
 */

/** Birthday — the day of the month, deliberately left unreduced (1–31). */
export function birthdayNumber(birthDate: string): number {
  return parseIsoDate(birthDate).day;
}

/** Maturity — Life Path plus Expression, reduced. */
export function maturityNumber(
  lifePath: Pick<NumerologyNumber, 'value'>,
  expression: Pick<NumerologyNumber, 'value'>,
): NumerologyNumber {
  return reduceNumber(lifePath.value + expression.value);
}

/**
 * Personal Year — birth month + birth day + the reference year.
 *
 * Returns a plain 1–9 digit rather than a {@link NumerologyNumber}: a cycle
 * position is a slot in a repeating nine-year rhythm, so a master number there
 * would have nowhere to point. Masters are reduced away.
 */
export function personalYearNumber(birthDate: string, referenceDate: string): number {
  const birth = parseIsoDate(birthDate);
  const reference = parseIsoDate(referenceDate);

  const sum = toSingleDigit(birth.month) + toSingleDigit(birth.day) + toSingleDigit(reference.year);
  return toSingleDigit(sum);
}

/** Personal Month — the Personal Year plus the reference month. */
export function personalMonthNumber(birthDate: string, referenceDate: string): number {
  const reference = parseIsoDate(referenceDate);
  const year = personalYearNumber(birthDate, referenceDate);
  return toSingleDigit(year + toSingleDigit(reference.month));
}
