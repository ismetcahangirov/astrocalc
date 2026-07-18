import { AZ_CITIES, type AzCity } from './azCities';
import { normalizeAzSearchKey } from './azLocale';
import type { PlaceResult } from './types';

/** Lower rank = better match. */
const RANK_EXACT = 0;
const RANK_PREFIX = 1;
const RANK_CONTAINS = 2;

function bestRank(query: string, city: AzCity): number | null {
  const candidates = [city.name, ...(city.aliases ?? [])];
  let best: number | null = null;
  for (const candidate of candidates) {
    const key = normalizeAzSearchKey(candidate);
    let rank: number | null = null;
    if (key === query) rank = RANK_EXACT;
    else if (key.startsWith(query)) rank = RANK_PREFIX;
    else if (key.includes(query)) rank = RANK_CONTAINS;

    if (rank !== null && (best === null || rank < best)) best = rank;
  }
  return best;
}

/**
 * Search the embedded, offline Azerbaijan gazetteer. Works with no network —
 * satisfies the "must work offline" acceptance criterion independent of
 * Nominatim availability. Matching is locale-aware (see {@link normalizeAzSearchKey})
 * so Azerbaijani diacritics fold correctly regardless of the input's casing.
 */
export function searchAzCities(rawQuery: string, limit = 10): PlaceResult[] {
  const query = normalizeAzSearchKey(rawQuery);
  if (!query) return [];

  const matches: { city: AzCity; rank: number }[] = [];
  for (const city of AZ_CITIES) {
    const rank = bestRank(query, city);
    if (rank !== null) matches.push({ city, rank });
  }

  matches.sort((a, b) => a.rank - b.rank || a.city.name.localeCompare(b.city.name, 'az'));

  return matches.slice(0, limit).map(({ city }) => ({
    id: city.id,
    name: city.name,
    region: city.region,
    lat: city.lat,
    lng: city.lng,
    source: 'az-local' as const,
  }));
}
