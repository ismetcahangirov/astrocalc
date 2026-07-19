import type { UserRepository } from '../auth/repository';
import type { Profile, ProfileUpdateInput } from '../auth/types';
import { deriveBirthTimezone, type BirthTimezoneResolver } from '../geocoding/birthTimezone';
import {
  BIRTH_DATA_FIELDS,
  NoopChartCacheInvalidator,
  touchesBirthData,
  type ChartCacheInvalidator,
} from './chartCacheInvalidator';

export interface ProfileService {
  getProfile(userId: string): Promise<Profile>;
  updateProfile(userId: string, patch: ProfileUpdateInput): Promise<Profile>;
}

export interface ProfileServiceDeps {
  repo: Pick<UserRepository, 'getProfile' | 'updateProfile'>;
  /** Defaults to a no-op — see `chartCacheInvalidator.ts` for why. */
  cache?: ChartCacheInvalidator;
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
 */
export function createProfileService(deps: ProfileServiceDeps): ProfileService {
  const {
    repo,
    cache = new NoopChartCacheInvalidator(),
    deriveTimezone = deriveBirthTimezone,
  } = deps;

  return {
    async getProfile(userId: string): Promise<Profile> {
      const profile = await repo.getProfile(userId);
      if (!profile) throw new Error(`profile for user ${userId} not found`);
      return profile;
    },

    async updateProfile(userId: string, patch: ProfileUpdateInput): Promise<Profile> {
      const before = touchesBirthData(patch) ? await repo.getProfile(userId) : null;
      const patchToApply = withDerivedTimezone(patch, before, deriveTimezone);
      const updated = await repo.updateProfile(userId, patchToApply);

      if (before && BIRTH_DATA_FIELDS.some((field) => before[field] !== updated[field])) {
        await cache.invalidate(userId);
      }

      return updated;
    },
  };
}
