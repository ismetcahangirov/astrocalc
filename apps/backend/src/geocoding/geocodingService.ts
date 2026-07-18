import { normalizeAzSearchKey } from './azLocale';
import { searchAzCities } from './localSearch';
import type { GeocodeCache } from './geocodeCache';
import type { NominatimClient } from './nominatimClient';
import type { NominatimRateLimiter } from './nominatimRateLimiter';
import type { PlaceResult } from './types';

export interface GeocodingServiceConfig {
  /** How long a Nominatim response is cached (seconds). */
  cacheTtlSeconds: number;
  /** Max results returned from the offline AZ gazetteer. */
  localLimit: number;
  /** Max results requested from Nominatim. */
  remoteLimit: number;
  /**
   * Skip the (rate-limited) Nominatim call once the offline gazetteer alone
   * has at least this many hits — keeps common AZ searches fully offline.
   */
  minLocalResultsBeforeRemote: number;
}

export interface GeocodingServiceDeps {
  nominatim: Pick<NominatimClient, 'search'>;
  cache: GeocodeCache;
  rateLimiter: NominatimRateLimiter;
  config: GeocodingServiceConfig;
  /** Injectable logger for swallowed Nominatim failures — defaults to console.warn. */
  onRemoteError?: (err: unknown) => void;
}

export interface GeocodingService {
  search(query: string): Promise<PlaceResult[]>;
}

/**
 * Orchestrates birth-place search: the embedded, offline AZ gazetteer first
 * (see `localSearch`), falling back to a cached/rate-limited Nominatim query
 * when the local list doesn't have enough hits. Nominatim failures (network,
 * upstream outage, rate-limit timeout) degrade gracefully to local-only
 * results rather than failing the request — an empty result set is exactly
 * the signal the client uses to offer the manual lat/lng fallback.
 */
export function createGeocodingService(deps: GeocodingServiceDeps): GeocodingService {
  const { nominatim, cache, rateLimiter, config } = deps;
  const onRemoteError = deps.onRemoteError ?? ((err) => console.warn('[geocoding] Nominatim lookup failed:', err)); // eslint-disable-line no-console

  return {
    async search(rawQuery: string): Promise<PlaceResult[]> {
      const query = rawQuery.trim();
      if (!query) return [];

      const localResults = searchAzCities(query, config.localLimit);
      if (localResults.length >= config.minLocalResultsBeforeRemote) {
        return localResults;
      }

      const cacheKey = normalizeAzSearchKey(query);
      try {
        let remote = await cache.get(cacheKey);
        if (remote === null) {
          await rateLimiter.acquire();
          remote = await nominatim.search(query, config.remoteLimit);
          await cache.set(cacheKey, remote, config.cacheTtlSeconds);
        }

        const seen = new Set(localResults.map((r) => `${r.lat.toFixed(2)},${r.lng.toFixed(2)}`));
        const remoteResults: PlaceResult[] = remote
          .filter((r) => !seen.has(`${r.lat.toFixed(2)},${r.lng.toFixed(2)}`))
          .map((r) => ({ ...r, source: 'nominatim' as const }));

        return [...localResults, ...remoteResults];
      } catch (err) {
        onRemoteError(err);
        return localResults;
      }
    },
  };
}
