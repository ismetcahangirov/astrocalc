import type { NatalChart, NatalChartInput, NatalChartOptions } from '@astrocalc/calc-engine';
import type { Profile } from '../api/profileApi';
import type { NatalChartInterpretation, NatalChartResponse } from '../api/natalChartApi';
import type { OfflineChartCache, ChartSource } from './chartCache';

/**
 * Online/offline natal-chart orchestration (issue #20).
 *
 * This module is intentionally free of any React Native / Expo import (every
 * import above is type-only, and therefore erased at build time) so its logic
 * runs under plain-Node Vitest. The native wiring — the real API client,
 * SecureStore cache, and engine — lives in `./natalChartServiceWiring.ts`.
 *
 * The one rule this file encodes: **the same chart, whether or not there's a
 * network.** Online, the backend's authoritative chart (and, for Pro users, its
 * interpretation) wins. Offline, the chart is computed on-device with the exact
 * same `@astrocalc/calc-engine` algorithm the backend uses — but *without* the
 * Pro interpretation, which stays behind the backend (AC #4). Whatever is
 * computed offline is queued and pushed up once connectivity returns so the
 * server cache converges on the same result (AC #3).
 *
 * All I/O is injected via {@link NatalChartServiceDeps} so the logic is pure and
 * unit-testable; {@link defaultDeps} wires the real implementations.
 */

/** The birth-data fields a profile must have before an offline chart is possible. */
export type MissingBirthField = 'birthDate' | 'birthTime' | 'coordinates' | 'timezone';

/**
 * Thrown when a profile lacks the data needed to compute a chart on-device.
 * Most notably `timezone`: the IANA zone is resolved from coordinates by
 * `geo-tz` on the backend (it can't run on the device), so a profile that has
 * never been saved online has no zone yet and cannot be computed offline. The
 * UI should prompt the user to reconnect / complete their profile.
 */
export class MissingBirthDataError extends Error {
  constructor(public readonly missing: MissingBirthField[]) {
    super(`Missing birth data for offline calculation: ${missing.join(', ')}`);
    this.name = 'MissingBirthDataError';
  }
}

/** A chart ready for the UI, tagged with where it came from and its Pro-gating state. */
export interface NatalChartView {
  chart: NatalChart;
  /** `'backend'` (authoritative, online) or `'offline'` (computed on-device). */
  source: ChartSource;
  /**
   * The Pro interpretation, or `null`. Always `null` for offline charts — the
   * valuable reading text is backend-only (AC #4) and is never computed locally.
   */
  interpretation: NatalChartInterpretation | null;
  /**
   * `true` when the interpretation is unavailable specifically because we're
   * offline (as opposed to the user simply not being entitled to it). Lets the
   * UI show a "reconnect to see your reading" affordance rather than an upsell.
   */
  interpretationLockedOffline: boolean;
}

/** Injectable I/O for {@link getNatalChart}/{@link syncPendingChart}. */
export interface NatalChartServiceDeps {
  fetchNatalChart: () => Promise<NatalChartResponse>;
  syncNatalChart: (chart: NatalChart) => Promise<void>;
  compute: (input: NatalChartInput, options?: NatalChartOptions) => NatalChart;
  cache: OfflineChartCache;
  isNetworkError: (error: unknown) => boolean;
}

/**
 * Map a stored {@link Profile} to the engine's {@link NatalChartInput}, or throw
 * {@link MissingBirthDataError} listing exactly what's absent.
 */
export function profileToChartInput(profile: Profile): NatalChartInput {
  const missing: MissingBirthField[] = [];
  if (!profile.birthDate) missing.push('birthDate');
  if (profile.birthPlaceLat == null || profile.birthPlaceLng == null) missing.push('coordinates');
  if (!profile.birthPlaceTimezone) missing.push('timezone');
  // A known-but-unrecorded birth time can't be honoured; unknown time is fine.
  if (profile.birthTimeKnown && !profile.birthTime) missing.push('birthTime');

  if (missing.length > 0) throw new MissingBirthDataError(missing);

  return {
    // Non-null asserted: the guards above have proven each of these is present.
    birthDate: profile.birthDate!,
    birthTime: profile.birthTime,
    birthTimeKnown: profile.birthTimeKnown,
    latitude: profile.birthPlaceLat!,
    longitude: profile.birthPlaceLng!,
    timezone: profile.birthPlaceTimezone!,
  };
}

/**
 * Push any offline-computed chart that hasn't been synced yet up to the backend
 * (AC #3). Best-effort and idempotent: returns `false` when there's nothing
 * pending, `true` after a successful sync. Re-throws non-network errors; a
 * network error means we're still offline, so the pending flag is left in place
 * for the next attempt.
 */
export async function syncPendingChart(deps: NatalChartServiceDeps): Promise<boolean> {
  const pending = await deps.cache.getPending();
  if (!pending) return false;

  try {
    await deps.syncNatalChart(pending);
  } catch (error) {
    if (deps.isNetworkError(error)) return false;
    throw error;
  }

  await deps.cache.clearPending();
  return true;
}

/**
 * Get the user's natal chart, preferring the backend and falling back to
 * on-device computation when offline.
 *
 * 1. Opportunistically flush a previously-queued offline chart (AC #3).
 * 2. Fetch the authoritative chart from the backend; cache it and return it with
 *    the Pro interpretation.
 * 3. If (and only if) the device is offline, compute the chart locally with the
 *    shared engine, cache it as pending-sync, and return it with no
 *    interpretation (AC #4).
 *
 * Any non-network backend error (e.g. auth) propagates — offline fallback is for
 * lost connectivity, not for real server rejections.
 *
 * @throws {MissingBirthDataError} if the profile can't be computed on-device and
 *   the backend is unreachable, or whenever required birth data is absent.
 */
export async function getNatalChart(
  profile: Profile,
  deps: NatalChartServiceDeps,
  options?: NatalChartOptions,
): Promise<NatalChartView> {
  // Validate up front so a profile with no birth data fails the same way online
  // or offline, instead of only when we reach the compute branch.
  const input = profileToChartInput(profile);

  // Best-effort: don't let a queued offline chart block the fresh fetch.
  await syncPendingChart(deps).catch(() => undefined);

  try {
    const response = await deps.fetchNatalChart();
    await deps.cache.save({ chart: response.chart, source: 'backend', pendingSync: false });
    return {
      chart: response.chart,
      source: 'backend',
      interpretation: response.interpretation,
      interpretationLockedOffline: false,
    };
  } catch (error) {
    if (!deps.isNetworkError(error)) throw error;

    // Offline: same algorithm as the backend, minus the Pro interpretation.
    const chart = deps.compute(input, options);
    await deps.cache.save({ chart, source: 'offline', pendingSync: true });
    return {
      chart,
      source: 'offline',
      interpretation: null,
      interpretationLockedOffline: true,
    };
  }
}
