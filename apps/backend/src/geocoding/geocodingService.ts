import { normalizeAzSearchKey } from './azLocale';
import { deriveBirthTimezone, type BirthTimezoneResolver } from './birthTimezone';
import { searchAzCities } from './localSearch';
import type { GeocodeCache } from './geocodeCache';
import type { NominatimClient } from './nominatimClient';
import type { NominatimRateLimiter } from './nominatimRateLimiter';
import type { PlaceResult } from './types';

/** Reverse-geocode result: a human-readable place plus the derived birth timezone. */
export interface ReverseResult {
  name: string | null;
  region: string | null;
  timezone: string | null;
}

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
  nominatim: Pick<NominatimClient, 'search' | 'reverse'>;
  cache: GeocodeCache;
  rateLimiter: NominatimRateLimiter;
  config: GeocodingServiceConfig;
  /** Injectable logger for swallowed Nominatim failures — defaults to console.warn. */
  onRemoteError?: (err: unknown) => void;
  /** Coordinate → IANA timezone resolver; defaults to the real `geo-tz` lookup. */
  deriveTimezone?: BirthTimezoneResolver;
}

export interface GeocodingService {
  search(query: string): Promise<PlaceResult[]>;
  reverse(lat: number, lng: number): Promise<ReverseResult>;
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
  const { nominatim, cache, rateLimiter, config, deriveTimezone = deriveBirthTimezone } = deps;
  const onRemoteError =
    deps.onRemoteError ?? ((err) => console.warn('[geocoding] Nominatim lookup failed:', err));

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

    async reverse(lat: number, lng: number): Promise<ReverseResult> {
      // The timezone is derived locally from the coordinates and is independent
      // of Nominatim, so a reverse-geocode failure never loses it — the map can
      // always confirm the zone even when the place name is unavailable.
      const timezone = deriveTimezone(lat, lng);

      const cacheKey = `reverse:${lat.toFixed(4)},${lng.toFixed(4)}`;
      try {
        // A cached `[]` means "reverse geocoding found no place here" — distinct
        // from `null`, which is a cache miss.
        const cached = await cache.get(cacheKey);
        let place;
        if (cached !== null) {
          place = cached[0] ?? null;
        } else {
          await rateLimiter.acquire();
          const found = await nominatim.reverse(lat, lng);
          place = found
            ? { id: found.id, name: found.name, region: found.region, lat, lng }
            : null;
          await cache.set(cacheKey, place ? [place] : [], config.cacheTtlSeconds);
        }
        return { name: place?.name ?? null, region: place?.region ?? null, timezone };
      } catch (err) {
        onRemoteError(err);
        return { name: null, region: null, timezone };
      }
    },
  };
}
