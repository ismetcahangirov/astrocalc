import { findTimeZones } from '@astrocalc/calc-engine/node';

/**
 * Derive the historically-correct IANA timezone for a birth place from its
 * coordinates. This is the single authoritative point where a stored
 * `birthPlaceTimezone` is set (for both the user's own profile and, later,
 * saved subjects) — the client is never trusted to supply the zone, because a
 * wrong or missing zone shifts the UT conversion and corrupts every downstream
 * chart position.
 *
 * Returns `null` when either coordinate is absent (an incomplete place), and —
 * defensively — when `geo-tz` cannot resolve a zone (it throws only on invalid
 * coordinates, which the route layer already range-validates, so in practice
 * this only guards against bad data rather than normal input).
 */
export type BirthTimezoneResolver = (
  lat: number | null | undefined,
  lng: number | null | undefined,
) => string | null;

export const deriveBirthTimezone: BirthTimezoneResolver = (lat, lng) => {
  if (lat == null || lng == null) return null;
  try {
    const zones = findTimeZones({ latitude: lat, longitude: lng });
    return zones[0] ?? null;
  } catch {
    return null;
  }
};
