import { describe, expect, it } from 'vitest';
import { InMemoryOrbConfigCache } from '../orbConfig/cache';
import { createOrbConfigService } from '../orbConfig/orbConfigService';
import { InMemoryOrbConfigRepository } from '../orbConfig/repository';
import { InMemoryChartResultCache, type ChartResultCache } from '../chart/chartResultCache';
import type { ChartCacheKeyInput } from '../chart/chartCacheKey';
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

function makeService() {
  const repo = new InMemorySubjectRepository();
  const cache = new CountingChartCache();
  const orbConfig = createOrbConfigService({
    repo: new InMemoryOrbConfigRepository(),
    cache: new InMemoryOrbConfigCache(),
    config: { cacheTtlSeconds: 3600 },
  });
  const service = createSubjectsService({
    repo,
    chartCache: cache,
    orbConfig,
    deriveTimezone: fakeDerive,
  });
  return { repo, cache, service };
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
