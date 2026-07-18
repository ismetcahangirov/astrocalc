import type { ProfileUpdateInput } from '../auth/types';

/**
 * Port onto the calc-engine's chart/matrix result cache (EPIC 3, #19 —
 * "Chart result caching"). `ChartResultCache` (see `chart/chartResultCache.ts`)
 * implements this interface directly, so it can be passed in as
 * `ProfileServiceDeps.cache` without `profileService.ts`'s call site changing.
 */
export interface ChartCacheInvalidator {
  /** Drop any cached natal chart/matrix computed from this user's old birth data. */
  invalidate(userId: string): Promise<void>;
}

/** Test/default stand-in for callers that don't care about cache invalidation. */
export class NoopChartCacheInvalidator implements ChartCacheInvalidator {
  async invalidate(): Promise<void> {
    // Intentionally empty.
  }
}

/** Birth-relevant fields: changing any of these makes a cached chart/matrix stale. */
export const BIRTH_DATA_FIELDS = [
  'birthDate',
  'birthTime',
  'birthTimeKnown',
  'birthPlaceName',
  'birthPlaceLat',
  'birthPlaceLng',
  'birthPlaceTimezone',
] as const satisfies readonly (keyof ProfileUpdateInput)[];

/** Whether a patch sets any field the chart calculation depends on. */
export function touchesBirthData(patch: ProfileUpdateInput): boolean {
  return BIRTH_DATA_FIELDS.some((field) => field in patch);
}
