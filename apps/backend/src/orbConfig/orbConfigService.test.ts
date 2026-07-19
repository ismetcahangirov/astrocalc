import { describe, expect, it } from 'vitest';
import { InMemoryOrbConfigCache } from './cache';
import { createOrbConfigService } from './orbConfigService';
import { InMemoryOrbConfigRepository } from './repository';

function makeService() {
  const repo = new InMemoryOrbConfigRepository();
  const cache = new InMemoryOrbConfigCache();
  const service = createOrbConfigService({ repo, cache, config: { cacheTtlSeconds: 3600 } });
  return { service, repo, cache };
}

describe('getEffectiveOrbs', () => {
  it('returns an empty override set when nothing has been configured', async () => {
    const { service } = makeService();
    expect(await service.getEffectiveOrbs()).toEqual({});
  });

  it('reflects stored overrides, keyed by aspect type', async () => {
    const { service, repo } = makeService();
    await repo.upsert('square', { orbDegrees: 4, updatedBy: null });

    expect(await service.getEffectiveOrbs()).toEqual({ square: 4 });
  });

  it('serves the cached value without re-reading the repository', async () => {
    const { service, repo, cache } = makeService();
    await repo.upsert('square', { orbDegrees: 4, updatedBy: null });
    await service.getEffectiveOrbs();

    // Mutate the repo directly (bypassing the service) — a cached read must not see this.
    await repo.upsert('square', { orbDegrees: 9, updatedBy: null });

    expect(await service.getEffectiveOrbs()).toEqual({ square: 4 });
    expect(await cache.get()).toEqual({ square: 4 });
  });
});

describe('upsertOrb', () => {
  it('persists the override and invalidates the cache so the next read is fresh', async () => {
    const { service } = makeService();
    await service.getEffectiveOrbs(); // warms the cache with an empty config

    const row = await service.upsertOrb('trine', 6, 'admin-1');
    expect(row).toMatchObject({ aspectType: 'trine', orbDegrees: 6, updatedBy: 'admin-1' });

    expect(await service.getEffectiveOrbs()).toEqual({ trine: 6 });
  });

  it('overwrites a previous override for the same aspect type', async () => {
    const { service } = makeService();
    await service.upsertOrb('sextile', 5, null);
    await service.upsertOrb('sextile', 3, 'admin-2');

    const rows = await service.listRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ orbDegrees: 3, updatedBy: 'admin-2' });
  });
});
