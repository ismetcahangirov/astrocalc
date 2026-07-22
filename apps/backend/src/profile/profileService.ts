import type { UserRepository } from '../auth/repository';
import type { Profile, ProfileUpdateInput } from '../auth/types';
import { composeFullName, displayNameOf } from '../common/personName';
import { deriveBirthTimezone, type BirthTimezoneResolver } from '../geocoding/birthTimezone';
import {
  BIRTH_DATA_FIELDS,
  MATRIX_DATA_FIELDS,
  NoopChartCacheInvalidator,
  NUMEROLOGY_DATA_FIELDS,
  touchesBirthData,
  touchesMatrixData,
  touchesNumerologyData,
  type ChartCacheInvalidator,
} from './chartCacheInvalidator';
import type { NumerologyResultCache } from '../numerology/numerologyResultCache';
import type { MatrixResultCache } from '../matrix/matrixResultCache';

export interface ProfileService {
  getProfile(userId: string): Promise<Profile>;
  updateProfile(userId: string, patch: ProfileUpdateInput): Promise<Profile>;
}

export interface ProfileServiceDeps {
  repo: Pick<UserRepository, 'getProfile' | 'updateProfile'>;
  /** Defaults to a no-op — see `chartCacheInvalidator.ts` for why. */
  cache?: ChartCacheInvalidator;
  /**
   * Numerology result cache (#64), invalidated independently of `cache` — see
   * `NUMEROLOGY_DATA_FIELDS`. Also defaults to a no-op.
   */
  numerologyCache?: Pick<NumerologyResultCache, 'invalidate'>;
  /**
   * Matrix result cache (#73), invalidated on its own narrower trigger again —
   * see `MATRIX_DATA_FIELDS`. Also defaults to a no-op.
   */
  matrixCache?: Pick<MatrixResultCache, 'invalidate'>;
  /**
   * Resolves a birth place's IANA timezone from its coordinates. Injectable so
   * tests don't pull in `geo-tz`; defaults to the real `geo-tz`-backed lookup.
   */
  deriveTimezone?: BirthTimezoneResolver;
}

/**
 * Force `birthPlaceTimezone` to the zone derived from the *effective*
 * coordinates whenever a patch touches either coordinate — the server owns the
 * zone, so any client-sent value is ignored. When the patch leaves coordinates
 * untouched, the patch is returned unchanged (the place didn't move).
 */
function withDerivedTimezone(
  patch: ProfileUpdateInput,
  before: Profile | null,
  derive: BirthTimezoneResolver,
): ProfileUpdateInput {
  const touchesLat = 'birthPlaceLat' in patch;
  const touchesLng = 'birthPlaceLng' in patch;
  if (!touchesLat && !touchesLng) return patch;

  const lat = touchesLat ? patch.birthPlaceLat : (before?.birthPlaceLat ?? null);
  const lng = touchesLng ? patch.birthPlaceLng : (before?.birthPlaceLng ?? null);
  return { ...patch, birthPlaceTimezone: derive(lat, lng) };
}

/** Whether a patch carries any of the three name parts. */
function touchesNameParts(patch: ProfileUpdateInput): boolean {
  return 'firstName' in patch || 'lastName' in patch || 'patronymic' in patch;
}

/**
 * When a patch carries any name part, compose `fullName` (numerology's input)
 * and `displayName` (the greeting name) from the merged parts — parts the patch
 * doesn't touch fall back to the stored profile. This makes the parts the
 * source of truth: a client that sends them need not send `fullName` itself,
 * and any `fullName`/`displayName` sent alongside is overridden by the
 * composition so the two can never drift apart.
 */
function withComposedName(patch: ProfileUpdateInput, before: Profile | null): ProfileUpdateInput {
  if (!touchesNameParts(patch)) return patch;
  const parts = {
    firstName: 'firstName' in patch ? (patch.firstName ?? null) : (before?.firstName ?? null),
    lastName: 'lastName' in patch ? (patch.lastName ?? null) : (before?.lastName ?? null),
    patronymic: 'patronymic' in patch ? (patch.patronymic ?? null) : (before?.patronymic ?? null),
  };
  return {
    ...patch,
    ...parts,
    fullName: composeFullName(parts),
    displayName: displayNameOf(parts),
  };
}

/**
 * Thin orchestration over the profile repository, shared by the onboarding
 * flow (#6) and the profile-edit screen (#7). Each onboarding step (name,
 * birth date, birth time, birth place, language) calls `updateProfile` with
 * just its own fields — the client re-sends the whole form on the final step
 * (or on "I'll finish this later") with `completeOnboarding: true`, which is
 * what actually unlocks the main app. The edit screen reuses the same
 * `updateProfile` with whichever fields the user changed.
 *
 * Whenever a patch actually changes a birth-relevant field, the previously
 * computed natal chart/matrix cache is invalidated (see #7's acceptance
 * criteria and `chartCacheInvalidator.ts` for the EPIC 3 / #19 dependency).
 * The numerology cache (#64) is invalidated on its own, narrower trigger — a
 * `fullName` or `birthDate` change — and the Matrix cache (#73) on a narrower
 * one still: `birthDate` alone. No cache is dropped for an edit that cannot
 * have affected it, which is the whole reason there are three of them.
 */
export function createProfileService(deps: ProfileServiceDeps): ProfileService {
  const {
    repo,
    cache = new NoopChartCacheInvalidator(),
    numerologyCache = new NoopChartCacheInvalidator(),
    matrixCache = new NoopChartCacheInvalidator(),
    deriveTimezone = deriveBirthTimezone,
  } = deps;

  return {
    async getProfile(userId: string): Promise<Profile> {
      const profile = await repo.getProfile(userId);
      if (!profile) throw new Error(`profile for user ${userId} not found`);
      return profile;
    },

    async updateProfile(userId: string, patch: ProfileUpdateInput): Promise<Profile> {
      // `before` is needed to tell an actual change from a no-op re-send (the
      // onboarding flow re-sends the whole form on its final step). Fetch it
      // when the patch touches *either* cache's inputs — `fullName` is
      // numerology-relevant but not birth-relevant, so gating this on
      // `touchesBirthData` alone would leave a name-only edit serving the old
      // numbers forever.
      const needsBefore =
        touchesBirthData(patch) ||
        touchesNumerologyData(patch) ||
        touchesMatrixData(patch) ||
        touchesNameParts(patch);
      const before = needsBefore ? await repo.getProfile(userId) : null;
      // Compose fullName/displayName from any name parts first, then derive the
      // timezone; the two transforms touch disjoint fields.
      const patchToApply = withDerivedTimezone(withComposedName(patch, before), before, deriveTimezone);
      const updated = await repo.updateProfile(userId, patchToApply);

      if (before && BIRTH_DATA_FIELDS.some((field) => before[field] !== updated[field])) {
        await cache.invalidate(userId);
      }

      if (before && NUMEROLOGY_DATA_FIELDS.some((field) => before[field] !== updated[field])) {
        await numerologyCache.invalidate(userId);
      }

      if (before && MATRIX_DATA_FIELDS.some((field) => before[field] !== updated[field])) {
        await matrixCache.invalidate(userId);
      }

      return updated;
    },
  };
}
