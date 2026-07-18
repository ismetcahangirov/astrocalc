import * as Astronomy from 'astronomy-engine';
import { DateTime } from 'luxon';
import { CalcEngineError } from './errors';

/**
 * The twelve tropical zodiac signs, in ecliptic order starting at the March
 * equinox (0° = Aries, 30° = Taurus, … 330° = Pisces).
 */
export type ZodiacSign =
  | 'Aries'
  | 'Taurus'
  | 'Gemini'
  | 'Cancer'
  | 'Leo'
  | 'Virgo'
  | 'Libra'
  | 'Scorpio'
  | 'Sagittarius'
  | 'Capricorn'
  | 'Aquarius'
  | 'Pisces';

/**
 * The bodies and calculated points this module can place on the ecliptic.
 * `sun`/`moon` are the luminaries, `mercury`–`pluto` the planets, `northNode`/
 * `southNode` the (ascending/descending) lunar nodes, and `chiron` the centaur
 * (opt-in, and only approximate — see {@link computePlanetaryPositions}).
 */
export type CelestialBody =
  | 'sun'
  | 'moon'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto'
  | 'northNode'
  | 'southNode'
  | 'chiron';

/** Ecliptic placement of a single body at a single instant. */
export interface PlanetPosition {
  /** Which body/point this placement describes. */
  body: CelestialBody;
  /**
   * Apparent geocentric tropical ecliptic longitude, in degrees within
   * `[0, 360)`, referred to the true equinox of date (i.e. the Western
   * tropical zodiac).
   */
  longitude: number;
  /** The zodiac sign the body occupies. */
  sign: ZodiacSign;
  /** Position within {@link sign}, in degrees within `[0, 30)`. */
  degree: number;
  /**
   * Apparent longitudinal speed in degrees per day, signed: positive when the
   * body's ecliptic longitude is increasing (direct motion), negative when
   * decreasing (apparent retrograde). Measured by a symmetric finite difference
   * over ±{@link RETRO_STEP_DAYS}. Consumed by aspect calculation to decide
   * whether an aspect is applying or separating.
   */
  speed: number;
  /**
   * `true` when the body's apparent geocentric longitude is momentarily
   * decreasing (apparent retrograde motion) at the given instant — i.e.
   * {@link speed} is negative.
   */
  retrograde: boolean;
}

/** Which lunar-node model to report for `northNode`/`southNode`. */
export type LunarNodeModel = 'true' | 'mean';

/** Options for {@link computePlanetaryPositions}. */
export interface PlanetaryPositionsOptions {
  /**
   * Include the centaur Chiron in the results. Off by default. Astronomy
   * Engine has no Chiron model, so Chiron is propagated from JPL osculating
   * elements via a two-body Kepler solution: accurate near the 2024-01-01
   * reference epoch but degrading (well beyond one arcminute) for dates many
   * years away from it. Treat it as approximate.
   */
  includeChiron?: boolean;
  /**
   * Lunar-node model. `'true'` (default) is the instantaneous osculating node
   * derived from the Moon's state vector — the value most astrology software
   * labels "True Node". `'mean'` is the smoothly-precessing mean node.
   */
  nodeModel?: LunarNodeModel;
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
const DEGREES_PER_SIGN = 30;
const DEG = Math.PI / 180;

/** Light-time for one astronomical unit, in seconds (IAU 2009). */
const LIGHT_SECONDS_PER_AU = 499.004783836;

/**
 * Half-width of the symmetric time window (in days, ≈1 hour) used to detect
 * retrograde motion by finite difference. Large enough that even slow outer
 * planets show a well-defined direction, small enough not to smear over a
 * station for fast bodies.
 */
const RETRO_STEP_DAYS = 1 / 24;

/** Astronomy Engine bodies whose apparent geocentric longitude we report directly. */
const PLANETS: readonly { body: CelestialBody; aeBody: Astronomy.Body }[] = [
  { body: 'sun', aeBody: Astronomy.Body.Sun },
  { body: 'moon', aeBody: Astronomy.Body.Moon },
  { body: 'mercury', aeBody: Astronomy.Body.Mercury },
  { body: 'venus', aeBody: Astronomy.Body.Venus },
  { body: 'mars', aeBody: Astronomy.Body.Mars },
  { body: 'jupiter', aeBody: Astronomy.Body.Jupiter },
  { body: 'saturn', aeBody: Astronomy.Body.Saturn },
  { body: 'uranus', aeBody: Astronomy.Body.Uranus },
  { body: 'neptune', aeBody: Astronomy.Body.Neptune },
  { body: 'pluto', aeBody: Astronomy.Body.Pluto },
];

/**
 * Osculating heliocentric ecliptic (J2000) elements for 2060 Chiron at epoch
 * JD 2460310.5 TDB (2024-01-01 00:00), from JPL Horizons. Used only for the
 * opt-in, approximate Chiron placement.
 */
const CHIRON_ELEMENTS = {
  /** Element epoch, in TT days relative to J2000 (JD 2460310.5 − 2451545.0). */
  epochTtDaysFromJ2000: 2460310.5 - 2451545.0,
  eccentricity: 0.3766375557138321,
  semiMajorAxisAu: 13.71128063966188,
  inclinationDeg: 6.916870587872204,
  ascendingNodeDeg: 209.3077647793359,
  argPerihelionDeg: 339.3203261586348,
  meanAnomalyDeg: 199.1658022613717,
  meanMotionDegPerDay: 0.01941274920661805,
} as const;

/** Wrap an angle in degrees into `[0, 360)`. */
function normalizeDegrees(deg: number): number {
  const wrapped = deg % FULL_CIRCLE;
  return wrapped < 0 ? wrapped + FULL_CIRCLE : wrapped;
}

/**
 * Signed smallest difference `a − b` of two angles in degrees, in `(-180, 180]`.
 * Used so retrograde detection is correct across the 360°/0° seam.
 */
function angularDelta(a: number, b: number): number {
  let delta = (a - b) % FULL_CIRCLE;
  if (delta > 180) delta -= FULL_CIRCLE;
  else if (delta <= -180) delta += FULL_CIRCLE;
  return delta;
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

/**
 * Apparent geocentric ecliptic longitude (degrees, true equinox of date) of an
 * Astronomy Engine body: geocentric vector corrected for light-travel time and
 * aberration, rotated from the J2000 equator into the ecliptic of date.
 */
function apparentEclipticLongitude(body: Astronomy.Body, time: Astronomy.AstroTime): number {
  const geoEqj = Astronomy.GeoVector(body, time, true);
  const rotation = Astronomy.Rotation_EQJ_ECT(time);
  const geoEct = Astronomy.RotateVector(rotation, geoEqj);
  return normalizeDegrees(Astronomy.SphereFromVector(geoEct).lon);
}

/**
 * Longitude (degrees, ecliptic of date) of the Moon's osculating ascending
 * node — the direction of `k × h`, where `h = r × v` is the orbital angular
 * momentum in the ecliptic-of-date frame and `k` is the ecliptic pole.
 */
function trueNodeLongitude(time: Astronomy.AstroTime): number {
  const state = Astronomy.RotateState(
    Astronomy.Rotation_EQJ_ECT(time),
    Astronomy.GeoMoonState(time),
  );
  const hx = state.y * state.vz - state.z * state.vy;
  const hy = state.z * state.vx - state.x * state.vz;
  // Ascending node direction n = k × h = (−hy, hx, 0); Ω = atan2(n_y, n_x).
  return normalizeDegrees(Math.atan2(hx, -hy) / DEG);
}

/**
 * Longitude (degrees) of the Moon's mean ascending node, from the Meeus
 * polynomial in Julian centuries of TT since J2000 (Astronomical Algorithms,
 * eq. 47.7), referred to the mean equinox of date.
 */
function meanNodeLongitude(time: Astronomy.AstroTime): number {
  const t = time.tt / 36525;
  const omega = 125.04452 - 1934.136261 * t + 0.0020708 * t * t + (t * t * t) / 450000;
  return normalizeDegrees(omega);
}

/**
 * Heliocentric ecliptic (J2000) position of Chiron, in AU, from a two-body
 * propagation of {@link CHIRON_ELEMENTS} to the given TT instant.
 */
function chironHeliocentricEcliptic(ttDaysFromJ2000: number): [number, number, number] {
  const { eccentricity: e, semiMajorAxisAu: a } = CHIRON_ELEMENTS;
  const elapsed = ttDaysFromJ2000 - CHIRON_ELEMENTS.epochTtDaysFromJ2000;
  const meanAnomaly =
    normalizeDegrees(
      CHIRON_ELEMENTS.meanAnomalyDeg + CHIRON_ELEMENTS.meanMotionDegPerDay * elapsed,
    ) * DEG;

  // Solve Kepler's equation E − e·sin E = M for the eccentric anomaly E.
  let ecc = meanAnomaly;
  for (let i = 0; i < 100; i++) {
    const delta = (ecc - e * Math.sin(ecc) - meanAnomaly) / (1 - e * Math.cos(ecc));
    ecc -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }

  // Perifocal coordinates, then rotate by ω (arg. perihelion), i, Ω.
  const xPeri = a * (Math.cos(ecc) - e);
  const yPeri = a * Math.sqrt(1 - e * e) * Math.sin(ecc);
  const node = CHIRON_ELEMENTS.ascendingNodeDeg * DEG;
  const arg = CHIRON_ELEMENTS.argPerihelionDeg * DEG;
  const inc = CHIRON_ELEMENTS.inclinationDeg * DEG;
  const cosNode = Math.cos(node);
  const sinNode = Math.sin(node);
  const cosArg = Math.cos(arg);
  const sinArg = Math.sin(arg);
  const cosInc = Math.cos(inc);
  const sinInc = Math.sin(inc);
  const x =
    (cosNode * cosArg - sinNode * sinArg * cosInc) * xPeri +
    (-cosNode * sinArg - sinNode * cosArg * cosInc) * yPeri;
  const y =
    (sinNode * cosArg + cosNode * sinArg * cosInc) * xPeri +
    (-sinNode * sinArg + cosNode * cosArg * cosInc) * yPeri;
  const z = sinArg * sinInc * xPeri + cosArg * sinInc * yPeri;
  return [x, y, z];
}

/**
 * Apparent geocentric ecliptic longitude (degrees, of date) of Chiron.
 * Approximate: two-body Chiron, corrected for light-travel time but not
 * stellar aberration. See {@link PlanetaryPositionsOptions.includeChiron}.
 */
function chironLongitude(time: Astronomy.AstroTime): number {
  const earthEcl = Astronomy.RotateVector(
    Astronomy.Rotation_EQJ_ECL(),
    Astronomy.HelioVector(Astronomy.Body.Earth, time),
  );

  const geocentric = (ttDays: number): [number, number, number] => {
    const [cx, cy, cz] = chironHeliocentricEcliptic(ttDays);
    return [cx - earthEcl.x, cy - earthEcl.y, cz - earthEcl.z];
  };

  // Back-date Chiron by the light-travel time to Earth (one iteration).
  const direct = geocentric(time.tt);
  const distance = Math.hypot(direct[0], direct[1], direct[2]);
  const lightTimeDays = (distance * LIGHT_SECONDS_PER_AU) / 86400;
  const [gx, gy, gz] = geocentric(time.tt - lightTimeDays);

  // Geocentric ecliptic J2000 → J2000 equator → ecliptic of date.
  const eqj = Astronomy.RotateVector(
    Astronomy.Rotation_ECL_EQJ(),
    new Astronomy.Vector(gx, gy, gz, time),
  );
  const ect = Astronomy.RotateVector(Astronomy.Rotation_EQJ_ECT(time), eqj);
  return normalizeDegrees(Astronomy.SphereFromVector(ect).lon);
}

/**
 * Signed apparent longitudinal speed of `longitudeAt` at `time`, in degrees per
 * day. Measured by a symmetric finite difference over ±{@link RETRO_STEP_DAYS},
 * seam-safe via {@link angularDelta}. Negative means apparent retrograde motion.
 */
function longitudinalSpeed(
  longitudeAt: (time: Astronomy.AstroTime) => number,
  time: Astronomy.AstroTime,
): number {
  const before = longitudeAt(time.AddDays(-RETRO_STEP_DAYS));
  const after = longitudeAt(time.AddDays(RETRO_STEP_DAYS));
  return angularDelta(after, before) / (2 * RETRO_STEP_DAYS);
}

/** Build a {@link PlanetPosition} from a raw longitude and signed speed. */
function toPosition(body: CelestialBody, longitude: number, speed: number): PlanetPosition {
  const normalized = normalizeDegrees(longitude);
  const signIndex = Math.floor(normalized / DEGREES_PER_SIGN);
  return {
    body,
    longitude: normalized,
    // signIndex is 0..11 for any normalized longitude in [0, 360).
    sign: SIGNS[signIndex]!,
    degree: normalized - signIndex * DEGREES_PER_SIGN,
    speed,
    retrograde: speed < 0,
  };
}

/**
 * Compute the apparent geocentric tropical ecliptic positions of the Sun, Moon,
 * Mercury–Pluto, and the lunar nodes (plus, optionally, Chiron) at a moment of
 * birth.
 *
 * @param utDateTime
 *   The birth instant as an ISO 8601 string in Universal Time, e.g.
 *   `'1990-05-15T13:45:00Z'`. An explicit offset (`…+04:00`) is honoured; a
 *   zone-less string is interpreted as UTC. Converting a local birth time and
 *   place to UT is the job of the timezone-accuracy step (#16), upstream of
 *   this function.
 * @param options
 *   See {@link PlanetaryPositionsOptions}.
 * @returns
 *   One {@link PlanetPosition} per body, in the fixed order Sun, Moon,
 *   Mercury … Pluto, North Node, South Node, [Chiron]. Every field is a plain
 *   JSON-serializable value.
 * @throws {CalcEngineError}
 *   With code `invalid_input` if `utDateTime` is not a valid ISO 8601 string.
 */
export function computePlanetaryPositions(
  utDateTime: string,
  options: PlanetaryPositionsOptions = {},
): PlanetPosition[] {
  const { includeChiron = false, nodeModel = 'true' } = options;
  const time = parseUt(utDateTime);

  const positions: PlanetPosition[] = PLANETS.map(({ body, aeBody }) => {
    const longitudeAt = (t: Astronomy.AstroTime) => apparentEclipticLongitude(aeBody, t);
    return toPosition(body, longitudeAt(time), longitudinalSpeed(longitudeAt, time));
  });

  const nodeLongitudeAt = nodeModel === 'mean' ? meanNodeLongitude : trueNodeLongitude;
  const northNodeLongitude = nodeLongitudeAt(time);
  // The descending (south) node is always exactly opposite the ascending one,
  // so it shares the ascending node's speed.
  const nodeSpeed = longitudinalSpeed(nodeLongitudeAt, time);
  positions.push(toPosition('northNode', northNodeLongitude, nodeSpeed));
  positions.push(toPosition('southNode', northNodeLongitude + 180, nodeSpeed));

  if (includeChiron) {
    positions.push(
      toPosition('chiron', chironLongitude(time), longitudinalSpeed(chironLongitude, time)),
    );
  }

  return positions;
}
