import { computeNatalChart, type NatalChartOptions } from '@astrocalc/calc-engine';
import type { Profile } from '../api/profileApi';
import { fetchNatalChart, syncNatalChart } from '../api/natalChartApi';
import { isNetworkError } from '../api/httpClient';
import { OfflineChartCache } from './chartCache';
import { secureKeyValueStore } from './keyValueStore';
import {
  getNatalChart,
  syncPendingChart,
  type NatalChartServiceDeps,
  type NatalChartView,
} from './natalChartService';

/**
 * Concrete wiring for the natal-chart service: the real backend API client, the
 * shared `@astrocalc/calc-engine` compute, and the SecureStore-backed offline
 * cache. Kept separate from `natalChartService.ts` so that module stays free of
 * React Native / Expo imports and can be unit-tested under plain Node.
 */

/** Build the production {@link NatalChartServiceDeps}. */
export function defaultDeps(): NatalChartServiceDeps {
  return {
    fetchNatalChart,
    syncNatalChart,
    compute: computeNatalChart,
    cache: new OfflineChartCache(secureKeyValueStore),
    isNetworkError,
  };
}

/** App-facing entry point: get the chart (backend or offline) with real deps. */
export function loadNatalChart(
  profile: Profile,
  options?: NatalChartOptions,
): Promise<NatalChartView> {
  return getNatalChart(profile, defaultDeps(), options);
}

/** App-facing entry point: flush any queued offline chart once back online. */
export function syncOfflineChart(): Promise<boolean> {
  return syncPendingChart(defaultDeps());
}
