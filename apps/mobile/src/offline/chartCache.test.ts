import { describe, expect, it } from 'vitest';
import type { NatalChart } from '@astrocalc/calc-engine';
import { OfflineChartCache, type CachedChart } from './chartCache';
import type { KeyValueStore } from './keyValueStore';

/** An in-memory {@link KeyValueStore} for exercising the cache without native storage. */
function memoryStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => Promise.resolve(map.get(key) ?? null),
    setItem: (key, value) => {
      map.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key) => {
      map.delete(key);
      return Promise.resolve();
    },
  };
}

/** A stand-in chart — only the fields the cache cares about (it treats it opaquely). */
const CHART = { schemaVersion: 1, utDateTime: '2007-03-15T16:00:00.000Z' } as unknown as NatalChart;

describe('OfflineChartCache', () => {
  it('returns null when nothing is stored', async () => {
    const cache = new OfflineChartCache(memoryStore());
    expect(await cache.read()).toBeNull();
    expect(await cache.getPending()).toBeNull();
  });

  it('round-trips a saved entry', async () => {
    const cache = new OfflineChartCache(memoryStore());
    const entry: CachedChart = { chart: CHART, source: 'offline', pendingSync: true };
    await cache.save(entry);
    expect(await cache.read()).toEqual(entry);
  });

  it('exposes an offline chart as pending, and a backend chart as not', async () => {
    const cache = new OfflineChartCache(memoryStore());

    await cache.save({ chart: CHART, source: 'offline', pendingSync: true });
    expect(await cache.getPending()).toEqual(CHART);

    await cache.save({ chart: CHART, source: 'backend', pendingSync: false });
    expect(await cache.getPending()).toBeNull();
  });

  it('clears the pending flag without dropping the cached chart', async () => {
    const cache = new OfflineChartCache(memoryStore());
    await cache.save({ chart: CHART, source: 'offline', pendingSync: true });

    await cache.clearPending();

    expect(await cache.getPending()).toBeNull();
    expect(await cache.read()).toEqual({ chart: CHART, source: 'offline', pendingSync: false });
  });

  it('treats a corrupt stored value as absent rather than throwing', async () => {
    const store = memoryStore();
    store.map.set('astrocalc.natalChart', '{not valid json');
    const cache = new OfflineChartCache(store);
    expect(await cache.read()).toBeNull();
  });
});
