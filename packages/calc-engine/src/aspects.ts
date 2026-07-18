import { CalcEngineError } from './errors';
import type { CelestialBody } from './planetary-positions';

/**
 * The five Ptolemaic *major* aspects — the angular relationships between two
 * bodies that classical Western astrology treats as significant. Each has an
 * exact separation angle (see {@link ASPECT_ANGLES}).
 */
export type AspectType = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';

/** Exact separation angle (degrees) of each major aspect. */
export const ASPECT_ANGLES: Readonly<Record<AspectType, number>> = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  opposition: 180,
};

/**
 * Iteration order for aspect matching, by ascending exact angle. Used as a
 * deterministic tie-break: if a separation is equidistant from two aspects
 * (only possible with unusually wide orbs), the lower-angle aspect wins.
 */
const ASPECT_ORDER: readonly AspectType[] = [
  'conjunction',
  'sextile',
  'square',
  'trine',
  'opposition',
];

/**
 * Default orb (maximum allowed deviation from the exact angle, in degrees) for
 * each aspect type. These are the documented factory defaults; the admin panel
 * (EPIC 10) can override any of them per aspect type, and the natal-chart layer
 * passes the effective values into {@link computeAspects} via
 * {@link AspectsOptions.orbs}.
 *
 * The values follow the common moderate scheme used by mainstream astrology
 * software — widest for the strongest aspects (conjunction/opposition), a touch
 * tighter for the square and trine, tightest for the sextile:
 *
 * | Aspect      | Angle | Default orb |
 * | ----------- | ----- | ----------- |
 * | Conjunction |   0°  |     8°      |
 * | Opposition  | 180°  |     8°      |
 * | Trine       | 120°  |     8°      |
 * | Square      |  90°  |     7°      |
 * | Sextile     |  60°  |     6°      |
 */
export const DEFAULT_ORBS: Readonly<Record<AspectType, number>> = {
  conjunction: 8,
  opposition: 8,
  trine: 8,
  square: 7,
  sextile: 6,
};

/** Inclusive bounds an orb value must fall within to be accepted. */
const MIN_ORB = 0;
const MAX_ORB = 30;

const FULL_CIRCLE = 360;
const HALF_CIRCLE = 180;

/**
 * A body to compute aspects for: its ecliptic longitude and (optionally) its
 * longitudinal speed. Feed this from {@link computePlanetaryPositions}, but any
 * source of ecliptic positions works — it is deliberately decoupled from the
 * ephemeris.
 */
export interface AspectBody {
  /** Which body/point this describes. */
  body: CelestialBody;
  /** Ecliptic longitude in degrees; normalized into `[0, 360)` internally. */
  longitude: number;
  /**
   * Longitudinal speed in degrees per day, signed (negative = retrograde).
   * Optional: when omitted for *either* body of a pair, the applying/separating
   * status of that aspect cannot be determined and is reported as `null`.
   */
  speed?: number;
}

/** Per-aspect-type orb overrides. Any type left out keeps its default. */
export type OrbConfig = Partial<Record<AspectType, number>>;

/** Options for {@link computeAspects}. */
export interface AspectsOptions {
  /**
   * Orb overrides merged over {@link DEFAULT_ORBS}. Typically the admin-configured
   * values loaded from the shared orb configuration (Postgres/Redis).
   */
  orbs?: OrbConfig;
}

/** A major aspect found between two bodies. */
export interface Aspect {
  /** The first body of the pair (in the order the inputs were given). */
  bodyA: CelestialBody;
  /** The second body of the pair. */
  bodyB: CelestialBody;
  /** Which major aspect the pair forms. */
  type: AspectType;
  /** The aspect's exact separation angle (degrees): 0/60/90/120/180. */
  angle: number;
  /**
   * The pair's actual angular separation in degrees, within `[0, 180]` — the
   * "exact degree difference" between the two bodies at this instant.
   */
  separation: number;
  /**
   * Deviation from exactness in degrees, `|separation − angle|`, always
   * `≤ orbs[type]`. Smaller means a tighter, stronger aspect (`0` is exact).
   */
  orb: number;
  /**
   * `true` when the aspect is *applying* (the two bodies are moving toward
   * exactness), `false` when *separating* (moving apart), and `null` when it
   * cannot be determined because a speed was not supplied for one of the bodies.
   * An exactly-partile aspect (or two bodies with identical speed) reports
   * `false`.
   */
  applying: boolean | null;
}

/** Wrap an angle in degrees into `[0, 360)`. */
function normalizeDegrees(deg: number): number {
  const wrapped = deg % FULL_CIRCLE;
  return wrapped < 0 ? wrapped + FULL_CIRCLE : wrapped;
}

/** Smallest angular separation between two longitudes, in `[0, 180]`. */
function angularSeparation(a: number, b: number): number {
  const diff = normalizeDegrees(b - a);
  return diff > HALF_CIRCLE ? FULL_CIRCLE - diff : diff;
}

/** Small time step (days) used to detect whether an aspect is applying. */
const APPLYING_STEP_DAYS = 1e-3;

/**
 * Merge caller-supplied orb overrides over {@link DEFAULT_ORBS}, validating that
 * every override is a finite number within `[MIN_ORB, MAX_ORB]`.
 *
 * @throws {CalcEngineError} `invalid_input` for an unknown aspect type or an
 *   out-of-range orb.
 */
function resolveOrbs(overrides: OrbConfig = {}): Record<AspectType, number> {
  const orbs: Record<AspectType, number> = { ...DEFAULT_ORBS };
  for (const [type, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    if (!(type in ASPECT_ANGLES)) {
      throw new CalcEngineError('invalid_input', `unknown aspect type: ${type}`);
    }
    if (!Number.isFinite(value) || value < MIN_ORB || value > MAX_ORB) {
      throw new CalcEngineError(
        'invalid_input',
        `orb for ${type} must be a number within [${MIN_ORB}, ${MAX_ORB}] degrees, got ${value}`,
      );
    }
    orbs[type as AspectType] = value;
  }
  return orbs;
}

/** Validate a body's longitude/speed and return it with longitude normalized. */
function validateBody(input: AspectBody): {
  body: CelestialBody;
  longitude: number;
  speed?: number;
} {
  if (!Number.isFinite(input.longitude)) {
    throw new CalcEngineError(
      'invalid_input',
      `longitude for ${input.body} must be a finite number, got ${input.longitude}`,
    );
  }
  if (input.speed !== undefined && !Number.isFinite(input.speed)) {
    throw new CalcEngineError(
      'invalid_input',
      `speed for ${input.body} must be a finite number when provided, got ${input.speed}`,
    );
  }
  return { body: input.body, longitude: normalizeDegrees(input.longitude), speed: input.speed };
}

/**
 * Whether the pair is applying (deviation from exactness currently decreasing).
 * Determined by advancing both bodies a small step along their speeds and
 * comparing the deviation before and after — robust across the 0°/360° seam.
 * Returns `null` if either speed is missing; `false` if the deviation is not
 * strictly decreasing (exact or separating).
 */
function isApplying(
  a: { longitude: number; speed?: number },
  b: { longitude: number; speed?: number },
  angle: number,
): boolean | null {
  if (a.speed === undefined || b.speed === undefined) return null;
  const deviationNow = Math.abs(angularSeparation(a.longitude, b.longitude) - angle);
  const deviationNext = Math.abs(
    angularSeparation(
      a.longitude + a.speed * APPLYING_STEP_DAYS,
      b.longitude + b.speed * APPLYING_STEP_DAYS,
    ) - angle,
  );
  return deviationNext < deviationNow;
}

/** The single closest major aspect between two bodies, or `null` if none is within orb. */
function aspectBetween(
  a: { body: CelestialBody; longitude: number; speed?: number },
  b: { body: CelestialBody; longitude: number; speed?: number },
  orbs: Record<AspectType, number>,
): Aspect | null {
  const separation = angularSeparation(a.longitude, b.longitude);

  let best: { type: AspectType; angle: number; orb: number } | null = null;
  for (const type of ASPECT_ORDER) {
    const angle = ASPECT_ANGLES[type];
    const deviation = Math.abs(separation - angle);
    if (deviation <= orbs[type] && (best === null || deviation < best.orb)) {
      best = { type, angle, orb: deviation };
    }
  }
  if (best === null) return null;

  return {
    bodyA: a.body,
    bodyB: b.body,
    type: best.type,
    angle: best.angle,
    separation,
    orb: best.orb,
    applying: isApplying(a, b, best.angle),
  };
}

/**
 * Compute the major aspects among a set of bodies.
 *
 * Every unordered pair of the given bodies is evaluated; a pair is reported when
 * its angular separation lies within the (configurable) orb of exactly one major
 * aspect — the closest one when more than one is in range. For each reported
 * aspect the exact degree difference ({@link Aspect.separation}), the deviation
 * from exactness ({@link Aspect.orb}) and the applying/separating status
 * ({@link Aspect.applying}, when speeds are supplied) are returned.
 *
 * The caller controls which bodies participate by choosing what to pass in. Note
 * that the North and South lunar nodes are exactly 180° apart by construction,
 * so including both yields a trivially-exact opposition between them — omit one
 * node from the input if that pairing is unwanted.
 *
 * @param bodies
 *   The bodies to aspect, each with an ecliptic longitude and (optionally) a
 *   signed longitudinal speed in degrees/day — e.g. the output of
 *   {@link computePlanetaryPositions}.
 * @param options
 *   See {@link AspectsOptions}. Orb overrides are merged over {@link DEFAULT_ORBS}.
 * @returns
 *   One {@link Aspect} per aspecting pair. Pairs are emitted in input order:
 *   `(0,1), (0,2), …, (1,2), …`. Every field is plain JSON-serializable data.
 * @throws {CalcEngineError}
 *   `invalid_input` for an out-of-range orb, an unknown aspect type, or a
 *   non-finite longitude/speed.
 */
export function computeAspects(bodies: AspectBody[], options: AspectsOptions = {}): Aspect[] {
  const orbs = resolveOrbs(options.orbs);
  const validated = bodies.map(validateBody);

  const aspects: Aspect[] = [];
  for (let i = 0; i < validated.length; i++) {
    for (let j = i + 1; j < validated.length; j++) {
      const aspect = aspectBetween(validated[i]!, validated[j]!, orbs);
      if (aspect) aspects.push(aspect);
    }
  }
  return aspects;
}
