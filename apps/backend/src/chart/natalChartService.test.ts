import { describe, expect, it } from 'vitest';
import type { OrbConfig } from '@astrocalc/calc-engine';
import { InMemoryUserRepository } from '../auth/repository';
import { InMemoryOrbConfigCache } from '../orbConfig/cache';
import { createOrbConfigService } from '../orbConfig/orbConfigService';
import { InMemoryOrbConfigRepository } from '../orbConfig/repository';
import { InMemoryChartResultCache, type ChartResultCache } from './chartResultCache';
import type { ChartCacheKeyInput } from './chartCacheKey';
import { createNatalChartService } from './natalChartService';

const KNOWN_BIRTH_DATA = {
  birthDate: '1990-05-12',
  birthTime: '10:30',
  birthTimeKnown: true,
  birthPlaceName: 'Baku, Azerbaijan',
  birthPlaceLat: 40.4093,
  birthPlaceLng: 49.8671,
  birthPlaceTimezone: 'Asia/Baku',
};

/** Wraps an in-memory cache and counts get/set calls, to assert whether a compute was skipped. */
class CountingChartResultCache implements ChartResultCache {
  readonly inner = new InMemoryChartResultCache();
  getCalls = 0;
  setCalls = 0;

  async get<T>(userId: string, key: ChartCacheKeyInput): Promise<T | null> {
    this.getCalls++;
    return this.inner.get<T>(userId, key);
  }

  async set<T>(userId: string, key: ChartCacheKeyInput, value: T): Promise<void> {
    this.setCalls++;
    return this.inner.set(userId, key, value);
  }

  async invalidate(userId: string): Promise<void> {
    return this.inner.invalidate(userId);
  }
}

async function makeService(orbOverrides: Record<string, number> = {}) {
  const repo = new InMemoryUserRepository();
  const cache = new CountingChartResultCache();
  const orbRepo = new InMemoryOrbConfigRepository();
  for (const [aspectType, orbDegrees] of Object.entries(orbOverrides)) {
    await orbRepo.upsert(aspectType as keyof OrbConfig, { orbDegrees, updatedBy: null });
  }
  const orbConfig = createOrbConfigService({
    repo: orbRepo,
    cache: new InMemoryOrbConfigCache(),
    config: { cacheTtlSeconds: 3600 },
  });
  const service = createNatalChartService({ repo, cache, orbConfig });

  const user = await repo.createUserWithProfile({
    email: 'ada@example.com',
    googleId: 'g-1',
    displayName: 'Ada',
    avatarUrl: null,
    locale: 'en',
  });

  return { service, repo, cache, userId: user.id };
}

describe('getChart', () => {
  it('throws IncompleteProfileError listing every missing field when the profile has no birth data', async () => {
    const { service, userId } = await makeService();

    await expect(service.getChart(userId)).rejects.toMatchObject({
      code: 'incomplete_profile',
      details: {
        missing: ['birthDate', 'birthPlaceLat', 'birthPlaceLng', 'birthPlaceTimezone'],
      },
    });
  });

  it('lists birthTime as missing when birthTimeKnown is true but no time was recorded', async () => {
    const { service, repo, userId } = await makeService();
    await repo.updateProfile(userId, { ...KNOWN_BIRTH_DATA, birthTime: null });

    await expect(service.getChart(userId)).rejects.toMatchObject({
      code: 'incomplete_profile',
      details: { missing: ['birthTime'] },
    });
  });

  it('does not require birthTime when birthTimeKnown is false', async () => {
    const { service, repo, userId } = await makeService();
    await repo.updateProfile(userId, {
      ...KNOWN_BIRTH_DATA,
      birthTimeKnown: false,
      birthTime: null,
    });

    const { chart } = await service.getChart(userId);
    expect(chart.birthTimeKnown).toBe(false);
    expect(chart.houses).toBeNull();
  });

  it('computes a chart with no Pro interpretation (not yet built)', async () => {
    const { service, repo, userId } = await makeService();
    await repo.updateProfile(userId, KNOWN_BIRTH_DATA);

    const result = await service.getChart(userId);
    expect(result.interpretation).toBeNull();
    expect(result.chart.positions.length).toBeGreaterThan(0);
    expect(result.chart.houses).not.toBeNull();
  });

  it('caches the computed chart — a second call for the same profile is served without recomputing', async () => {
    const { service, repo, cache, userId } = await makeService();
    await repo.updateProfile(userId, KNOWN_BIRTH_DATA);

    const first = await service.getChart(userId);
    const second = await service.getChart(userId);

    expect(second).toEqual(first);
    expect(cache.setCalls).toBe(1);
    expect(cache.getCalls).toBe(2);
  });

  it('applies the effective admin orb config to the computed aspects', async () => {
    const wide = await makeService({
      conjunction: 30,
      opposition: 30,
      trine: 30,
      square: 30,
      sextile: 30,
    });
    await wide.repo.updateProfile(wide.userId, KNOWN_BIRTH_DATA);
    const narrow = await makeService({
      conjunction: 1,
      opposition: 1,
      trine: 1,
      square: 1,
      sextile: 1,
    });
    await narrow.repo.updateProfile(narrow.userId, KNOWN_BIRTH_DATA);

    const wideResult = await wide.service.getChart(wide.userId);
    const narrowResult = await narrow.service.getChart(narrow.userId);

    expect(wideResult.chart.aspects.length).toBeGreaterThan(narrowResult.chart.aspects.length);
  });
});

describe('refreshChart', () => {
  it('recomputes and overwrites the cache even when a value is already cached', async () => {
    const { service, repo, cache, userId } = await makeService();
    await repo.updateProfile(userId, KNOWN_BIRTH_DATA);

    await service.getChart(userId); // populates the cache
    expect(cache.setCalls).toBe(1);

    const refreshed = await service.refreshChart(userId);
    expect(cache.setCalls).toBe(2);
    expect(refreshed.chart.positions.length).toBeGreaterThan(0);

    // The next plain read is served from the freshly-set cache entry.
    const afterRefresh = await service.getChart(userId);
    expect(afterRefresh.chart).toEqual(refreshed.chart);
  });

  it('throws IncompleteProfileError the same way getChart does when birth data is missing', async () => {
    const { service, userId } = await makeService();
    await expect(service.refreshChart(userId)).rejects.toMatchObject({
      code: 'incomplete_profile',
    });
  });
});
