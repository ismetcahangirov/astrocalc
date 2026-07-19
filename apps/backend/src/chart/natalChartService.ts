import {
  computeNatalChart,
  DEFAULT_HOUSE_SYSTEM,
  type NatalChart,
  type NatalChartInput,
  type OrbConfig,
} from '@astrocalc/calc-engine';
import type { UserRepository } from '../auth/repository';
import { birthDataToChartInput } from './birthChartInput';
import type { OrbConfigService } from '../orbConfig/orbConfigService';
import type { ChartCacheKeyInput } from './chartCacheKey';
import { getOrComputeChart, type ChartResultCache } from './chartResultCache';

/**
 * Pro-only interpretation of a natal chart. Mirrors the mobile client's
 * `NatalChartInterpretation` (`apps/mobile/src/api/natalChartApi.ts`) —
 * deliberately open-shaped, since its concrete content lands with the
 * subscription/entitlement epic (not yet built). Always `null` for now: see
 * {@link NatalChartService.getChart}.
 */
export interface NatalChartInterpretation {
  sections: Record<string, string>;
}

/** The backend's authoritative natal-chart response: the chart plus, for Pro users, its reading. */
export interface NatalChartResponse {
  chart: NatalChart;
  interpretation: NatalChartInterpretation | null;
}

export interface NatalChartService {
  /** Fetch (computing and caching on a miss) the signed-in user's chart — #19. */
  getChart(userId: string): Promise<NatalChartResponse>;
  /**
   * Force-recompute the signed-in user's chart from their current profile and
   * refresh the cache with the authoritative result — the `/natal-chart/sync`
   * endpoint the mobile client calls once connectivity returns after
   * computing offline (#20, AC #3). Deliberately ignores any chart payload
   * the client submits: the backend is the source of truth, so this
   * recomputes rather than trusting client-submitted data.
   */
  refreshChart(userId: string): Promise<NatalChartResponse>;
}

export interface NatalChartServiceDeps {
  repo: Pick<UserRepository, 'getProfile'>;
  cache: ChartResultCache;
  orbConfig: OrbConfigService;
}

function toCacheKey(input: NatalChartInput, orbs: OrbConfig): ChartCacheKeyInput {
  return {
    birthDate: input.birthDate,
    birthTime: input.birthTimeKnown ? (input.birthTime ?? null) : null,
    lat: input.latitude,
    lng: input.longitude,
    houseSystem: DEFAULT_HOUSE_SYSTEM,
    orbConfig: orbs,
  };
}

/**
 * Backend natal-chart computation service — the piece #19's cache and #15's
 * aspect/orb-config layers were built for but had no route to be called from
 * (see both issues' BACKLOG entries). Ties them together with
 * `@astrocalc/calc-engine`'s `computeNatalChart`, the same function the
 * mobile app calls offline, so both sides produce byte-identical charts (#20).
 */
export function createNatalChartService(deps: NatalChartServiceDeps): NatalChartService {
  const { repo, cache, orbConfig } = deps;

  async function loadInputAndOrbs(
    userId: string,
  ): Promise<{ input: NatalChartInput; orbs: OrbConfig }> {
    const profile = await repo.getProfile(userId);
    if (!profile) throw new Error(`profile for user ${userId} not found`);
    const input = birthDataToChartInput(profile);
    const orbs = await orbConfig.getEffectiveOrbs();
    return { input, orbs };
  }

  function compute(input: NatalChartInput, orbs: OrbConfig): NatalChart {
    return computeNatalChart(input, { houseSystem: DEFAULT_HOUSE_SYSTEM, orbs });
  }

  return {
    async getChart(userId) {
      const { input, orbs } = await loadInputAndOrbs(userId);
      const key = toCacheKey(input, orbs);
      const chart = await getOrComputeChart(cache, userId, key, async () => compute(input, orbs));
      return { chart, interpretation: null };
    },

    async refreshChart(userId) {
      const { input, orbs } = await loadInputAndOrbs(userId);
      const key = toCacheKey(input, orbs);
      const chart = compute(input, orbs);
      await cache.set(userId, key, chart);
      return { chart, interpretation: null };
    },
  };
}
