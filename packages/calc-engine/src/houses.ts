import * as Astronomy from 'astronomy-engine';
import { DateTime } from 'luxon';
import { CalcEngineError } from './errors';
import type { ZodiacSign } from './planetary-positions';
import type { GeoCoordinates } from './types';

/**
 * The house systems this module can compute.
 *
 * - `placidus` — the default in most Western astrology software. Divides each
 *   ecliptic degree's diurnal/nocturnal semi-arc into equal time segments;
 *   solved iteratively. Mathematically undefined inside the polar circles
 *   (see {@link computeHouses}).
 * - `whole-sign` — the oldest system: each house is exactly one zodiac sign,
 *   the 1st house being the whole sign the Ascendant falls in. Defined at every
 *   latitude, so it doubles as the polar fallback.
 * - `koch` — the "birthplace" system: trisects the semi-arc of the Midheaven
 *   degree and takes the Ascendant at those sidereal times. Like Placidus, it
 *   is undefined inside the polar circles.
 */
export type HouseSystem = 'placidus' | 'whole-sign' | 'koch';

/** The default house system when the caller does not choose one. */
export const DEFAULT_HOUSE_SYSTEM: HouseSystem = 'placidus';

/** A single point on the ecliptic, resolved to a zodiac sign and in-sign degree. */
export interface EclipticPoint {
  /** Ecliptic longitude, in degrees within `[0, 360)`. */
  longitude: number;
  /** The zodiac sign the point occupies. */
  sign: ZodiacSign;
  /** Position within {@link sign}, in degrees within `[0, 30)`. */
  degree: number;
}

/** One of the twelve house cusps. */
export interface HouseCusp extends EclipticPoint {
  /** House number, `1`–`12`. Cusp 1 is the 1st-house cusp, etc. */
  house: number;
}

/** Options for {@link computeHouses}. */
export interface HousesOptions {
  /** Which house system to compute. Defaults to {@link DEFAULT_HOUSE_SYSTEM}. */
  system?: HouseSystem;
}

/** Result of {@link computeHouses}. Every field is plain JSON-serializable data. */
export interface HousesResult {
  /** The system the caller asked for. */
  requestedSystem: HouseSystem;
  /**
   * The system actually used. Differs from {@link requestedSystem} only when a
   * polar-latitude fallback was applied — see {@link fallbackApplied}.
   */
  system: HouseSystem;
  /**
   * `true` when the requested system could not be computed at this latitude
   * (Placidus/Koch inside the polar circles) and the result fell back to Whole
   * Sign. When `true`, {@link fallbackReason} explains why, for display to the
   * user.
   */
  fallbackApplied: boolean;
  /** Human-readable explanation of the fallback, or `null` when none occurred. */
  fallbackReason: string | null;
  /** The rising degree (1st-house cusp in quadrant systems). */
  ascendant: EclipticPoint;
  /** The culminating degree (10th-house cusp in quadrant systems). */
  midheaven: EclipticPoint;
  /** The twelve cusps, house 1 through house 12 in order. */
  cusps: HouseCusp[];
}

const SIGNS: readonly ZodiacSign[] = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
];

const FULL_CIRCLE = 360;
const HALF_CIRCLE = 180;
const RIGHT_ANGLE = 90;
const DEGREES_PER_SIGN = 30;
const DEG = Math.PI / 180;
const HOURS_TO_DEGREES = 15;

/** Wrap an angle in degrees into `[0, 360)`. */
function normalizeDegrees(deg: number): number {
  const wrapped = deg % FULL_CIRCLE;
  return wrapped < 0 ? wrapped + FULL_CIRCLE : wrapped;
}

/** Resolve an ecliptic longitude to its sign and in-sign degree. */
function toEclipticPoint(longitude: number): EclipticPoint {
  const normalized = normalizeDegrees(longitude);
  const signIndex = Math.floor(normalized / DEGREES_PER_SIGN);
  return {
    longitude: normalized,
    // signIndex is 0..11 for any normalized longitude in [0, 360).
    sign: SIGNS[signIndex]!,
    degree: normalized - signIndex * DEGREES_PER_SIGN,
  };
}

/** Parse an ISO 8601 UT date-time string into an Astronomy Engine time. */
function parseUt(utDateTime: string): Astronomy.AstroTime {
  if (typeof utDateTime !== 'string' || utDateTime.trim() === '') {
    throw new CalcEngineError(
      'invalid_input',
      'birth date-time must be a non-empty ISO 8601 UT string',
    );
  }
  const dt = DateTime.fromISO(utDateTime, { zone: 'utc' });
  if (!dt.isValid) {
    throw new CalcEngineError(
      'invalid_input',
      `birth date-time is not a valid ISO 8601 date-time: ${utDateTime}`,
    );
  }
  return Astronomy.MakeTime(dt.toJSDate());
}

/** Validate the birth place and return its latitude/longitude in degrees. */
function validatePlace(place: GeoCoordinates): { latitude: number; longitude: number } {
  const { latitude, longitude } = place ?? {};
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new CalcEngineError(
      'invalid_input',
      'birth place latitude/longitude must be finite numbers',
    );
  }
  // At the geographic poles the horizon coincides with the equator and the
  // Ascendant/Midheaven are undefined for every house system, Whole Sign
  // included — so there is nothing to fall back to.
  if (latitude <= -RIGHT_ANGLE || latitude >= RIGHT_ANGLE) {
    throw new CalcEngineError(
      'unsupported',
      'house systems are undefined exactly at the geographic poles (|latitude| = 90°)',
    );
  }
  if (longitude < -HALF_CIRCLE || longitude > FULL_CIRCLE) {
    throw new CalcEngineError('invalid_input', `birth place longitude out of range: ${longitude}`);
  }
  return { latitude, longitude };
}

/**
 * True obliquity of the ecliptic (degrees) at `time`, i.e. the tilt including
 * nutation. Extracted from Astronomy Engine's equator-of-date → ecliptic-of-date
 * rotation: that transform is a rotation about the equinox by the obliquity, so
 * the equatorial north pole `(0, 0, 1)` maps to `(0, sin ε, cos ε)`.
 */
function trueObliquity(time: Astronomy.AstroTime): number {
  const pole = Astronomy.RotateVector(
    Astronomy.Rotation_EQD_ECT(time),
    new Astronomy.Vector(0, 0, 1, time),
  );
  return Math.atan2(pole.y, pole.z) / DEG;
}

/**
 * Right ascension of the Midheaven (degrees), i.e. the local apparent sidereal
 * time expressed as an angle: Greenwich apparent sidereal time plus the east
 * longitude of the observer.
 */
function rightAscensionOfMc(time: Astronomy.AstroTime, longitude: number): number {
  const gast = Astronomy.SiderealTime(time) * HOURS_TO_DEGREES;
  return normalizeDegrees(gast + longitude);
}

/**
 * Ecliptic longitude (degrees) of the point on the ecliptic whose right
 * ascension is `raDeg`. Inverse of `tan α = cos ε · tan λ`.
 */
function eclipticLongitudeFromRa(raDeg: number, epsDeg: number): number {
  const ra = raDeg * DEG;
  const eps = epsDeg * DEG;
  return normalizeDegrees(Math.atan2(Math.sin(ra), Math.cos(eps) * Math.cos(ra)) / DEG);
}

/**
 * Ecliptic longitude (degrees) of the Midheaven — the ecliptic degree
 * culminating on the local meridian, whose right ascension equals the RAMC.
 */
function midheavenLongitude(ramcDeg: number, epsDeg: number): number {
  return eclipticLongitudeFromRa(ramcDeg, epsDeg);
}

/**
 * Ecliptic longitude (degrees) of the Ascendant — the ecliptic degree rising on
 * the eastern horizon for a meridian at `ramcDeg`, obliquity `epsDeg` and
 * geographic latitude `latDeg`.
 */
function ascendantLongitude(ramcDeg: number, epsDeg: number, latDeg: number): number {
  const ramc = ramcDeg * DEG;
  const eps = epsDeg * DEG;
  const lat = latDeg * DEG;
  const y = Math.cos(ramc);
  const x = -(Math.sin(ramc) * Math.cos(eps) + Math.tan(lat) * Math.sin(eps));
  return normalizeDegrees(Math.atan2(y, x) / DEG);
}

/** `tan` of the declination of the ecliptic point at right ascension `raDeg`. */
function tanDeclinationAtRa(raDeg: number, epsDeg: number): number {
  return Math.tan(epsDeg * DEG) * Math.sin(raDeg * DEG);
}

/** The four intermediate cusps (11, 12, 2, 3) of a quadrant house system. */
interface IntermediateCusps {
  house11: number;
  house12: number;
  house2: number;
  house3: number;
}

/**
 * Solve one Placidus intermediate cusp by fixed-point iteration.
 *
 * A cusp is the ecliptic point that has traversed the fraction `f` of its own
 * diurnal (`nocturnal = false`) or nocturnal (`nocturnal = true`) semi-arc away
 * from the meridian. The point's semi-arc depends on its declination, which
 * depends on its right ascension, which depends on the cusp — hence the
 * iteration. Returns `null` when the point is circumpolar (semi-arc undefined),
 * which is exactly the polar-latitude case where Placidus breaks down.
 */
function placidusCusp(
  ramcDeg: number,
  epsDeg: number,
  tanLat: number,
  f: number,
  nocturnal: boolean,
): number | null {
  // Initial guess assumes a 90° semi-arc (the equatorial value).
  let alpha = nocturnal ? ramcDeg + HALF_CIRCLE - f * RIGHT_ANGLE : ramcDeg + f * RIGHT_ANGLE;
  for (let i = 0; i < 100; i++) {
    const product = tanLat * tanDeclinationAtRa(alpha, epsDeg);
    const arg = nocturnal ? product : -product;
    if (Math.abs(arg) > 1) return null;
    const semiArc = Math.acos(arg) / DEG;
    const next = nocturnal ? ramcDeg + HALF_CIRCLE - f * semiArc : ramcDeg + f * semiArc;
    if (Math.abs(next - alpha) < 1e-9) {
      alpha = next;
      break;
    }
    alpha = next;
  }
  return eclipticLongitudeFromRa(alpha, epsDeg);
}

/**
 * Placidus intermediate cusps, or `null` if any is undefined at this latitude.
 * Cusps 11 & 12 divide the Midheaven-to-Ascendant diurnal semi-arc into thirds;
 * cusps 2 & 3 divide the Ascendant-to-Imum-Coeli nocturnal semi-arc.
 */
function placidusCusps(ramcDeg: number, epsDeg: number, latDeg: number): IntermediateCusps | null {
  const tanLat = Math.tan(latDeg * DEG);
  const house11 = placidusCusp(ramcDeg, epsDeg, tanLat, 1 / 3, false);
  const house12 = placidusCusp(ramcDeg, epsDeg, tanLat, 2 / 3, false);
  const house2 = placidusCusp(ramcDeg, epsDeg, tanLat, 2 / 3, true);
  const house3 = placidusCusp(ramcDeg, epsDeg, tanLat, 1 / 3, true);
  if (house11 === null || house12 === null || house2 === null || house3 === null) {
    return null;
  }
  return { house11, house12, house2, house3 };
}

/**
 * Koch intermediate cusps, or `null` if undefined at this latitude. The
 * Midheaven degree's semidiurnal arc (SDA = 90° + its ascensional difference)
 * and seminocturnal arc (SNA = 90° − it) are each trisected; the cusps are the
 * Ascendant taken at the sidereal times marking those divisions.
 */
function kochCusps(ramcDeg: number, epsDeg: number, latDeg: number): IntermediateCusps | null {
  // Ascensional difference of the Midheaven degree (its RA is the RAMC).
  const product = Math.tan(latDeg * DEG) * tanDeclinationAtRa(ramcDeg, epsDeg);
  if (Math.abs(product) > 1) return null;
  const adMc = Math.asin(product) / DEG;
  const semiDiurnal = RIGHT_ANGLE + adMc;
  const semiNocturnal = RIGHT_ANGLE - adMc;
  return {
    house11: ascendantLongitude(ramcDeg - (2 / 3) * semiDiurnal, epsDeg, latDeg),
    house12: ascendantLongitude(ramcDeg - (1 / 3) * semiDiurnal, epsDeg, latDeg),
    house2: ascendantLongitude(ramcDeg + (1 / 3) * semiNocturnal, epsDeg, latDeg),
    house3: ascendantLongitude(ramcDeg + (2 / 3) * semiNocturnal, epsDeg, latDeg),
  };
}

/**
 * Assemble the twelve cusps of a quadrant system (Placidus/Koch) from the
 * Ascendant, Midheaven and the four intermediate cusps. Cusps 4–9 are the exact
 * opposites of cusps 10–3.
 */
function quadrantCusps(ascLon: number, mcLon: number, mid: IntermediateCusps): number[] {
  return [
    ascLon, // 1
    mid.house2, // 2
    mid.house3, // 3
    mcLon + HALF_CIRCLE, // 4 (IC)
    mid.house11 + HALF_CIRCLE, // 5
    mid.house12 + HALF_CIRCLE, // 6
    ascLon + HALF_CIRCLE, // 7 (Descendant)
    mid.house2 + HALF_CIRCLE, // 8
    mid.house3 + HALF_CIRCLE, // 9
    mcLon, // 10
    mid.house11, // 11
    mid.house12, // 12
  ];
}

/** Whole Sign cusps: house 1 starts at 0° of the Ascendant's sign. */
function wholeSignCusps(ascLon: number): number[] {
  const firstCusp = Math.floor(normalizeDegrees(ascLon) / DEGREES_PER_SIGN) * DEGREES_PER_SIGN;
  return Array.from({ length: 12 }, (_, i) => firstCusp + i * DEGREES_PER_SIGN);
}

/** Turn twelve raw longitudes into numbered {@link HouseCusp}s. */
function toCusps(longitudes: number[]): HouseCusp[] {
  return longitudes.map((longitude, index) => ({
    house: index + 1,
    ...toEclipticPoint(longitude),
  }));
}

/**
 * Which of the twelve houses a given ecliptic longitude falls in, given a set
 * of {@link HouseCusp}s (typically {@link HousesResult.cusps}). A longitude
 * exactly on a cusp belongs to the house that cusp opens (matching the usual
 * astrological convention), and the wrap-around from house 12 back to house 1
 * across 360°/0° is handled correctly.
 *
 * @throws {CalcEngineError}
 *   `invalid_input` if `cusps` does not contain exactly 12 entries or
 *   `longitude` is not a finite number.
 */
export function findHouseNumber(cusps: HouseCusp[], longitude: number): number {
  if (cusps.length !== 12) {
    throw new CalcEngineError(
      'invalid_input',
      `expected exactly 12 house cusps, got ${cusps.length}`,
    );
  }
  if (!Number.isFinite(longitude)) {
    throw new CalcEngineError(
      'invalid_input',
      `longitude must be a finite number, got ${longitude}`,
    );
  }

  const sorted = [...cusps].sort((a, b) => a.house - b.house);
  const target = normalizeDegrees(longitude);
  for (let i = 0; i < 12; i++) {
    const start = normalizeDegrees(sorted[i]!.longitude);
    const end = normalizeDegrees(sorted[(i + 1) % 12]!.longitude);
    const span = normalizeDegrees(end - start) || FULL_CIRCLE;
    const offset = normalizeDegrees(target - start);
    if (offset < span) return sorted[i]!.house;
  }
  // Unreachable for a well-formed 12-cusp set (the arcs above always cover the
  // full circle), but keeps the function total rather than possibly undefined.
  return sorted[11]!.house;
}

/**
 * Compute the house cusps, Ascendant and Midheaven for a birth moment and place.
 *
 * Placidus (the default) and Koch are quadrant systems that are mathematically
 * undefined inside the polar circles — roughly |latitude| ≳ 66.6°, where the
 * ecliptic degrees forming the cusps never rise or set. When the requested
 * quadrant system cannot be computed at the given latitude, the result
 * transparently falls back to Whole Sign: {@link HousesResult.fallbackApplied}
 * is set and {@link HousesResult.fallbackReason} carries a message suitable for
 * display. The Ascendant and Midheaven are still reported in that case.
 *
 * The house-system section should only be shown when the birth *time* is known;
 * without it neither the cusps nor the Ascendant/Midheaven are meaningful. This
 * function therefore requires a full date-time — callers that only have a birth
 * date must omit the house section and show planet–sign positions alone.
 *
 * @param utDateTime
 *   Birth instant as an ISO 8601 string in Universal Time, e.g.
 *   `'1990-05-15T13:45:00Z'`. A zone-less string is read as UTC; an explicit
 *   offset is honoured. Converting local birth time + place to UT is the job of
 *   the timezone-accuracy step (#16), upstream of this function.
 * @param place
 *   Birth place as WGS84 decimal degrees (see {@link GeoCoordinates}).
 * @param options
 *   See {@link HousesOptions}.
 * @throws {CalcEngineError}
 *   `invalid_input` for an unparseable date-time or out-of-range coordinates;
 *   `unsupported` exactly at the geographic poles.
 */
export function computeHouses(
  utDateTime: string,
  place: GeoCoordinates,
  options: HousesOptions = {},
): HousesResult {
  const requestedSystem = options.system ?? DEFAULT_HOUSE_SYSTEM;
  const time = parseUt(utDateTime);
  const { latitude, longitude } = validatePlace(place);

  const eps = trueObliquity(time);
  const ramc = rightAscensionOfMc(time, longitude);
  const ascLon = ascendantLongitude(ramc, eps, latitude);
  const mcLon = midheavenLongitude(ramc, eps);

  const ascendant = toEclipticPoint(ascLon);
  const midheaven = toEclipticPoint(mcLon);

  if (requestedSystem === 'whole-sign') {
    return {
      requestedSystem,
      system: 'whole-sign',
      fallbackApplied: false,
      fallbackReason: null,
      ascendant,
      midheaven,
      cusps: toCusps(wholeSignCusps(ascLon)),
    };
  }

  const intermediate =
    requestedSystem === 'koch'
      ? kochCusps(ramc, eps, latitude)
      : placidusCusps(ramc, eps, latitude);

  if (intermediate === null) {
    const label = requestedSystem === 'koch' ? 'Koch' : 'Placidus';
    const criticalLatitude = (RIGHT_ANGLE - eps).toFixed(1);
    return {
      requestedSystem,
      system: 'whole-sign',
      fallbackApplied: true,
      fallbackReason:
        `${label} house cusps are mathematically undefined at this latitude ` +
        `(${latitude.toFixed(1)}°): inside the polar circles (beyond ±${criticalLatitude}°) ` +
        `the ecliptic degrees that form the cusps never rise or set. ` +
        `Showing Whole Sign houses instead.`,
      ascendant,
      midheaven,
      cusps: toCusps(wholeSignCusps(ascLon)),
    };
  }

  return {
    requestedSystem,
    system: requestedSystem,
    fallbackApplied: false,
    fallbackReason: null,
    ascendant,
    midheaven,
    cusps: toCusps(quadrantCusps(ascLon, mcLon, intermediate)),
  };
}
