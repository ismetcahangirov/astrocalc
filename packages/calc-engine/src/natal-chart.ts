import { CalcEngineError } from './errors';
import type { GeoCoordinates } from './types';
import { localTimeToUtc, type LocalDateTime } from './timezone';
import { parseIsoDate } from './date-parsing';
import {
  computePlanetaryPositions,
  type LunarNodeModel,
  type PlanetPosition,
} from './planetary-positions';
import { computeHouses, DEFAULT_HOUSE_SYSTEM, type HouseSystem, type HousesResult } from './houses';
import { computeAspects, type Aspect, type OrbConfig } from './aspects';

/**
 * Natal-chart assembly: the single, platform-independent function that turns a
 * birth record into a full chart (planet positions, houses, aspects).
 *
 * This is the one place the individual calc modules are composed, and it is the
 * shared source of truth behind issue #20's acceptance criterion "no difference
 * between an offline-computed result and the backend's result": the backend and
 * the mobile app both call {@link computeNatalChart} with the same inputs, so
 * they compute byte-identical charts. Nothing in this file (or its imports)
 * touches `geo-tz`/`fs`, so it runs unchanged in React Native — the birth-place
 * timezone is resolved upstream (on the backend, once, at profile-save time) and
 * passed in as {@link NatalChartInput.timezone}.
 *
 * Deliberately *not* included here: interpretation / reading text. That is
 * Pro-only, valuable data that stays behind the backend (spec §5.1), so it is
 * never part of the on-device calculation.
 */

/** Version of the {@link NatalChart} shape, bumped on any breaking change. */
export const NATAL_CHART_SCHEMA_VERSION = 1;

/**
 * A birth record, as the profile stores it. Dates and times are plain strings so
 * this is trivially serialisable and identical across backend and device.
 */
export interface NatalChartInput {
  /** Civil birth date at the birth place, `YYYY-MM-DD`. */
  birthDate: string;
  /**
   * Civil birth time at the birth place, `HH:MM` or `HH:MM:SS` (24-hour). May be
   * `null`/omitted when {@link birthTimeKnown} is `false`.
   */
  birthTime?: string | null;
  /**
   * Whether the exact birth time is known. When `false`, the chart is computed
   * for local noon (the convention that minimises the Moon's worst-case error),
   * houses/Ascendant/Midheaven are omitted, and {@link NatalChart.birthTimeKnown}
   * is `false` so callers can hide the time-dependent sections.
   */
  birthTimeKnown: boolean;
  /** Birth-place latitude in WGS84 decimal degrees. */
  latitude: number;
  /** Birth-place longitude in WGS84 decimal degrees. */
  longitude: number;
  /**
   * The IANA timezone of the birth place (e.g. `America/New_York`), resolved
   * upstream from the coordinates. On the backend this comes from
   * `resolveBirthInstant`/`findTimeZones` (`geo-tz`); on the device it is the
   * zone persisted on the profile. Passing it in — rather than looking it up —
   * is what keeps this function `geo-tz`-free and RN-safe.
   */
  timezone: string;
}

/** Tuning knobs for {@link computeNatalChart}. All optional, with sane defaults. */
export interface NatalChartOptions {
  /** House system to compute. Defaults to {@link DEFAULT_HOUSE_SYSTEM} (Placidus). */
  houseSystem?: HouseSystem;
  /** Per-aspect-type orb overrides, merged over the engine defaults. */
  orbs?: OrbConfig;
  /** Lunar-node model for the nodes. Defaults to `'true'`. */
  nodeModel?: LunarNodeModel;
  /** Include the (approximate) centaur Chiron. Off by default. */
  includeChiron?: boolean;
}

/** A fully-assembled natal chart. Every field is plain JSON-serialisable data. */
export interface NatalChart {
  /** Shape version; see {@link NATAL_CHART_SCHEMA_VERSION}. */
  schemaVersion: number;
  /** The birth instant in Universal Time, ISO 8601 with a trailing `Z`. */
  utDateTime: string;
  /** The IANA zone the local birth time was interpreted in. */
  timezone: string;
  /** Offset from UT actually applied, in minutes east of Greenwich. */
  offsetMinutes: number;
  /** Whether the birth time fell within a daylight-saving period. */
  isDST: boolean;
  /** Echoes {@link NatalChartInput.birthTimeKnown}; `false` ⇒ {@link houses} is `null`. */
  birthTimeKnown: boolean;
  /** The birth-place coordinates the chart was computed for. */
  coordinates: GeoCoordinates;
  /** Ecliptic positions of every body, in the engine's fixed order. */
  positions: PlanetPosition[];
  /**
   * Houses, Ascendant and Midheaven — or `null` when the birth time is unknown,
   * since none of those are meaningful without it.
   */
  houses: HousesResult | null;
  /** Major aspects between the computed bodies. */
  aspects: Aspect[];
}

const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Noon is the standard "unknown birth time" convention — it minimises the
 * worst-case error of the fast-moving Moon (±6.5° rather than ±13°). */
const UNKNOWN_TIME_HOUR = 12;

/** Parse a strict `HH:MM` / `HH:MM:SS` time into its numeric parts, or throw. */
function parseTime(birthTime: string): { hour: number; minute: number; second: number } {
  const match = typeof birthTime === 'string' ? TIME_PATTERN.exec(birthTime) : null;
  if (!match) {
    throw new CalcEngineError(
      'invalid_input',
      `birthTime must be 'HH:MM' or 'HH:MM:SS', got: ${birthTime}`,
    );
  }
  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
    second: match[3] ? Number(match[3]) : 0,
  };
}

/**
 * Build the local wall-clock {@link LocalDateTime} from a birth record, applying
 * the noon convention when the time is unknown.
 */
function toLocalDateTime(input: NatalChartInput): LocalDateTime {
  const { year, month, day } = parseIsoDate(input.birthDate);

  if (!input.birthTimeKnown) {
    return { year, month, day, hour: UNKNOWN_TIME_HOUR, minute: 0, second: 0 };
  }

  if (input.birthTime == null) {
    throw new CalcEngineError('invalid_input', 'birthTime is required when birthTimeKnown is true');
  }

  const { hour, minute, second } = parseTime(input.birthTime);
  return { year, month, day, hour, minute, second };
}

/**
 * Compute a complete natal chart from a birth record.
 *
 * Pipeline: local birth time + stored zone → UT instant ({@link localTimeToUtc});
 * → planetary positions; → houses (only when the birth time is known); → aspects
 * between all computed bodies. The result is a plain object with no interpretation
 * text — see the module header for why.
 *
 * @param input   The birth record; see {@link NatalChartInput}.
 * @param options Optional tuning; see {@link NatalChartOptions}.
 * @throws {CalcEngineError}
 *   `invalid_input` for a malformed date/time or coordinates; `invalid_timezone`
 *   for an unknown IANA zone. Propagates errors from the underlying modules.
 */
export function computeNatalChart(
  input: NatalChartInput,
  options: NatalChartOptions = {},
): NatalChart {
  const {
    houseSystem = DEFAULT_HOUSE_SYSTEM,
    orbs,
    nodeModel = 'true',
    includeChiron = false,
  } = options;

  const local = toLocalDateTime(input);
  const conversion = localTimeToUtc(local, input.timezone);
  const utDateTime = conversion.utc;

  const coordinates: GeoCoordinates = { latitude: input.latitude, longitude: input.longitude };

  const positions = computePlanetaryPositions(utDateTime, { nodeModel, includeChiron });

  // Houses/Ascendant/Midheaven are only meaningful with a known birth time.
  const houses = input.birthTimeKnown
    ? computeHouses(utDateTime, coordinates, { system: houseSystem })
    : null;

  const aspects = computeAspects(
    positions.map((p) => ({ body: p.body, longitude: p.longitude, speed: p.speed })),
    orbs ? { orbs } : {},
  );

  return {
    schemaVersion: NATAL_CHART_SCHEMA_VERSION,
    utDateTime,
    timezone: conversion.zone,
    offsetMinutes: conversion.offsetMinutes,
    isDST: conversion.isDST,
    birthTimeKnown: input.birthTimeKnown,
    coordinates,
    positions,
    houses,
    aspects,
  };
}
