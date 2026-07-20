import { CalcEngineError } from './errors';

/**
 * Strict civil-date parsing shared by every domain that takes a birth date.
 *
 * Calendar-aware: it rejects `2023-02-30` and `2023-02-29`, not just malformed
 * strings, so a bad date fails at the boundary rather than silently rolling
 * over into the next month inside a later calculation.
 */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days in each month; February is corrected for leap years at call time. */
const DAYS_IN_MONTH: readonly number[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Parse a strict `YYYY-MM-DD` date, or throw `CalcEngineError('invalid_input')`. */
export function parseIsoDate(value: string): CalendarDate {
  const match = typeof value === 'string' ? DATE_PATTERN.exec(value) : null;
  if (!match) {
    throw new CalcEngineError('invalid_input', `date must be 'YYYY-MM-DD', got: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12) {
    throw new CalcEngineError('invalid_input', `month must be within [1, 12], got: ${value}`);
  }

  const maxDay = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1]!;
  if (day < 1 || day > maxDay) {
    throw new CalcEngineError('invalid_input', `day must be within [1, ${maxDay}], got: ${value}`);
  }

  return { year, month, day };
}
