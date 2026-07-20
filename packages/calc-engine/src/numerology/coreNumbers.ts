import { parseIsoDate } from '../date-parsing';
import { letterValue, nameLetters, splitVowelsAndConsonants } from './alphabet';
import { reduceNumber } from './reduce';
import type { NumerologyNumber } from './types';

/**
 * The four numbers every numerology reading starts from: one from the birth
 * date, three from the birth name.
 */

/** Sum the Pythagorean values of a list of romanized letters. */
function sumLetters(letters: string[]): number {
  return letters.reduce((total, letter) => total + letterValue(letter), 0);
}

/**
 * Life Path — the birth date's number.
 *
 * Month, day and year are each reduced **separately** before being summed.
 * The alternative (digit-summing the whole date at once) yields the same
 * answer most of the time but silently loses master numbers and karmic debt
 * that only appear at the component level, so the two are not interchangeable.
 *
 * Only a debt in the **final** sum is reported. A component such as the year
 * 1990 may pass through 19 on its way to 1, but that debt belongs to the
 * component, not to the Life Path, so `.value` is taken and the rest discarded.
 */
export function lifePathNumber(birthDate: string): NumerologyNumber {
  const { year, month, day } = parseIsoDate(birthDate);

  const reducedMonth = reduceNumber(month).value;
  const reducedDay = reduceNumber(day).value;
  const reducedYear = reduceNumber(year).value;

  return reduceNumber(reducedMonth + reducedDay + reducedYear);
}

/** The three raw letter sums a name yields, before any reduction. */
export interface NameSums {
  /** Sum over every letter — the Expression input. */
  letterSum: number;
  /** Sum over the vowels only — the Soul Urge input. */
  vowelSum: number;
  /** Sum over the consonants only — the Personality input. */
  consonantSum: number;
}

/**
 * Compute all three letter sums for a name in one pass.
 *
 * Exposed separately so the assembly step can parse and partition a name once
 * rather than three times, and so a test can assert the partition is exact
 * (`vowelSum + consonantSum === letterSum`) without reaching into internals.
 */
export function nameSums(fullName: string): NameSums {
  const letters = nameLetters(fullName);
  const { vowels, consonants } = splitVowelsAndConsonants(letters);

  return {
    letterSum: sumLetters(letters),
    vowelSum: sumLetters(vowels),
    consonantSum: sumLetters(consonants),
  };
}

/** Expression (Destiny) — every letter of the full birth name. */
export function expressionNumber(fullName: string): NumerologyNumber {
  return reduceNumber(nameSums(fullName).letterSum);
}

/** Soul Urge (Heart's Desire) — the vowels of the full birth name. */
export function soulUrgeNumber(fullName: string): NumerologyNumber {
  return reduceNumber(nameSums(fullName).vowelSum);
}

/** Personality — the consonants of the full birth name. */
export function personalityNumber(fullName: string): NumerologyNumber {
  return reduceNumber(nameSums(fullName).consonantSum);
}
