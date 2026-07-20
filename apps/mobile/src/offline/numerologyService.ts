import type { NumerologyInput, NumerologyProfile } from '@astrocalc/calc-engine';
import type { NumerologyResponse } from '../api/numerologyApi';

/**
 * Online/offline numerology orchestration.
 *
 * This module is intentionally free of any React Native / Expo import (every
 * import above is type-only, and therefore erased at build time) so its logic
 * runs under plain-Node Vitest. The native wiring — the real API client and the
 * engine — lives in `./numerologyServiceWiring.ts`.
 *
 * Same rule as the natal chart: the backend is authoritative, and when it can't
 * be reached the identical `@astrocalc/calc-engine` algorithm runs on-device, so
 * the numbers are the same either way.
 *
 * **Deliberately no pending-sync step and no offline cache**, unlike
 * `natalChartService.ts`. The chart caches because its inputs are partly
 * server-derived (the IANA timezone comes from `geo-tz`, which can't run on the
 * device) and recomputing it is expensive. Numerology has neither problem: its
 * only inputs are the full name and the birth date, both already on the device,
 * and reducing a handful of digits is free. Caching it would buy nothing and
 * introduce a staleness bug — the Personal Year/Month numbers and the current
 * Pinnacle change with the date, so a cached profile is wrong the next morning.
 * Likewise there is nothing to sync upward: the backend can derive the same
 * profile from the same stored fields whenever it is asked.
 *
 * All I/O is injected via {@link NumerologyServiceDeps} so the logic is pure and
 * unit-testable; `defaultDeps()` in the wiring module supplies the real ones.
 */

/** The profile fields numerology can't be computed without. */
export type MissingNumerologyField = 'fullName' | 'birthDate';

/**
 * Thrown when a profile lacks the data numerology needs. Unlike the chart's
 * missing-timezone case this is always the user's to fix — both fields are
 * entered by hand — so the UI should send them to their profile rather than
 * suggesting they reconnect.
 */
export class MissingNumerologyDataError extends Error {
  constructor(public readonly missing: MissingNumerologyField[]) {
    super(`Missing data for numerology: ${missing.join(', ')}`);
    this.name = 'MissingNumerologyDataError';
  }
}

/** A numerology profile ready for the UI, tagged with where it came from. */
export interface NumerologyView {
  profile: NumerologyProfile;
  /** `'backend'` (authoritative, online) or `'offline'` (computed on-device). */
  source: 'backend' | 'offline';
}

/** Injectable I/O for {@link getNumerology}. */
export interface NumerologyServiceDeps {
  fetchNumerology: (referenceDate: string) => Promise<NumerologyResponse>;
  compute: (input: NumerologyInput) => NumerologyProfile;
  isNetworkError: (error: unknown) => boolean;
}

/**
 * Map a stored profile to the engine's {@link NumerologyInput}, or throw
 * {@link MissingNumerologyDataError} listing exactly what's absent. A
 * whitespace-only name counts as missing — it has no scoreable letters.
 */
function toNumerologyInput(
  profile: { fullName: string | null; birthDate: string | null },
  referenceDate: string,
): NumerologyInput {
  const missing: MissingNumerologyField[] = [];
  if (!profile.fullName || profile.fullName.trim() === '') missing.push('fullName');
  if (!profile.birthDate) missing.push('birthDate');

  if (missing.length > 0) throw new MissingNumerologyDataError(missing);

  // Non-null asserted: the guards above have proven each of these is present.
  return { fullName: profile.fullName!, birthDate: profile.birthDate!, referenceDate };
}

/**
 * Get the user's numerology profile, preferring the backend and falling back to
 * on-device computation when offline.
 *
 * `referenceDate` (`YYYY-MM-DD`) is the caller's *local* today — see
 * `localToday()` — because the cycle numbers turn over on a date boundary.
 *
 * Any non-network backend error (e.g. auth) propagates: the offline fallback is
 * for lost connectivity, not for real server rejections.
 *
 * @throws {MissingNumerologyDataError} when the full name or birth date is
 *   absent. Validated up front, before any network call, so an incomplete
 *   profile fails the same way online or offline.
 */
export async function getNumerology(
  profile: { fullName: string | null; birthDate: string | null },
  referenceDate: string,
  deps: NumerologyServiceDeps,
): Promise<NumerologyView> {
  const input = toNumerologyInput(profile, referenceDate);

  try {
    const response = await deps.fetchNumerology(referenceDate);
    return { profile: response.profile, source: 'backend' };
  } catch (error) {
    if (!deps.isNetworkError(error)) throw error;

    // Offline: same algorithm, same inputs, same numbers.
    return { profile: deps.compute(input), source: 'offline' };
  }
}

/**
 * Today's date in the device's own timezone, as `YYYY-MM-DD`.
 *
 * Deliberately not `toISOString()`, which is UTC — a user in Baku (UTC+4) just
 * after midnight would otherwise be handed yesterday's date and see the wrong
 * personal-month number for four hours.
 *
 * @param now injectable for tests; defaults to the current instant.
 */
export function localToday(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
