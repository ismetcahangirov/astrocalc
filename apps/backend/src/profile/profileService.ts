import type { UserRepository } from '../auth/repository';
import type { Profile, ProfileUpdateInput } from '../auth/types';
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
  const { repo, cache = new NoopChartCacheInvalidator() } = deps;

  return {
    async getProfile(userId: string): Promise<Profile> {
      const profile = await repo.getProfile(userId);
      if (!profile) throw new Error(`profile for user ${userId} not found`);
      return profile;
    },

    async updateProfile(userId: string, patch: ProfileUpdateInput): Promise<Profile> {
      const before = touchesBirthData(patch) ? await repo.getProfile(userId) : null;
      const updated = await repo.updateProfile(userId, patch);

      if (before && BIRTH_DATA_FIELDS.some((field) => before[field] !== updated[field])) {
        await cache.invalidate(userId);
      }

      return updated;
    },
  };
}
