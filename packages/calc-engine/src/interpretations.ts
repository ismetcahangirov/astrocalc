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
 * The three kinds of computed placement this feature writes interpretation
 * text for (see issue #18's acceptance criteria).
 */
export type InterpretationCategory = 'planet-sign' | 'planet-house' | 'aspect';

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

const ASPECT_TYPES: readonly AspectType[] = ['conjunction', 'sextile', 'square', 'trine', 'opposition'];

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
    throw new CalcEngineError('invalid_input', `house must be an integer within [1, 12], got ${house}`);
  }
  return `${body}-${house}`;
}

/**
 * Build the subject key for an aspect between two bodies, e.g.
 * `conjunction-moon-sun`. The two bodies are ordered alphabetically
 * regardless of call order, so "Sun conjunction Moon" and "Moon conjunction
 * Sun" resolve to the same row — an aspect has no inherent direction.
 */
export function aspectSubjectKey(type: AspectType, bodyA: CelestialBody, bodyB: CelestialBody): string {
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
