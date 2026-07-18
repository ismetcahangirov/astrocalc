import { find } from 'geo-tz/all';
import { CalcEngineError } from './errors';
import type { GeoCoordinates } from './types';
import { localTimeToUtc, requireFinite, type LocalDateTime, type UtcConversion } from './timezone';

/**
 * Coordinate → IANA-timezone lookup and the end-to-end birth-instant resolution
 * built on it. **Node-only.**
 *
 * `geo-tz` ships a multi-megabyte binary dataset that it loads from disk with
 * Node's `fs`, so it cannot run in React Native without heavy polyfills. This
 * module is therefore deliberately kept *off* the package's main entry point
 * (`./index`, which the mobile bundle imports) and is reachable only through the
 * dedicated `@astrocalc/calc-engine/node` subpath — see this package's
 * `package.json` `exports` map.
 *
 * On the device, the birth-place timezone is resolved once on the backend (via
 * these functions) at profile-save time and stored on the profile; offline
 * calculation then reuses that stored zone with the pure {@link localTimeToUtc}
 * from `./timezone`, so it never needs `geo-tz`.
 */

/** The result of resolving a local birth time and place all the way to UT. */
export interface ResolvedInstant extends UtcConversion {
  /**
   * Every IANA zone `geo-tz` returned for the coordinates. Usually one; more
   * than one only near contested borders. {@link UtcConversion.zone} is the
   * first of these.
   */
  candidateZones: string[];
}

/**
 * Determine the historically-correct IANA timezone(s) for a point on Earth.
 *
 * Uses `geo-tz`'s full ("all") dataset rather than the 1970-consolidated one, so
 * places whose timekeeping diverged before 1970 keep their own zone (e.g.
 * `America/Indiana/Indianapolis` rather than being folded into
 * `America/New_York`) — which matters for historical birth charts.
 *
 * @param coordinates
 *   Birth-place latitude/longitude in decimal degrees (WGS84).
 * @returns
 *   The candidate IANA zone IDs at that point, most-specific first. For points
 *   over open ocean this is a nautical `Etc/GMT±N` zone.
 * @throws {CalcEngineError}
 *   `invalid_input` if a coordinate is non-finite or out of range;
 *   `timezone_not_found` if `geo-tz` returns no zone at all.
 */
export function findTimeZones(coordinates: GeoCoordinates): string[] {
  const { latitude, longitude } = coordinates;
  requireFinite(latitude, 'latitude');
  requireFinite(longitude, 'longitude');
  if (latitude < -90 || latitude > 90) {
    throw new CalcEngineError('invalid_input', `latitude out of range [-90, 90]: ${latitude}`);
  }
  if (longitude < -180 || longitude > 180) {
    throw new CalcEngineError('invalid_input', `longitude out of range [-180, 180]: ${longitude}`);
  }

  const zones = find(latitude, longitude);
  if (zones.length === 0) {
    throw new CalcEngineError(
      'timezone_not_found',
      `no IANA timezone found for coordinates ${latitude}, ${longitude}`,
    );
  }
  return zones;
}

/**
 * Resolve a local birth time and place all the way to a UT instant: look up the
 * historically-correct IANA zone from the coordinates with {@link findTimeZones},
 * then convert with {@link localTimeToUtc}.
 *
 * This is the single backend entry point for turning raw birth coordinates into
 * the zone every downstream module and the offline path depend on — an error
 * here (wrong zone, static offset) would corrupt every downstream result — so
 * both the geographic lookup and the historical DST conversion are done from
 * authoritative data (`geo-tz` + the IANA tz database via `luxon`).
 *
 * @param local
 *   The civil birth date and time as read on a local clock.
 * @param coordinates
 *   The birth-place latitude/longitude in decimal degrees (WGS84).
 * @returns
 *   A {@link ResolvedInstant}: the UT instant, the applied offset, the zone
 *   used, and every candidate zone `geo-tz` returned. All fields are plain,
 *   JSON-serialisable values.
 * @throws {CalcEngineError}
 *   Propagates the errors of {@link findTimeZones} and {@link localTimeToUtc}.
 */
export function resolveBirthInstant(
  local: LocalDateTime,
  coordinates: GeoCoordinates,
): ResolvedInstant {
  const candidateZones = findTimeZones(coordinates);
  // findTimeZones guarantees a non-empty array.
  const conversion = localTimeToUtc(local, candidateZones[0]!);
  return { ...conversion, candidateZones };
}
