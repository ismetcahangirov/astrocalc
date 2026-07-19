import type { AspectType, OrbConfig } from '@astrocalc/calc-engine';
import type { OrbConfigCache } from './cache';
import type { OrbConfigRepository } from './repository';
import type { OrbConfigRow } from './types';

export interface OrbConfigServiceConfig {
  /** How long the resolved effective config is cached (seconds). */
  cacheTtlSeconds: number;
}

export interface OrbConfigServiceDeps {
  repo: OrbConfigRepository;
  cache: OrbConfigCache;
  config: OrbConfigServiceConfig;
}

export interface OrbConfigService {
  /**
   * The effective per-aspect-type orb overrides — read-through cached, ready
   * to pass directly as `NatalChartOptions.orbs`. Any aspect type with no
   * stored row is simply absent, so `computeAspects`/`computeNatalChart` fall
   * back to the calc-engine's documented `DEFAULT_ORBS`.
   */
  getEffectiveOrbs(): Promise<OrbConfig>;
  /** Every stored override row, for the admin panel (EPIC 10) to display. */
  listRows(): Promise<OrbConfigRow[]>;
  /** Admin create/edit (EPIC 10). Invalidates the cache so the next read is fresh. */
  upsertOrb(
    aspectType: AspectType,
    orbDegrees: number,
    updatedBy: string | null,
  ): Promise<OrbConfigRow>;
}

/**
 * Admin-configurable aspect-orb service (#15's remaining backend piece — the
 * calc-engine layer and the `aspect_orb_config` table already exist). Mirrors
 * the interpretation-text module's repository/cache/service layering.
 */
export function createOrbConfigService(deps: OrbConfigServiceDeps): OrbConfigService {
  const { repo, cache, config } = deps;

  async function buildEffectiveOrbs(): Promise<OrbConfig> {
    const rows = await repo.listAll();
    const orbs: OrbConfig = {};
    for (const row of rows) orbs[row.aspectType] = row.orbDegrees;
    return orbs;
  }

  return {
    async getEffectiveOrbs() {
      const cached = await cache.get();
      if (cached) return cached;

      const orbs = await buildEffectiveOrbs();
      await cache.set(orbs, config.cacheTtlSeconds);
      return orbs;
    },

    async listRows() {
      return repo.listAll();
    },

    async upsertOrb(aspectType, orbDegrees, updatedBy) {
      const row = await repo.upsert(aspectType, { orbDegrees, updatedBy });
      await cache.invalidate();
      return row;
    },
  };
}
