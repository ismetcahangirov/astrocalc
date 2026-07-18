import { DateTime, IANAZone } from 'luxon';
import { CalcEngineError } from './errors';

/**
 * Local time → UT conversion, and its supporting types.
 *
 * Everything in this module is pure JavaScript that depends only on `luxon`
 * (which reads the host's Intl/ICU timezone database) — it never touches
 * `geo-tz`, and therefore never touches Node's `fs`. That is deliberate: this
 * module is on the React Native bundle's import path (see
 * `packages/calc-engine/src/index.ts`), so it must stay free of Node-only
 * dependencies. Coordinate → IANA-zone lookup, which *does* need `geo-tz`,
 * lives in the Node-only `./timezone-lookup` module instead.
 */

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

/**
 * Assert a value is a finite number, or throw `invalid_input`. Shared with the
 * Node-only `./timezone-lookup` module; not part of the package's public API.
 */
export function requireFinite(value: number, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CalcEngineError('invalid_input', `${label} must be a finite number`);
  }
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
