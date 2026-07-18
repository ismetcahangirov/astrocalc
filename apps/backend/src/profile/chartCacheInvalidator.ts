import type { ProfileUpdateInput } from '../auth/types';

/**
 * Port onto the calc-engine's chart/matrix result cache (EPIC 3, #19 —
 * "Chart result caching"). That cache doesn't exist yet, so
 * {@link NoopChartCacheInvalidator} is the only implementation for now; once
 * #19 lands, its cache should implement this interface and be passed in as
 * `ProfileServiceDeps.cache` so `profileService.ts`'s call site doesn't need
 * to change.
 */
export interface ChartCacheInvalidator {
  /** Drop any cached natal chart/matrix computed from this user's old birth data. */
  invalidate(userId: string): Promise<void>;
}

/** Default until #19 exists — there is no cache yet, so there is nothing to drop. */
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
