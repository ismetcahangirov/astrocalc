import { describe, expect, it } from 'vitest';
import { InMemoryChartResultCache, getOrComputeChart } from './chartResultCache';
import type { ChartCacheKeyInput } from './chartCacheKey';

const key: ChartCacheKeyInput = {
  birthDate: '1990-05-12',
  birthTime: '10:30',
  lat: 40.4093,
  lng: 49.8671,
  houseSystem: 'placidus',
  orbConfig: {},
};

const otherKey: ChartCacheKeyInput = { ...key, birthDate: '1991-01-01' };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('InMemoryChartResultCache', () => {
  it('returns null for a key that was never set', async () => {
    const cache = new InMemoryChartResultCache();
    expect(await cache.get('user-1', key)).toBeNull();
  });

  it('returns a value previously set for the same user + key', async () => {
    const cache = new InMemoryChartResultCache();
    await cache.set('user-1', key, { sun: 'Taurus' });
    expect(await cache.get('user-1', key)).toEqual({ sun: 'Taurus' });
  });

  it('keeps entries for different birth data separate', async () => {
    const cache = new InMemoryChartResultCache();
    await cache.set('user-1', key, { sun: 'Taurus' });
    await cache.set('user-1', otherKey, { sun: 'Capricorn' });

    expect(await cache.get('user-1', key)).toEqual({ sun: 'Taurus' });
    expect(await cache.get('user-1', otherKey)).toEqual({ sun: 'Capricorn' });
  });

  it('keeps entries for different users separate even under the same birth data', async () => {
    const cache = new InMemoryChartResultCache();
    await cache.set('user-1', key, { sun: 'Taurus' });
    expect(await cache.get('user-2', key)).toBeNull();
  });

  it('invalidate drops every cached entry for that user, leaving other users untouched', async () => {
    const cache = new InMemoryChartResultCache();
    await cache.set('user-1', key, { sun: 'Taurus' });
    await cache.set('user-1', otherKey, { sun: 'Capricorn' });
    await cache.set('user-2', key, { sun: 'Gemini' });

    await cache.invalidate('user-1');

    expect(await cache.get('user-1', key)).toBeNull();
    expect(await cache.get('user-1', otherKey)).toBeNull();
    expect(await cache.get('user-2', key)).toEqual({ sun: 'Gemini' });
  });

  it('a value set again after invalidation is served fresh', async () => {
    const cache = new InMemoryChartResultCache();
    await cache.set('user-1', key, { sun: 'Taurus' });
    await cache.invalidate('user-1');
    await cache.set('user-1', key, { sun: 'Recomputed' });

    expect(await cache.get('user-1', key)).toEqual({ sun: 'Recomputed' });
  });
});

describe('getOrComputeChart', () => {
  it('computes and caches on a miss, then serves the cached value on a hit without recomputing', async () => {
    const cache = new InMemoryChartResultCache();
    let calls = 0;
    const compute = async () => {
      calls++;
      return { result: `computed-${calls}` };
    };

    const first = await getOrComputeChart(cache, 'user-1', key, compute);
    const second = await getOrComputeChart(cache, 'user-1', key, compute);

    expect(first).toEqual({ result: 'computed-1' });
    expect(second).toEqual({ result: 'computed-1' });
    expect(calls).toBe(1);
  });

  it('recomputes after invalidation', async () => {
    const cache = new InMemoryChartResultCache();
    let calls = 0;
    const compute = async () => {
      calls++;
      return { result: `computed-${calls}` };
    };

    await getOrComputeChart(cache, 'user-1', key, compute);
    await cache.invalidate('user-1');
    const afterInvalidate = await getOrComputeChart(cache, 'user-1', key, compute);

    expect(afterInvalidate).toEqual({ result: 'computed-2' });
    expect(calls).toBe(2);
  });

  it('a cache hit is at least 10x faster than the original (uncached) computation — #19 AC3', async () => {
    const cache = new InMemoryChartResultCache();
    const expensiveMs = 200;
    const compute = async () => {
      await sleep(expensiveMs);
      return { result: 'expensive-chart' };
    };

    const uncachedStart = performance.now();
    await getOrComputeChart(cache, 'user-1', key, compute);
    const uncachedDurationMs = performance.now() - uncachedStart;

    const cachedStart = performance.now();
    await getOrComputeChart(cache, 'user-1', key, compute);
    const cachedDurationMs = performance.now() - cachedStart;

    expect(uncachedDurationMs).toBeGreaterThanOrEqual(expensiveMs);
    expect(cachedDurationMs).toBeLessThan(uncachedDurationMs / 10);
  });
});
