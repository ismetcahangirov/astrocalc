import { parseIsoDate } from '../date-parsing';
import { reduceNumber, toSingleDigit } from './reduce';
import type { NumerologyNumber } from './types';

/**
 * The two four-part life cycles: Pinnacles (what each period offers) and
 * Challenges (what it demands).
 *
 * Both report an **age range** alongside the value, not just the number. The
 * whole point of these blocks is knowing which period you are in right now, and
 * a bare list of four numbers cannot answer that.
 */

/** The length of every Pinnacle after the first, in years. */
const PINNACLE_SPAN = 9;

/** The first Pinnacle ends at this age minus the single-digit Life Path. */
const FIRST_PINNACLE_ANCHOR = 36;

export interface LifePeriod {
  /** 1–4, in chronological order. */
  index: 1 | 2 | 3 | 4;
  /** Age this period begins, inclusive. */
  startAge: number;
  /** Age this period ends, inclusive — `null` for the final, open-ended one. */
  endAge: number | null;
}

export interface Pinnacle extends LifePeriod {
  number: NumerologyNumber;
}

export interface Challenge extends LifePeriod {
  /** 0–8. Zero is a genuine Challenge value, not a missing one. */
  value: number;
}

/** The reduced single-digit birth components both cycles are built from. */
function birthComponents(birthDate: string): { month: number; day: number; year: number } {
  const { year, month, day } = parseIsoDate(birthDate);
  return {
    month: toSingleDigit(month),
    day: toSingleDigit(day),
    year: toSingleDigit(year),
  };
}

/** The four age ranges both cycles share. */
function periodBounds(birthDate: string): [number, number | null][] {
  const { month, day, year } = birthComponents(birthDate);
  // The components are already single digits, so one more collapse of their
  // sum gives the Life Path digit the age anchor needs — masters included,
  // since the arithmetic has no room for an 11.
  const lifePathDigit = toSingleDigit(month + day + year);
  const firstEnd = FIRST_PINNACLE_ANCHOR - lifePathDigit;

  return [
    [0, firstEnd],
    [firstEnd + 1, firstEnd + PINNACLE_SPAN],
    [firstEnd + PINNACLE_SPAN + 1, firstEnd + 2 * PINNACLE_SPAN],
    [firstEnd + 2 * PINNACLE_SPAN + 1, null],
  ];
}

/**
 * The four Pinnacles with their age ranges.
 *
 * The first runs from birth to `36 − Life Path`, where the Life Path is
 * collapsed to a single digit even if it is a master number.
 */
export function pinnacles(birthDate: string): Pinnacle[] {
  const { month, day, year } = birthComponents(birthDate);

  const first = reduceNumber(month + day);
  const second = reduceNumber(day + year);
  const third = reduceNumber(first.value + second.value);
  const fourth = reduceNumber(month + year);

  const bounds = periodBounds(birthDate);

  return [first, second, third, fourth].map((number, i) => ({
    index: (i + 1) as 1 | 2 | 3 | 4,
    number,
    startAge: bounds[i]![0],
    endAge: bounds[i]![1],
  }));
}

/**
 * The four Challenges, sharing the Pinnacles' age ranges.
 *
 * Challenges are absolute differences, never reduced: the result is already
 * 0–8, and 0 carries its own meaning, so passing it through `reduceNumber`
 * would be both pointless and lossy.
 */
export function challenges(birthDate: string): Challenge[] {
  const { month, day, year } = birthComponents(birthDate);

  const first = Math.abs(month - day);
  const second = Math.abs(day - year);
  const third = Math.abs(first - second);
  const fourth = Math.abs(month - year);

  const bounds = periodBounds(birthDate);

  return [first, second, third, fourth].map((value, i) => ({
    index: (i + 1) as 1 | 2 | 3 | 4,
    value,
    startAge: bounds[i]![0],
    endAge: bounds[i]![1],
  }));
}

/** Which period (1–4) a given age falls in. Ages past the last range return 4. */
export function currentPeriodIndex(periods: LifePeriod[], age: number): 1 | 2 | 3 | 4 {
  for (const period of periods) {
    if (age >= period.startAge && (period.endAge === null || age <= period.endAge)) {
      return period.index;
    }
  }
  return 4;
}
