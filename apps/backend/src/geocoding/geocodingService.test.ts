import { describe, expect, it, vi } from 'vitest';
import { createGeocodingService } from './geocodingService';
import { InMemoryGeocodeCache } from './geocodeCache';
import { InMemoryNominatimRateLimiter } from './nominatimRateLimiter';
import type { NominatimResult } from './types';

const config = {
  cacheTtlSeconds: 3600,
  localLimit: 10,
  remoteLimit: 10,
  minLocalResultsBeforeRemote: 1,
};

function build(
  nominatimResults: NominatimResult[] = [],
  nominatimImpl?: () => Promise<NominatimResult[]>,
) {
  const search = vi.fn(nominatimImpl ?? (async () => nominatimResults));
  const cache = new InMemoryGeocodeCache();
  const rateLimiter = new InMemoryNominatimRateLimiter({ sleep: async () => undefined });
  const onRemoteError = vi.fn();
  const service = createGeocodingService({
    nominatim: { search },
    cache,
    rateLimiter,
    config,
    onRemoteError,
  });
  return { service, search, cache, onRemoteError };
}

describe('createGeocodingService.search', () => {
  it('returns an empty array for a blank query without touching Nominatim', async () => {
    const { service, search } = build();
    expect(await service.search('   ')).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });

  it('returns offline AZ results without calling Nominatim once the local threshold is met', async () => {
    const { service, search } = build();
    const results = await service.search('Bakı');
    expect(results.some((r) => r.id === 'baku')).toBe(true);
    expect(search).not.toHaveBeenCalled();
  });

  it('falls back to Nominatim when the local gazetteer has no match', async () => {
    const remote: NominatimResult[] = [
      { id: 'nominatim:1', name: 'Paris', region: 'Paris, France', lat: 48.8566, lng: 2.3522 },
    ];
    const { service, search } = build(remote);

    const results = await service.search('Paris');

    expect(search).toHaveBeenCalledWith('Paris', config.remoteLimit);
    expect(results).toEqual([{ ...remote[0], source: 'nominatim' }]);
  });

  it('caches Nominatim results so a repeat search does not call it again', async () => {
    const remote: NominatimResult[] = [
      { id: 'nominatim:1', name: 'Paris', region: 'Paris, France', lat: 48.8566, lng: 2.3522 },
    ];
    const { service, search } = build(remote);

    await service.search('Paris');
    await service.search('paris'); // same place, different casing -> same cache key

    expect(search).toHaveBeenCalledTimes(1);
  });

  it('degrades gracefully to local-only results when Nominatim throws', async () => {
    const { service, onRemoteError } = build(undefined, async () => {
      throw new Error('network down');
    });

    const results = await service.search('SomePlaceNotInAzList');

    expect(results).toEqual([]);
    expect(onRemoteError).toHaveBeenCalledTimes(1);
  });

  it('rate-limits the Nominatim call', async () => {
    const cache = new InMemoryGeocodeCache();
    const rateLimiter = new InMemoryNominatimRateLimiter({ sleep: async () => undefined });
    const acquireSpy = vi.spyOn(rateLimiter, 'acquire');
    const search = vi.fn(async () => [] as NominatimResult[]);
    const service = createGeocodingService({
      nominatim: { search },
      cache,
      rateLimiter,
      config,
    });

    await service.search('NotInLocalList');

    expect(acquireSpy).toHaveBeenCalledTimes(1);
  });
});
