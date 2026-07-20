import { computeNumerologyProfile } from '@astrocalc/calc-engine';
import { fetchNumerology } from '../api/numerologyApi';
import { isNetworkError } from '../api/httpClient';
import {
  getNumerology,
  type NumerologyServiceDeps,
  type NumerologyView,
} from './numerologyService';

/**
 * Concrete wiring for the numerology service: the real backend API client and
 * the shared `@astrocalc/calc-engine` compute. Kept separate from
 * `numerologyService.ts` so that module stays free of React Native / Expo
 * imports and can be unit-tested under plain Node.
 */

/** Build the production {@link NumerologyServiceDeps}. */
export function defaultDeps(): NumerologyServiceDeps {
  return {
    fetchNumerology,
    compute: computeNumerologyProfile,
    isNetworkError,
  };
}

/**
 * App-facing entry point: get the numerology profile (backend or offline) with
 * real deps. Pass {@link localToday} as `referenceDate` unless you are
 * deliberately asking about another day.
 */
export function loadNumerology(
  profile: { fullName: string | null; birthDate: string | null },
  referenceDate: string,
): Promise<NumerologyView> {
  return getNumerology(profile, referenceDate, defaultDeps());
}

/**
 * Re-exported from the pure service so callers have one numerology import, and
 * so it stays unit-testable — importing this wiring module pulls in Expo.
 */
export { localToday } from './numerologyService';
