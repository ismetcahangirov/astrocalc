import type { NominatimResult } from './types';

export interface NominatimClientConfig {
  baseUrl?: string;
  /**
   * Required by Nominatim's usage policy: a descriptive User-Agent identifying
   * the application (ideally with contact info) —
   * https://operations.osmfoundation.org/policies/nominatim/
   */
  userAgent: string;
  fetchImpl?: typeof fetch;
}

export interface NominatimClient {
  search(query: string, limit: number): Promise<NominatimResult[]>;
  /** Reverse-geocode a point to a single place, or `null` when none is found. */
  reverse(lat: number, lng: number): Promise<NominatimResult | null>;
}

interface NominatimApiEntry {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  /** Present instead of a place when reverse geocoding finds nothing. */
  error?: string;
}

function toResult(entry: NominatimApiEntry): NominatimResult {
  return {
    id: `nominatim:${entry.place_id}`,
    name: entry.name?.trim() || entry.display_name.split(',')[0]?.trim() || entry.display_name,
    region: entry.display_name,
    lat: Number(entry.lat),
    lng: Number(entry.lon),
  };
}

/**
 * Thin client over the OpenStreetMap Nominatim `/search` endpoint. Callers
 * (see `geocodingService`) are responsible for rate-limiting and caching per
 * the usage policy — this client just shapes one request/response.
 */
export function createNominatimClient(config: NominatimClientConfig): NominatimClient {
  const baseUrl = config.baseUrl ?? 'https://nominatim.openstreetmap.org';
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async search(query: string, limit: number): Promise<NominatimResult[]> {
      const url = new URL('/search', baseUrl);
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('addressdetails', '0');

      const res = await fetchImpl(url.toString(), {
        headers: {
          'User-Agent': config.userAgent,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Nominatim search failed with status ${res.status}`);
      }

      const body = (await res.json()) as NominatimApiEntry[];
      return body.map(toResult);
    },

    async reverse(lat: number, lng: number): Promise<NominatimResult | null> {
      const url = new URL('/reverse', baseUrl);
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lng));
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('addressdetails', '0');

      const res = await fetchImpl(url.toString(), {
        headers: {
          'User-Agent': config.userAgent,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Nominatim reverse failed with status ${res.status}`);
      }

      // `/reverse` returns a single object — or `{ error }` when nothing matched.
      const body = (await res.json()) as NominatimApiEntry;
      if (!body || body.error || body.lat == null) return null;
      return toResult(body);
    },
  };
}
