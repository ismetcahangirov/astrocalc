import { computeNumerologyProfile, type NumerologyProfile } from '@astrocalc/calc-engine';
import type { UserRepository } from '../auth/repository';
import { numerologyDataToInput } from './numerologyInput';
import type { NumerologyCacheKeyInput } from './numerologyCacheKey';
import { getOrComputeNumerology, type NumerologyResultCache } from './numerologyResultCache';

/** The backend's authoritative numerology response: the profile plus, for Pro users, its reading. */
export interface NumerologyResponse {
  profile: NumerologyProfile;
  /**
   * Always `null` until the interpretation-content epic (#76). Typed as a
   * nullable seam for the same reason `NatalChartResponse.interpretation` is —
   * the subscription/entitlement epic is not built, so there is nothing to gate on yet.
   */
  interpretation: null;
}

export interface NumerologyService {
  /** Fetch (computing and caching on a miss) the signed-in user's numerology profile — #64. */
  getNumerology(userId: string, referenceDate: string): Promise<NumerologyResponse>;
}

export interface NumerologyServiceDeps {
  repo: Pick<UserRepository, 'getProfile'>;
  cache: NumerologyResultCache;
}

/**
 * Backend numerology service (#64). Ties the month-scoped result cache to
 * `@astrocalc/calc-engine`'s `computeNumerologyProfile` — the same function the
 * mobile app calls offline, so both sides produce identical numbers.
 */
export function createNumerologyService(deps: NumerologyServiceDeps): NumerologyService {
  const { repo, cache } = deps;

  return {
    async getNumerology(userId, referenceDate) {
      const profileRecord = await repo.getProfile(userId);
      if (!profileRecord) throw new Error(`profile for user ${userId} not found`);

      const input = numerologyDataToInput(profileRecord, referenceDate);
      // Only the month of the reference date enters the key — see
      // `numerologyCacheKey.ts` for why it is neither the full date nor absent.
      const key: NumerologyCacheKeyInput = {
        fullName: input.fullName,
        birthDate: input.birthDate,
        referenceMonth: referenceDate.slice(0, 7),
      };

      const profile = await getOrComputeNumerology(cache, userId, key, async () =>
        computeNumerologyProfile(input),
      );
      return { profile, interpretation: null };
    },
  };
}
