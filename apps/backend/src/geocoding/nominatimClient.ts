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
}

interface NominatimApiEntry {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
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
      return body.map((entry) => ({
        id: `nominatim:${entry.place_id}`,
        name: entry.name?.trim() || entry.display_name.split(',')[0]?.trim() || entry.display_name,
        region: entry.display_name,
        lat: Number(entry.lat),
        lng: Number(entry.lon),
      }));
    },
  };
}
