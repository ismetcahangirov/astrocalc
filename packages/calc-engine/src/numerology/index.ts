import { CalcEngineError } from '../errors';
import { parseIsoDate } from '../date-parsing';
import { lifePathNumber, nameSums } from './coreNumbers';
import {
  birthdayNumber,
  maturityNumber,
  personalMonthNumber,
  personalYearNumber,
} from './cycleNumbers';
import {
  challenges,
  currentPeriodIndex,
  pinnacles,
  type Challenge,
  type Pinnacle,
} from './periods';
import { reduceNumber } from './reduce';
import type { NumerologyNumber } from './types';

/**
 * Numerology assembly: the single, platform-independent function that turns a
 * name and a birth date into a full profile.
 *
 * Mirrors `computeNatalChart()` — one composition point, plain JSON out, no
 * Node built-ins, so the backend and the device compute identical results.
 *
 * Deliberately *not* included here: interpretation / reading text. That is
 * Pro-only data that stays behind the backend (spec §5.1), so it is never part
 * of the on-device calculation.
 */

/** Version of the {@link NumerologyProfile} shape, bumped on any breaking change. */
export const NUMEROLOGY_SCHEMA_VERSION = 1;

export interface NumerologyInput {
  /** Full birth name. Romanized internally, so any supported alphabet works. */
  fullName: string;
  /** Civil birth date, `YYYY-MM-DD`. */
  birthDate: string;
  /**
   * The date the cycle numbers and the current-period markers are computed
   * for, `YYYY-MM-DD`. Required rather than defaulted to "today" so this
   * function stays pure and the caller controls the timezone.
   */
  referenceDate: string;
}

export interface NumerologyProfile {
  schemaVersion: number;
  lifePath: NumerologyNumber;
  expression: NumerologyNumber;
  soulUrge: NumerologyNumber;
  personality: NumerologyNumber;
  /** Day of the month, 1–31, unreduced. */
  birthday: number;
  maturity: NumerologyNumber;
  /** Cycle position, 1–9. */
  personalYear: number;
  /** Cycle position, 1–9. */
  personalMonth: number;
  pinnacles: Pinnacle[];
  challenges: Challenge[];
  /** Whole years old on {@link NumerologyInput.referenceDate}. */
  currentAge: number;
  /** Which Pinnacle (1–4) {@link NumerologyProfile.currentAge} falls in. */
  currentPinnacle: 1 | 2 | 3 | 4;
  /** Which Challenge (1–4) {@link NumerologyProfile.currentAge} falls in. */
  currentChallenge: 1 | 2 | 3 | 4;
}

/** Whole years between two calendar dates, birthday-aware. */
function yearsBetween(from: string, to: string): number {
  const birth = parseIsoDate(from);
  const reference = parseIsoDate(to);

  let age = reference.year - birth.year;
  const hadBirthday =
    reference.month > birth.month ||
    (reference.month === birth.month && reference.day >= birth.day);
  if (!hadBirthday) age -= 1;
  return age;
}

/**
 * Compute a complete numerology profile.
 *
 * The name is parsed and partitioned **once** via {@link nameSums}, then each
 * of the three name-derived numbers is reduced from its own sum — rather than
 * calling `expressionNumber`/`soulUrgeNumber`/`personalityNumber`, which would
 * romanize and split the same name three times over.
 *
 * @throws {CalcEngineError} `invalid_input` for a malformed date, a name with
 *   no scoreable letters, or a reference date before the birth date.
 */
export function computeNumerologyProfile(input: NumerologyInput): NumerologyProfile {
  const currentAge = yearsBetween(input.birthDate, input.referenceDate);
  if (currentAge < 0) {
    throw new CalcEngineError(
      'invalid_input',
      `referenceDate (${input.referenceDate}) is before birthDate (${input.birthDate})`,
    );
  }

  const sums = nameSums(input.fullName);
  const lifePath = lifePathNumber(input.birthDate);
  const expression = reduceNumber(sums.letterSum);

  const pinnacleList = pinnacles(input.birthDate);
  const challengeList = challenges(input.birthDate);

  return {
    schemaVersion: NUMEROLOGY_SCHEMA_VERSION,
    lifePath,
    expression,
    soulUrge: reduceNumber(sums.vowelSum),
    personality: reduceNumber(sums.consonantSum),
    birthday: birthdayNumber(input.birthDate),
    maturity: maturityNumber(lifePath, expression),
    personalYear: personalYearNumber(input.birthDate, input.referenceDate),
    personalMonth: personalMonthNumber(input.birthDate, input.referenceDate),
    pinnacles: pinnacleList,
    challenges: challengeList,
    currentAge,
    currentPinnacle: currentPeriodIndex(pinnacleList, currentAge),
    currentChallenge: currentPeriodIndex(challengeList, currentAge),
  };
}

export type { NumerologyNumber } from './types';
export type { Pinnacle, Challenge, LifePeriod } from './periods';
