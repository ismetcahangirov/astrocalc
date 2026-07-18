import { describe, expect, it } from 'vitest';
import { InMemoryGeocodeCache } from './geocodeCache';
import type { NominatimResult } from './types';

const sample: NominatimResult[] = [{ id: 'n-1', name: 'Some Place', region: null, lat: 1, lng: 2 }];

describe('InMemoryGeocodeCache', () => {
  it('returns null for a key that was never set', async () => {
    const cache = new InMemoryGeocodeCache();
    expect(await cache.get('missing')).toBeNull();
  });

  it('returns a cached value before it expires', async () => {
    let clockMs = 0;
    const cache = new InMemoryGeocodeCache(() => clockMs);

    await cache.set('sheki', sample, 60);
    clockMs += 59_000;

    expect(await cache.get('sheki')).toEqual(sample);
  });

  it('expires a value once its TTL has elapsed', async () => {
    let clockMs = 0;
    const cache = new InMemoryGeocodeCache(() => clockMs);

    await cache.set('sheki', sample, 60);
    clockMs += 60_000;

    expect(await cache.get('sheki')).toBeNull();
  });
});
