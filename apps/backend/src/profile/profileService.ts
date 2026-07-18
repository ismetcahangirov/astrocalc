import type { UserRepository } from '../auth/repository';
import type { Profile, ProfileUpdateInput } from '../auth/types';

export interface ProfileService {
  getProfile(userId: string): Promise<Profile>;
  updateProfile(userId: string, patch: ProfileUpdateInput): Promise<Profile>;
}

export interface ProfileServiceDeps {
  repo: Pick<UserRepository, 'getProfile' | 'updateProfile'>;
}

/**
 * Thin orchestration over the profile repository for the onboarding flow.
 * Each step (name, birth date, birth time, birth place, language) calls
 * `updateProfile` with just its own fields — the client re-sends the whole
 * form on the final step (or on "I'll finish this later") with
 * `completeOnboarding: true`, which is what actually unlocks the main app.
 */
export function createProfileService(deps: ProfileServiceDeps): ProfileService {
  const { repo } = deps;

  return {
    async getProfile(userId: string): Promise<Profile> {
      const profile = await repo.getProfile(userId);
      if (!profile) throw new Error(`profile for user ${userId} not found`);
      return profile;
    },

    async updateProfile(userId: string, patch: ProfileUpdateInput): Promise<Profile> {
      return repo.updateProfile(userId, patch);
    },
  };
}
