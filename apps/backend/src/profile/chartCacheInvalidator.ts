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

/**
 * Numerology-relevant fields (#64): changing either makes a cached numerology
 * profile stale. Deliberately a *separate* list from {@link BIRTH_DATA_FIELDS}
 * rather than an addition to it — the two caches go stale for different
 * reasons. `fullName` feeds every name-derived number but has no bearing on a
 * chart, so folding it into `BIRTH_DATA_FIELDS` would throw away an expensive,
 * still-correct chart computation every time a user fixed a typo in their name.
 * `birthDate` is the one field both lists share.
 */
export const NUMEROLOGY_DATA_FIELDS = [
  'fullName',
  'birthDate',
] as const satisfies readonly (keyof ProfileUpdateInput)[];

/** Whether a patch sets any field the numerology calculation depends on. */
export function touchesNumerologyData(patch: ProfileUpdateInput): boolean {
  return NUMEROLOGY_DATA_FIELDS.some((field) => field in patch);
}

/**
 * Matrix-relevant fields (#73): the birth date, and only the birth date. Every
 * arcana in the Matrix of Destiny is derived from the day, month and year — the
 * birth *time*, *place* and the full *name* have no bearing on it.
 *
 * A third list rather than a reuse of either existing one, for the same reason
 * {@link NUMEROLOGY_DATA_FIELDS} is separate from {@link BIRTH_DATA_FIELDS}:
 * folding the Matrix into the birth-data list would throw away a valid Matrix
 * every time a user corrected their birth *place*, and folding it into the
 * numerology list would throw one away on every name correction. This list
 * being a strict subset of both is precisely why it must stand alone — a subset
 * is invalidated *more* often than it needs to be if it is merged upward.
 */
export const MATRIX_DATA_FIELDS = [
  'birthDate',
] as const satisfies readonly (keyof ProfileUpdateInput)[];

/** Whether a patch sets the one field the Matrix calculation depends on. */
export function touchesMatrixData(patch: ProfileUpdateInput): boolean {
  return MATRIX_DATA_FIELDS.some((field) => field in patch);
}
