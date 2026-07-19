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
  reverseImpl: () => Promise<NominatimResult | null> = async () => null,
) {
  const search = vi.fn(nominatimImpl ?? (async () => nominatimResults));
  const reverse = vi.fn(reverseImpl);
  const cache = new InMemoryGeocodeCache();
  const rateLimiter = new InMemoryNominatimRateLimiter({ sleep: async () => undefined });
  const onRemoteError = vi.fn();
  // Fake resolver: Baku coordinates -> Asia/Baku, anything else -> null.
  const deriveTimezone = (lat: number | null | undefined, lng: number | null | undefined) =>
    lat === 40.4 && lng === 49.8 ? 'Asia/Baku' : null;
  const service = createGeocodingService({
    nominatim: { search, reverse },
    cache,
    rateLimiter,
    config,
    onRemoteError,
    deriveTimezone,
  });
  return { service, search, reverse, cache, onRemoteError };
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
    const reverse = vi.fn(async () => null);
    const service = createGeocodingService({
      nominatim: { search, reverse },
      cache,
      rateLimiter,
      config,
    });

    await service.search('NotInLocalList');

    expect(acquireSpy).toHaveBeenCalledTimes(1);
  });
});

describe('createGeocodingService.reverse', () => {
  const BAKU = { lat: 40.4, lng: 49.8 };

  it('returns the reverse-geocoded place name plus the derived timezone', async () => {
    const { service, reverse } = build([], undefined, async () => ({
      id: 'nominatim:1',
      name: 'Baku',
      region: 'Baku, Azerbaijan',
      lat: BAKU.lat,
      lng: BAKU.lng,
    }));

    const result = await service.reverse(BAKU.lat, BAKU.lng);

    expect(result).toEqual({ name: 'Baku', region: 'Baku, Azerbaijan', timezone: 'Asia/Baku' });
    expect(reverse).toHaveBeenCalledWith(BAKU.lat, BAKU.lng);
  });

  it('still returns the derived timezone when Nominatim finds no place', async () => {
    const { service } = build([], undefined, async () => null);

    const result = await service.reverse(BAKU.lat, BAKU.lng);

    expect(result).toEqual({ name: null, region: null, timezone: 'Asia/Baku' });
  });

  it('still returns the derived timezone when the reverse lookup throws', async () => {
    const { service, onRemoteError } = build([], undefined, async () => {
      throw new Error('nominatim down');
    });

    const result = await service.reverse(BAKU.lat, BAKU.lng);

    expect(result).toEqual({ name: null, region: null, timezone: 'Asia/Baku' });
    expect(onRemoteError).toHaveBeenCalledTimes(1);
  });

  it('caches the reverse result so a repeat lookup does not re-hit Nominatim', async () => {
    const { service, reverse } = build([], undefined, async () => ({
      id: 'nominatim:1',
      name: 'Baku',
      region: 'Baku, Azerbaijan',
      lat: BAKU.lat,
      lng: BAKU.lng,
    }));

    await service.reverse(BAKU.lat, BAKU.lng);
    await service.reverse(BAKU.lat, BAKU.lng);

    expect(reverse).toHaveBeenCalledTimes(1);
  });
});
