import { authedFetch, ApiError } from './httpClient';

export { ApiError } from './httpClient';

/** Mirrors the backend's `PlaceResult` (see `apps/backend/src/geocoding/types.ts`). */
export interface PlaceResult {
  id: string;
  name: string;
  region: string | null;
  lat: number;
  lng: number;
  source: 'az-local' | 'nominatim';
}

type ApiEnvelope<T> = (T & { error?: never }) | { error: { code: string; message: string } } | null;

/**
 * Birth-place autocomplete search (#8): the offline AZ gazetteer first, then a
 * cached/rate-limited Nominatim fallback — see `geocodingService.ts` on the
 * backend. An empty `results` array is a normal response, not an error; it's
 * the caller's cue to offer manual lat/lng/timezone entry instead.
 */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const res = await authedFetch(`/geocoding/search?q=${encodeURIComponent(trimmed)}`, {
    method: 'GET',
  });
  const data = (await res.json().catch(() => null)) as ApiEnvelope<{ results: PlaceResult[] }>;

  if (!res.ok || !data || 'error' in data) {
    const err = data && 'error' in data ? data.error : null;
    throw new ApiError(
      err?.code ?? 'unknown_error',
      err?.message ?? 'Could not search for that place. Please try again.',
    );
  }

  return data.results;
}

/** Mirrors the backend's reverse-geocode response (`geocodingService.ReverseResult`). */
export interface ReverseResult {
  name: string | null;
  region: string | null;
  timezone: string | null;
}

/**
 * Reverse-geocode a map-picked point (#8): turns coordinates into a
 * human-readable place name plus the historically-correct IANA timezone
 * (derived server-side from the coordinates). Used by the birth-place map to
 * label a dropped pin and confirm its zone.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseResult> {
  const res = await authedFetch(`/geocoding/reverse?lat=${lat}&lng=${lng}`, { method: 'GET' });
  const data = (await res.json().catch(() => null)) as ApiEnvelope<ReverseResult>;

  if (!res.ok || !data || 'error' in data) {
    const err = data && 'error' in data ? data.error : null;
    throw new ApiError(
      err?.code ?? 'unknown_error',
      err?.message ?? 'Could not look up that location. Please try again.',
    );
  }

  return data;
}
