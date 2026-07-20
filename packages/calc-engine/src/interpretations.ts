import { CalcEngineError } from './errors';
import type { AspectType } from './aspects';
import type { CelestialBody, ZodiacSign } from './planetary-positions';

/**
 * The four languages AstroCalc's natal-chart interpretation text is written
 * and displayed in (#18). Every subject key returned by
 * {@link listInterpretationSubjects} must have content in all four before a
 * result screen can claim full-language parity.
 */
export type InterpretationLocale = 'az' | 'tr' | 'en' | 'ru';

export const SUPPORTED_LOCALES: readonly InterpretationLocale[] = ['az', 'tr', 'en', 'ru'];

/** Locale interpretation text falls back to when a translation is missing. */
export const FALLBACK_LOCALE: InterpretationLocale = 'en';

/**
 * The kinds of computed result AstroCalc writes interpretation text for.
 * The first three are natal-chart placements (#18); `numerology` and `matrix`
 * were added for the numerology (#57) and Matrix of Destiny (#67) epics.
 */
export type InterpretationCategory =
  'planet-sign' | 'planet-house' | 'aspect' | 'numerology' | 'matrix';

const SIGNS: readonly ZodiacSign[] = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
];

const HOUSES: readonly number[] = Array.from({ length: 12 }, (_, i) => i + 1);

const ASPECT_TYPES: readonly AspectType[] = [
  'conjunction',
  'sextile',
  'square',
  'trine',
  'opposition',
];

/**
 * The bodies this feature writes planet-sign/planet-house/aspect
 * interpretation text for: the ten classical planets (Sun–Pluto). The lunar
 * nodes and Chiron are deliberately out of scope for now — they are
 * optional/advanced points in {@link CelestialBody} (Chiron is opt-in in
 * {@link computePlanetaryPositions} and only approximate) — but nothing here
 * hard-codes the count of ten, so a future issue can extend
 * {@link INTERPRETED_BODIES} without changing the key scheme.
 */
export const INTERPRETED_BODIES: readonly CelestialBody[] = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
];

/** One row's worth of identity: which combination this interpretation text is for. */
export interface InterpretationSubject {
  category: InterpretationCategory;
  /** Stable, human-readable identifier — see the `*SubjectKey` builders. */
  subjectKey: string;
}

/** Build the subject key for a "planet in sign" combination, e.g. `sun-Aries`. */
export function planetSignSubjectKey(body: CelestialBody, sign: ZodiacSign): string {
  return `${body}-${sign}`;
}

/** Build the subject key for a "planet in house" combination, e.g. `sun-1`. */
export function planetHouseSubjectKey(body: CelestialBody, house: number): string {
  if (!Number.isInteger(house) || house < 1 || house > 12) {
    throw new CalcEngineError(
      'invalid_input',
      `house must be an integer within [1, 12], got ${house}`,
    );
  }
  return `${body}-${house}`;
}

/**
 * Build the subject key for an aspect between two bodies, e.g.
 * `conjunction-moon-sun`. The two bodies are ordered alphabetically
 * regardless of call order, so "Sun conjunction Moon" and "Moon conjunction
 * Sun" resolve to the same row — an aspect has no inherent direction.
 */
export function aspectSubjectKey(
  type: AspectType,
  bodyA: CelestialBody,
  bodyB: CelestialBody,
): string {
  const [first, second] = [bodyA, bodyB].sort();
  return `${type}-${first}-${second}`;
}

/**
 * Enumerate every (category, subjectKey) combination that must have
 * interpretation text in every {@link SUPPORTED_LOCALES} locale. This is the
 * single source of truth both the seed script (writes the content) and a
 * parity test (verifies nothing is missing) are driven from — the
 * ten {@link INTERPRETED_BODIES} planets across all 12 signs, all 12 houses,
 * and all 5 major aspects across every unordered pair of those planets.
 */
export function listInterpretationSubjects(): InterpretationSubject[] {
  const subjects: InterpretationSubject[] = [];

  for (const body of INTERPRETED_BODIES) {
    for (const sign of SIGNS) {
      subjects.push({ category: 'planet-sign', subjectKey: planetSignSubjectKey(body, sign) });
    }
    for (const house of HOUSES) {
      subjects.push({ category: 'planet-house', subjectKey: planetHouseSubjectKey(body, house) });
    }
  }

  for (let i = 0; i < INTERPRETED_BODIES.length; i++) {
    for (let j = i + 1; j < INTERPRETED_BODIES.length; j++) {
      for (const type of ASPECT_TYPES) {
        subjects.push({
          category: 'aspect',
          subjectKey: aspectSubjectKey(type, INTERPRETED_BODIES[i]!, INTERPRETED_BODIES[j]!),
        });
      }
    }
  }

  return subjects;
}

/**
 * The numerology numbers that get their own interpretation text. Each kind has
 * its own valid value range, because the same digit means different things in
 * different positions — a 7 Life Path and a 7 Personal Year are unrelated
 * readings, so they are separate subjects rather than one shared "7" text.
 */
export type NumerologyNumberKind =
  | 'life-path'
  | 'expression'
  | 'soul-urge'
  | 'personality'
  | 'birthday'
  | 'maturity'
  | 'personal-year'
  | 'personal-month'
  | 'pinnacle-1'
  | 'pinnacle-2'
  | 'pinnacle-3'
  | 'pinnacle-4'
  | 'challenge-1'
  | 'challenge-2'
  | 'challenge-3'
  | 'challenge-4';

/** Values that carry master numbers: 1–9 plus 11, 22, 33. */
const MASTER_RANGE: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33];
/** Values reduced to a single digit: 1–9. */
const SINGLE_RANGE: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
/** Challenges uniquely include 0, and never exceed 8. */
const CHALLENGE_RANGE: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];
/** Birthday is the raw day of the month, never reduced. */
const BIRTHDAY_RANGE: readonly number[] = Array.from({ length: 31 }, (_, i) => i + 1);

/** The values each numerology kind can take — also the enumeration order. */
const NUMEROLOGY_VALUE_RANGES: Record<NumerologyNumberKind, readonly number[]> = {
  'life-path': MASTER_RANGE,
  expression: MASTER_RANGE,
  'soul-urge': MASTER_RANGE,
  personality: MASTER_RANGE,
  birthday: BIRTHDAY_RANGE,
  maturity: MASTER_RANGE,
  'personal-year': SINGLE_RANGE,
  'personal-month': SINGLE_RANGE,
  'pinnacle-1': MASTER_RANGE,
  'pinnacle-2': MASTER_RANGE,
  'pinnacle-3': MASTER_RANGE,
  'pinnacle-4': MASTER_RANGE,
  'challenge-1': CHALLENGE_RANGE,
  'challenge-2': CHALLENGE_RANGE,
  'challenge-3': CHALLENGE_RANGE,
  'challenge-4': CHALLENGE_RANGE,
};

/** `'pinnacle'`/`'challenge'` without a position index still have a known range. */
function rangeForLooseKind(kind: string): readonly number[] | null {
  if (kind === 'pinnacle') return MASTER_RANGE;
  if (kind === 'challenge') return CHALLENGE_RANGE;
  return null;
}

/**
 * Build the subject key for a numerology number, e.g. `life-path-7`.
 * Accepts the unsuffixed `pinnacle`/`challenge` kinds too, so callers that
 * do not care about the position can pass `'challenge'` and a value.
 */
export function numerologySubjectKey(kind: string, value: number): string {
  const range = NUMEROLOGY_VALUE_RANGES[kind as NumerologyNumberKind] ?? rangeForLooseKind(kind);
  if (!range) {
    throw new CalcEngineError('invalid_input', `unknown numerology kind: ${kind}`);
  }
  if (!range.includes(value)) {
    throw new CalcEngineError(
      'invalid_input',
      `value ${value} is not valid for numerology kind '${kind}'`,
    );
  }
  return `${kind}-${value}`;
}

/**
 * Enumerate every numerology subject that needs interpretation text: 193 keys
 * (60 core life-path/expression/soul-urge/personality/maturity + 31 birthday +
 * 18 personal-year/personal-month cycles + 48 pinnacles + 36 challenges).
 *
 * Deliberately **not** merged into {@link listInterpretationSubjects} yet. That
 * function drives the backend seed-parity test and the admin completeness
 * check, both of which would fail the moment these keys appear with no content
 * behind them. Merging is issue #82, once the numerology text exists.
 */
export function listNumerologySubjects(): InterpretationSubject[] {
  const subjects: InterpretationSubject[] = [];
  for (const kind of Object.keys(NUMEROLOGY_VALUE_RANGES) as NumerologyNumberKind[]) {
    for (const value of NUMEROLOGY_VALUE_RANGES[kind]) {
      subjects.push({ category: 'numerology', subjectKey: numerologySubjectKey(kind, value) });
    }
  }
  return subjects;
}
