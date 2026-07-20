import { computeDestinyMatrix, type DestinyMatrix } from '@astrocalc/calc-engine';
import type { UserRepository } from '../auth/repository';
import { matrixDataToInput } from './matrixInput';
import type { MatrixCacheKeyInput } from './matrixCacheKey';
import { getOrComputeMatrix, type MatrixResultCache } from './matrixResultCache';

/** The backend's authoritative Matrix response: the arcana plus, for Pro users, its reading. */
export interface MatrixResponse {
  matrix: DestinyMatrix;
  /**
   * Always `null` until the interpretation-content epic (#76). Typed as a
   * nullable seam for the same reason `NatalChartResponse.interpretation` and
   * `NumerologyResponse.interpretation` are — the subscription/entitlement epic
   * is not built, so there is nothing to gate on yet.
   */
  interpretation: null;
}

export interface MatrixService {
  /** Fetch (computing and caching on a miss) the signed-in user's Matrix — #73. */
  getMatrix(userId: string): Promise<MatrixResponse>;
}

export interface MatrixServiceDeps {
  repo: Pick<UserRepository, 'getProfile'>;
  cache: MatrixResultCache;
}

/**
 * Backend Matrix of Destiny service (#73). Ties the birth-date-keyed result
 * cache to `@astrocalc/calc-engine`'s `computeDestinyMatrix` — the same
 * function the mobile app calls offline, so both sides produce identical arcana.
 *
 * Note the absence of a `referenceDate` parameter, which both sibling services
 * carry in some form: numerology takes one because its cycle numbers advance
 * with the calendar, and the chart's cache key carries the birth *time*. The
 * Matrix reads one immutable field, so there is nothing here for a clock to
 * change — see `matrixCacheKey.ts`.
 */
export function createMatrixService(deps: MatrixServiceDeps): MatrixService {
  const { repo, cache } = deps;

  return {
    async getMatrix(userId) {
      const profileRecord = await repo.getProfile(userId);
      if (!profileRecord) throw new Error(`profile for user ${userId} not found`);

      const input = matrixDataToInput(profileRecord);
      const key: MatrixCacheKeyInput = { birthDate: input.birthDate };

      const matrix = await getOrComputeMatrix(cache, userId, key, async () =>
        computeDestinyMatrix(input),
      );
      return { matrix, interpretation: null };
    },
  };
}
