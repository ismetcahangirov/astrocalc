import { parseIsoDate } from '../date-parsing';
import { digitSum, reduceToArcana, type Arcana } from './reduce';

/**
 * The core square of the octagram (#70): the four cardinal points derived from
 * the birth day, month and year, plus the centre.
 *
 * This is the part every Matrix screenshot shows and the part reference
 * calculators agree on most, which is why it is also where cross-validation has
 * the most value — see
 * `docs/superpowers/specs/2026-07-20-matrix-of-destiny-ladini-method.md` §2.
 *
 * ```
 *                     month
 *                       │
 *          day ──── centre ──── year
 *                       │
 *                      sum
 * ```
 */

/** The four cardinal points and the centre, all reduced into 1–22. */
export interface CoreSquare {
  /** West / left — the birth day, reduced. */
  day: Arcana;
  /** North / top — the birth month. 1–12, so it never actually reduces. */
  month: Arcana;
  /** East / right — the digit sum of the birth year, reduced. */
  year: Arcana;
  /** South / bottom — `day + month + year`, the "karmic tail". */
  sum: Arcana;
  /** The centre — `day + month + year + sum`, the "comfort zone". */
  centre: Arcana;
}

/**
 * Compute the core square from a civil birth date.
 *
 * **The two derived points are built from the already-reduced cardinals**, not
 * from the raw date. For 1987-01-29 that means `sum` is 11 + 1 + 7 = 19 — not
 * 29 + 1 + 25, and not a digit sum of the whole date string. This is the single
 * most common way to produce a Matrix that looks entirely plausible and is
 * wrong throughout, since every other position is derived from these five.
 *
 * Note also that `centre` is *not* `reduceToArcana(2 * (day + month + year))`,
 * tempting as that looks given `sum` is that same total: `sum` is reduced before
 * it enters `centre`, so the two expressions differ whenever the reduction
 * actually fires.
 *
 * @throws {CalcEngineError} `invalid_input` for a malformed or impossible date.
 */
export function computeCoreSquare(birthDate: string): CoreSquare {
  const date = parseIsoDate(birthDate);

  const day = reduceToArcana(date.day);
  const month = reduceToArcana(date.month);
  // The year is digit-summed *first* (1987 -> 25), then reduced (25 -> 7). The
  // year is the only input too large to reduce directly.
  const year = reduceToArcana(digitSum(date.year));
  const sum = reduceToArcana(day + month + year);
  const centre = reduceToArcana(day + month + year + sum);

  return { day, month, year, sum, centre };
}
