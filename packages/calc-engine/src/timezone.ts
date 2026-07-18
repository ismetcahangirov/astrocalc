import { find } from 'geo-tz/all';
import { DateTime, IANAZone } from 'luxon';
import { CalcEngineError } from './errors';
import type { GeoCoordinates } from './types';

/**
 * A local ("wall-clock") civil date and time at the place of birth, as it would
 * have read on a clock there — with no timezone or UTC offset attached. Turning
 * this into a UT instant is exactly the job of this module: the offset is
 * *derived* from the place and date, never supplied by the caller.
 *
 * `month` is 1–12, `day` is 1–31. `hour` (0–23), `minute` and `second` default
 * to 0 when omitted, so a date-only birth record resolves to local midnight.
 */
export interface LocalDateTime {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
}

/** The result of converting a local time in a known zone to Universal Time. */
export interface UtcConversion {
  /** The IANA zone the local time was interpreted in. */
  zone: string;
  /**
   * The instant in Universal Time, as an ISO 8601 string ending in `Z`, e.g.
   * `'2007-03-15T16:00:00.000Z'`. This is the value every downstream calc-engine
   * module (planetary positions, houses, aspects) consumes as its `utDateTime`.
   */
  utc: string;
  /**
   * The offset from UT actually applied to the local time, in minutes, east of
   * Greenwich positive (New York winter is `-300`). Reflects the historical
   * rule in force on that date, so it can be fractional for pre-standardisation
   * Local Mean Time (Paris before 1891 is `+9.35`, i.e. +00:09:21).
   */
  offsetMinutes: number;
  /**
   * The zone's short offset name at that instant (e.g. `'GMT-5'`, `'GMT+11'`),
   * as reported by the host's Intl/ICU data. Informational only — its exact
   * spelling varies by platform, so callers should not parse it.
   */
  offsetName: string | null;
  /** Whether the local time fell within a daylight-saving period. */
  isDST: boolean;
}

/** The result of resolving a local birth time and place all the way to UT. */
export interface ResolvedInstant extends UtcConversion {
  /**
   * Every IANA zone `geo-tz` returned for the coordinates. Usually one; more
   * than one only near contested borders. {@link UtcConversion.zone} is the
   * first of these.
   */
  candidateZones: string[];
}

/** Assert a value is a finite number, or throw `invalid_input`. */
function requireFinite(value: number, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CalcEngineError('invalid_input', `${label} must be a finite number`);
  }
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
    throw new CalcEngineError(
      'invalid_input',
      `longitude out of range [-180, 180]: ${longitude}`,
    );
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
 * Convert a local wall-clock time to Universal Time using the DST and offset
 * rules that were actually in force in `zone` on that date.
 *
 * The heavy lifting is `luxon`'s zone-aware {@link DateTime}, which reads the
 * host IANA/tz database: historical DST rule changes, one-off standard-time
 * shifts, and pre-1900 Local Mean Time are all applied — no static offset is
 * ever assumed. Local times that are ambiguous (the "fall back" fold) or
 * non-existent (the "spring forward" gap) are resolved by luxon rather than
 * rejected, so every valid calendar time yields an instant.
 *
 * @param local
 *   The civil date and time as read on a local clock. See {@link LocalDateTime}.
 * @param zone
 *   An IANA timezone identifier, e.g. `'America/New_York'` — typically one
 *   returned by {@link findTimeZones}.
 * @returns
 *   The {@link UtcConversion}: the UT instant plus the offset that was applied.
 * @throws {CalcEngineError}
 *   `invalid_timezone` if `zone` is not a known IANA zone; `invalid_input` if a
 *   date/time component is non-finite or forms an impossible calendar date.
 */
export function localTimeToUtc(local: LocalDateTime, zone: string): UtcConversion {
  if (typeof zone !== 'string' || !IANAZone.isValidZone(zone)) {
    throw new CalcEngineError('invalid_timezone', `unknown IANA timezone: ${String(zone)}`);
  }

  const { year, month, day, hour = 0, minute = 0, second = 0 } = local;
  requireFinite(year, 'year');
  requireFinite(month, 'month');
  requireFinite(day, 'day');
  requireFinite(hour, 'hour');
  requireFinite(minute, 'minute');
  requireFinite(second, 'second');

  const dt = DateTime.fromObject({ year, month, day, hour, minute, second }, { zone });
  if (!dt.isValid) {
    const reason = dt.invalidExplanation ?? dt.invalidReason ?? 'unknown';
    throw new CalcEngineError(
      'invalid_input',
      `invalid local date-time for zone ${zone}: ${reason}`,
    );
  }

  return {
    zone,
    // toJSDate() is the instant luxon computed from the zone rules; its
    // toISOString() is canonical UT with a trailing 'Z'.
    utc: dt.toJSDate().toISOString(),
    offsetMinutes: dt.offset,
    offsetName: dt.offsetNameShort,
    isDST: dt.isInDST,
  };
}

/**
 * Resolve a local birth time and place all the way to a UT instant: look up the
 * historically-correct IANA zone from the coordinates with {@link findTimeZones},
 * then convert with {@link localTimeToUtc}.
 *
 * This is the single entry point every other calc-engine module depends on — an
 * error here (wrong zone, static offset) would corrupt every downstream result —
 * so both the geographic lookup and the historical DST conversion are done from
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
