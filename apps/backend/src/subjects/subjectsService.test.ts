import { describe, expect, it } from 'vitest';
import { InMemoryOrbConfigCache } from '../orbConfig/cache';
import { createOrbConfigService } from '../orbConfig/orbConfigService';
import { InMemoryOrbConfigRepository } from '../orbConfig/repository';
import { InMemoryChartResultCache, type ChartResultCache } from '../chart/chartResultCache';
import type { ChartCacheKeyInput } from '../chart/chartCacheKey';
import {
  InMemoryNumerologyResultCache,
  type NumerologyResultCache,
} from '../numerology/numerologyResultCache';
import type { NumerologyCacheKeyInput } from '../numerology/numerologyCacheKey';
import { InMemorySubjectRepository } from './repository';
import { createSubjectsService } from './subjectsService';

const BAKU = { birthPlaceLat: 40.4093, birthPlaceLng: 49.8671 };
const LONDON = { birthPlaceLat: 51.5074, birthPlaceLng: -0.1278 };

// Fake resolver: the two coordinates we test with map to known zones; else null.
const fakeDerive = (lat: number | null | undefined, lng: number | null | undefined) => {
  if (lat === BAKU.birthPlaceLat && lng === BAKU.birthPlaceLng) return 'Asia/Baku';
  if (lat === LONDON.birthPlaceLat && lng === LONDON.birthPlaceLng) return 'Europe/London';
  return null;
};

/** Wraps the in-memory chart cache to count invalidations. */
class CountingChartCache implements ChartResultCache {
  readonly inner = new InMemoryChartResultCache();
  invalidated: string[] = [];
  get<T>(owner: string, key: ChartCacheKeyInput) {
    return this.inner.get<T>(owner, key);
  }
  set<T>(owner: string, key: ChartCacheKeyInput, value: T) {
    return this.inner.set(owner, key, value);
  }
  async invalidate(owner: string) {
    this.invalidated.push(owner);
    return this.inner.invalidate(owner);
  }
}

/**
 * Wraps the in-memory numerology cache to count invalidations and, crucially,
 * record the exact `owner` argument every `get`/`set` call is namespaced
 * under. Two different subjects almost always hash to two different cache
 * keys anyway (the key already includes name + birth date), so an
 * input/output comparison alone would pass even if the service accidentally
 * namespaced by `userId` instead of the subject `id` — `ownerIdsUsed` is what
 * actually catches that.
 */
class CountingNumerologyResultCache implements NumerologyResultCache {
  readonly inner = new InMemoryNumerologyResultCache();
  invalidated: string[] = [];
  ownerIdsUsed: string[] = [];
  get<T>(owner: string, key: NumerologyCacheKeyInput) {
    this.ownerIdsUsed.push(owner);
    return this.inner.get<T>(owner, key);
  }
  set<T>(owner: string, key: NumerologyCacheKeyInput, value: T) {
    this.ownerIdsUsed.push(owner);
    return this.inner.set(owner, key, value);
  }
  async invalidate(owner: string) {
    this.invalidated.push(owner);
    return this.inner.invalidate(owner);
  }
}

function makeService() {
  const repo = new InMemorySubjectRepository();
  const cache = new CountingChartCache();
  const numerologyCache = new CountingNumerologyResultCache();
  const orbConfig = createOrbConfigService({
    repo: new InMemoryOrbConfigRepository(),
    cache: new InMemoryOrbConfigCache(),
    config: { cacheTtlSeconds: 3600 },
  });
  const service = createSubjectsService({
    repo,
    chartCache: cache,
    numerologyCache,
    orbConfig,
    deriveTimezone: fakeDerive,
  });
  return { repo, cache, numerologyCache, service };
}

describe('subjectsService — create', () => {
  it('derives and stores the timezone from coordinates', async () => {
    const { service } = makeService();
    const subject = await service.create('user-1', {
      name: 'Grandma',
      birthDate: '1950-03-04',
      birthPlaceName: 'Baku',
      ...BAKU,
    });
    expect(subject.birthPlaceTimezone).toBe('Asia/Baku');
    expect(subject.name).toBe('Grandma');
  });

  it('leaves the timezone null when coordinates are absent', async () => {
    const { service } = makeService();
    const subject = await service.create('user-1', { name: 'No place' });
    expect(subject.birthPlaceTimezone).toBeNull();
  });
});

describe('subjectsService — ownership isolation', () => {
  it('lists only the calling user’s subjects', async () => {
    const { service } = makeService();
    await service.create('user-1', { name: 'Mine' });
    await service.create('user-2', { name: 'Theirs' });

    const mine = await service.list('user-1');
    expect(mine.map((s) => s.name)).toEqual(['Mine']);
  });

  it('cannot get another user’s subject', async () => {
    const { service } = makeService();
    const theirs = await service.create('user-2', { name: 'Theirs' });

    await expect(service.get('user-1', theirs.id)).rejects.toMatchObject({
      code: 'subject_not_found',
    });
  });

  it('cannot update or delete another user’s subject', async () => {
    const { service } = makeService();
    const theirs = await service.create('user-2', { name: 'Theirs' });

    await expect(service.update('user-1', theirs.id, { name: 'Hax' })).rejects.toMatchObject({
      code: 'subject_not_found',
    });
    await expect(service.remove('user-1', theirs.id)).rejects.toMatchObject({
      code: 'subject_not_found',
    });
    // The victim's subject is untouched.
    expect((await service.get('user-2', theirs.id)).name).toBe('Theirs');
  });
});

describe('subjectsService — update', () => {
  it('re-derives the timezone when coordinates change', async () => {
    const { service } = makeService();
    const subject = await service.create('user-1', { name: 'Traveler', ...BAKU });
    expect(subject.birthPlaceTimezone).toBe('Asia/Baku');

    const updated = await service.update('user-1', subject.id, { ...LONDON });
    expect(updated.birthPlaceTimezone).toBe('Europe/London');
  });

  it('does not touch the timezone when only the name changes, and invalidates only on birth-data change', async () => {
    const { service, cache } = makeService();
    const subject = await service.create('user-1', { name: 'Friend', ...BAKU });

    await service.update('user-1', subject.id, { name: 'Best friend' });
    expect(cache.invalidated).toEqual([]); // name change: no chart invalidation

    await service.update('user-1', subject.id, { birthDate: '1991-01-01' });
    expect(cache.invalidated).toEqual([subject.id]); // birth-data change: invalidated
  });
});

describe('subjectsService — remove', () => {
  it('deletes the subject and invalidates its cached chart', async () => {
    const { service, cache } = makeService();
    const subject = await service.create('user-1', { name: 'Temp' });

    await service.remove('user-1', subject.id);

    expect(cache.invalidated).toContain(subject.id);
    await expect(service.get('user-1', subject.id)).rejects.toMatchObject({
      code: 'subject_not_found',
    });
  });
});

describe('subjectsService — getChart', () => {
  it('computes a chart for an owned subject and caches it per subject', async () => {
    const { service } = makeService();
    const subject = await service.create('user-1', {
      name: 'Grandpa',
      birthDate: '1948-07-19',
      birthTime: '06:15',
      birthTimeKnown: true,
      birthPlaceName: 'Baku',
      ...BAKU,
    });

    const first = await service.getChart('user-1', subject.id);
    const second = await service.getChart('user-1', subject.id);

    expect(first.interpretation).toBeNull();
    expect(first.chart.positions.length).toBeGreaterThan(0);
    expect(second.chart).toEqual(first.chart);
  });

  it('refuses to compute another user’s subject chart', async () => {
    const { service } = makeService();
    const theirs = await service.create('user-2', {
      name: 'Theirs',
      birthDate: '1948-07-19',
      ...BAKU,
    });

    await expect(service.getChart('user-1', theirs.id)).rejects.toMatchObject({
      code: 'subject_not_found',
    });
  });

  it('throws incomplete_profile when the subject lacks birth data', async () => {
    const { service } = makeService();
    const subject = await service.create('user-1', { name: 'Blank' });

    await expect(service.getChart('user-1', subject.id)).rejects.toMatchObject({
      code: 'incomplete_profile',
    });
  });
});

describe('subjectsService — getNumerology', () => {
  it('computes a numerology profile for an owned subject and caches it per subject', async () => {
    const { service } = makeService();
    const subject = await service.create('user-1', {
      name: 'Grandma',
      birthDate: '1950-03-04',
    });

    const first = await service.getNumerology('user-1', subject.id, '2026-07-20');
    const second = await service.getNumerology('user-1', subject.id, '2026-07-20');

    expect(first.interpretation).toBeNull();
    // Hand-checked: year 1950 -> 1+9+5+0=15 -> 1+5=6; month 03 -> 3; day 04 -> 4;
    // 6 + 3 + 4 = 13, a karmic-debt number, which reduces to 1+3 = 4.
    expect(first.profile.lifePath.value).toBe(4);
    expect(second.profile).toEqual(first.profile);
  });

  it('namespaces the cache under the subject id, not the userId', async () => {
    // The direct regression guard for a userId-keyed cache: unlike comparing
    // two different subjects' *results* (which would still differ even under
    // that bug, since the cache key already encodes name + birth date), this
    // inspects what the service actually passed as the cache's owner argument.
    const { service, numerologyCache } = makeService();
    const subject = await service.create('user-1', {
      name: 'Grandma',
      birthDate: '1950-03-04',
    });

    await service.getNumerology('user-1', subject.id, '2026-07-20');

    expect(numerologyCache.ownerIdsUsed).toContain(subject.id);
    expect(numerologyCache.ownerIdsUsed).not.toContain('user-1');
  });

  it('keys the cache by subject id: two subjects of the same user with different names/birth dates get different results', async () => {
    // This is the regression guard for a cache keyed on `userId` instead of the
    // subject `id` — under a userId-keyed cache the second call below would hit
    // the first subject's cached entry and wrongly return Grandma's numbers for
    // Grandpa.
    const { service } = makeService();
    const grandma = await service.create('user-1', { name: 'Grandma', birthDate: '1950-03-04' });
    const grandpa = await service.create('user-1', { name: 'Grandpa', birthDate: '1948-07-19' });

    const grandmaResult = await service.getNumerology('user-1', grandma.id, '2026-07-20');
    const grandpaResult = await service.getNumerology('user-1', grandpa.id, '2026-07-20');

    expect(grandmaResult.profile).not.toEqual(grandpaResult.profile);
    expect(grandmaResult.profile.lifePath).not.toEqual(grandpaResult.profile.lifePath);
  });

  it('refuses to compute another user’s subject numerology', async () => {
    const { service } = makeService();
    const theirs = await service.create('user-2', {
      name: 'Theirs',
      birthDate: '1948-07-19',
    });

    await expect(service.getNumerology('user-1', theirs.id, '2026-07-20')).rejects.toMatchObject({
      code: 'subject_not_found',
    });
  });

  it('throws incomplete_profile when the subject lacks birth data', async () => {
    const { service } = makeService();
    const subject = await service.create('user-1', { name: 'Blank' });

    await expect(service.getNumerology('user-1', subject.id, '2026-07-20')).rejects.toMatchObject(
      { code: 'incomplete_profile' },
    );
  });
});

describe('subjectsService — numerology cache invalidation', () => {
  it('invalidates cached numerology (but not the chart cache) on a name-only update', async () => {
    const { service, cache, numerologyCache } = makeService();
    const subject = await service.create('user-1', { name: 'Friend', birthDate: '1950-03-04' });

    await service.update('user-1', subject.id, { name: 'Best friend' });

    expect(numerologyCache.invalidated).toEqual([subject.id]);
    expect(cache.invalidated).toEqual([]); // name change: no chart invalidation
  });

  it('invalidates cached numerology on a birth-date update', async () => {
    const { service, numerologyCache } = makeService();
    const subject = await service.create('user-1', { name: 'Friend', birthDate: '1950-03-04' });

    await service.update('user-1', subject.id, { birthDate: '1991-01-01' });

    expect(numerologyCache.invalidated).toEqual([subject.id]);
  });

  it('does not invalidate numerology on a birth-place-only update', async () => {
    const { service, numerologyCache } = makeService();
    const subject = await service.create('user-1', { name: 'Traveler', ...BAKU });

    await service.update('user-1', subject.id, { ...LONDON });

    expect(numerologyCache.invalidated).toEqual([]);
  });

  it('invalidates cached numerology and chart on remove', async () => {
    const { service, cache, numerologyCache } = makeService();
    const subject = await service.create('user-1', { name: 'Temp' });

    await service.remove('user-1', subject.id);

    expect(numerologyCache.invalidated).toContain(subject.id);
    expect(cache.invalidated).toContain(subject.id);
  });
});
