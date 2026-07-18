/**
 * Pure, framework-independent geometry for the natal-chart "wheel".
 *
 * This module turns the calc-engine's astronomical output (planet longitudes,
 * house cusps, aspects) into flat, ready-to-draw primitives — points, line
 * segments and angles in canvas pixel space. It imports nothing from React
 * Native or Skia, so it can be exercised in a plain Node test runner
 * (see `geometry.test.ts`) and reused by any renderer (Skia today, SVG or a
 * future web canvas tomorrow).
 *
 * Coordinate convention
 * ---------------------
 * Positions are computed on a square canvas of side `size`, centred at
 * `(size/2, size/2)`. A *screen angle* is measured in degrees counter-clockwise
 * from the 3-o'clock position, mapped with a y-axis flip so that it reads the
 * way an astrologer expects when drawn (0° → right, 90° → top, 180° → left,
 * 270° → bottom). Ecliptic longitude is mapped so the Ascendant sits on the
 * left horizon (9 o'clock) and longitude increases counter-clockwise — the
 * standard Western chart orientation. When no Ascendant is known (birth time
 * unknown), 0° Aries is pinned to the left instead and the wheel still renders.
 */

/** A body to place on the wheel. `body` is a calc-engine `CelestialBody` id. */
export interface ChartPlanet {
  body: string;
  /** Ecliptic longitude in degrees; normalised into `[0, 360)` internally. */
  longitude: number;
  /** Whether the body is in apparent retrograde motion (drives the "R" mark). */
  retrograde?: boolean;
}

/** One numbered house cusp. */
export interface ChartHouseCusp {
  /** House number, `1`–`12`. */
  house: number;
  /** Ecliptic longitude of the cusp in degrees. */
  longitude: number;
}

/** The major aspect types the wheel can draw, matching the calc-engine. */
export type ChartAspectType =
  | 'conjunction'
  | 'sextile'
  | 'square'
  | 'trine'
  | 'opposition';

/** An aspect between two bodies, referenced by their `body` ids. */
export interface ChartAspect {
  bodyA: string;
  bodyB: string;
  type: ChartAspectType;
}

/** Everything needed to lay out one wheel. */
export interface WheelInput {
  /** Pixel side length of the (square) canvas. */
  size: number;
  planets: ChartPlanet[];
  /**
   * The twelve house cusps, or `null`/omitted when the house system is
   * unavailable (birth time unknown) — the wheel then degrades to a bare
   * zodiac ring plus planets.
   */
  houseCusps?: ChartHouseCusp[] | null;
  /**
   * Ascendant longitude in degrees. When present the wheel is rotated so the
   * Ascendant is on the left horizon; when absent, 0° Aries is placed there.
   */
  ascendantLongitude?: number | null;
  /** Aspects to draw as chords in the inner circle. */
  aspects?: ChartAspect[] | null;
  /** Layout tuning; every field has a sensible default. */
  options?: Partial<WheelOptions>;
}

/** Tunable layout ratios (fractions of the wheel radius) and thresholds. */
export interface WheelOptions {
  /** Minimum angular gap (degrees) enforced between adjacent planet glyphs. */
  minPlanetGapDeg: number;
  /** Outer margin as a fraction of the radius (room for the gold glow). */
  marginRatio: number;
  /** Width of the zodiac sign band as a fraction of the radius. */
  signBandRatio: number;
  /** Radius of the planet-glyph ring as a fraction of the radius. */
  planetRingRatio: number;
  /** Radius of the circle the aspect chords terminate on. */
  aspectRingRatio: number;
  /** Innermost radius the house cusp lines reach toward the centre. */
  houseHubRatio: number;
}

export const DEFAULT_WHEEL_OPTIONS: WheelOptions = {
  minPlanetGapDeg: 8.5,
  marginRatio: 0.015,
  signBandRatio: 0.16,
  planetRingRatio: 0.6,
  aspectRingRatio: 0.52,
  houseHubRatio: 0.16,
};

/** A 2-D point in canvas pixel space. */
export interface Point {
  x: number;
  y: number;
}

/** The concentric radii, in pixels, that define the wheel's bands. */
export interface WheelRadii {
  /** Outer edge of the zodiac band. */
  outer: number;
  /** Inner edge of the zodiac band (where ticks and house lines start). */
  zodiacInner: number;
  /** Radius the sign glyphs are centred on. */
  signGlyph: number;
  /** Radius the planet glyphs are centred on. */
  planetRing: number;
  /** Radius the aspect chords terminate on. */
  aspectRing: number;
  /** Inner hub the house cusp lines reach toward. */
  houseHub: number;
}

/** One of the twelve zodiac-sign wedges. */
export interface SignSegment {
  /** Sign index, 0 = Aries … 11 = Pisces. */
  index: number;
  /** Screen angle (deg) of the wedge's starting boundary. */
  startAngle: number;
  /** Screen angle (deg) of the wedge's ending boundary. */
  endAngle: number;
  /** Where to centre the sign glyph. */
  glyph: Point;
  /** Angle of the glyph, for optional rotation. */
  glyphAngle: number;
}

/** A radial house-cusp line, with its number placement. */
export interface HouseLine {
  house: number;
  /** Screen angle (deg) of the cusp. */
  angle: number;
  /** Outer end of the cusp line (on the zodiac inner edge). */
  outer: Point;
  /** Inner end of the cusp line (near the hub). */
  inner: Point;
  /** Where to draw the house number (mid-way to the next cusp). */
  label: Point;
  /** True for the Ascendant (1) and Midheaven (10) axes, drawn emphasised. */
  angular: boolean;
}

/** A fully-placed planet glyph plus its connector back to the true degree. */
export interface PlanetGlyphLayout {
  body: string;
  longitude: number;
  retrograde: boolean;
  /** Screen angle (deg) of the body's true ecliptic longitude. */
  trueAngle: number;
  /** Screen angle (deg) the glyph is drawn at (after de-collision spreading). */
  glyphAngle: number;
  /** Glyph centre. */
  glyph: Point;
  /** Point on the zodiac inner edge at the true longitude (connector start). */
  degreeMark: Point;
  /** Point on the aspect ring at the true longitude (aspect chord endpoint). */
  aspectPoint: Point;
}

/** An aspect resolved to two drawable endpoints. */
export interface AspectLine {
  bodyA: string;
  bodyB: string;
  type: ChartAspectType;
  from: Point;
  to: Point;
}

/** A degree tick on the inner edge of the zodiac band. */
export interface DegreeTick {
  angle: number;
  outer: Point;
  inner: Point;
  /** True every 30° (sign boundary), for a longer/bolder tick. */
  major: boolean;
}

/** The complete, renderer-agnostic description of one wheel. */
export interface WheelLayout {
  size: number;
  center: Point;
  radii: WheelRadii;
  signs: SignSegment[];
  ticks: DegreeTick[];
  houses: HouseLine[];
  planets: PlanetGlyphLayout[];
  aspects: AspectLine[];
  /** True when house data was supplied (drives the "houses shown" affordance). */
  hasHouses: boolean;
}

const FULL_CIRCLE = 360;
const DEGREES_PER_SIGN = 30;
const DEG = Math.PI / 180;

/** Wrap an angle in degrees into `[0, 360)`. */
export function normalize360(deg: number): number {
  const wrapped = deg % FULL_CIRCLE;
  return wrapped < 0 ? wrapped + FULL_CIRCLE : wrapped;
}

/**
 * Convert an ecliptic longitude to a screen angle. With `ascendantLongitude`
 * the Ascendant lands at 180° (left); without it, 0° Aries does. Longitude
 * increases counter-clockwise, as on a standard chart.
 */
export function longitudeToAngle(longitude: number, ascendantLongitude = 0): number {
  return normalize360(180 + (longitude - ascendantLongitude));
}

/**
 * Point on a circle of `radius` about `center` at the given screen angle. The
 * y term is subtracted so that positive angles read counter-clockwise on a
 * screen whose y-axis points down.
 */
export function pointOnCircle(center: Point, radius: number, angleDeg: number): Point {
  const rad = angleDeg * DEG;
  return {
    x: center.x + radius * Math.cos(rad),
    y: center.y - radius * Math.sin(rad),
  };
}

/** Mean of an array of numbers (caller guarantees non-empty). */
function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Spread a set of screen angles so that, once sorted around the circle, no two
 * adjacent glyphs sit closer than `minGap` degrees — the classic "stellium"
 * de-collision problem. Bodies that are already well separated are left
 * untouched; a tight clump is fanned out symmetrically about its mean so it
 * stays centred on where the planets actually are.
 *
 * The circle is first "cut" at its largest empty arc so the clustering can be
 * solved on a linear sequence without worrying about the 0°/360° seam. Returns
 * new angles aligned to the input order.
 */
export function spreadAngles(angles: number[], minGap: number): number[] {
  const n = angles.length;
  if (n <= 1) return angles.map((a) => normalize360(a));

  // Sort by angle, remembering each element's original position.
  const sorted = angles
    .map((angle, index) => ({ index, angle: normalize360(angle) }))
    .sort((a, b) => a.angle - b.angle);

  // Find the largest gap (including the wrap gap) and cut the circle there so
  // the remaining sequence is monotonic and never straddles the seam.
  let seam = 0;
  let widestGap = -1;
  for (let k = 0; k < n; k++) {
    const next = sorted[(k + 1) % n]!;
    const cur = sorted[k]!;
    const gap = normalize360(next.angle - cur.angle);
    if (gap > widestGap) {
      widestGap = gap;
      seam = (k + 1) % n;
    }
  }

  // Unwrap into an increasing linear sequence starting at the seam.
  const linear: number[] = [];
  for (let k = 0; k < n; k++) {
    const a = sorted[(seam + k) % n]!.angle;
    if (k === 0) {
      linear.push(a);
    } else {
      let value = a;
      while (value <= linear[k - 1]!) value += FULL_CIRCLE;
      linear.push(value);
    }
  }

  // Walk clusters of consecutive points closer than minGap and fan each out
  // evenly about its mean.
  const spread = new Array<number>(n);
  let k = 0;
  while (k < n) {
    let m = k + 1;
    while (m < n && linear[m]! - linear[m - 1]! < minGap) m++;
    const clusterSize = m - k;
    if (clusterSize === 1) {
      spread[k] = linear[k]!;
    } else {
      const centre = mean(linear.slice(k, m));
      const start = centre - ((clusterSize - 1) * minGap) / 2;
      for (let t = 0; t < clusterSize; t++) spread[k + t] = start + t * minGap;
    }
    k = m;
  }

  // Map back to original order, re-normalising into [0, 360).
  const result = new Array<number>(n);
  for (let idx = 0; idx < n; idx++) {
    result[sorted[(seam + idx) % n]!.index] = normalize360(spread[idx]!);
  }
  return result;
}

/** Resolve the concentric radii from the canvas size and options. */
export function computeRadii(size: number, options: WheelOptions): WheelRadii {
  const r = size / 2;
  const outer = r * (1 - options.marginRatio);
  const zodiacInner = outer - r * options.signBandRatio;
  return {
    outer,
    zodiacInner,
    signGlyph: (outer + zodiacInner) / 2,
    planetRing: r * options.planetRingRatio,
    aspectRing: r * options.aspectRingRatio,
    houseHub: r * options.houseHubRatio,
  };
}

/**
 * Turn a wheel's astronomical data into flat drawable primitives.
 *
 * The result is deterministic and side-effect free, so a renderer can compute
 * it once in a `useMemo` (off the render/UI thread's hot path) and simply draw
 * the returned points — the key to keeping the wheel at ~60fps.
 */
export function computeWheelLayout(input: WheelInput): WheelLayout {
  const options = { ...DEFAULT_WHEEL_OPTIONS, ...input.options };
  const { size } = input;
  const center: Point = { x: size / 2, y: size / 2 };
  const radii = computeRadii(size, options);
  const ascLon = input.ascendantLongitude ?? 0;

  // --- Zodiac sign wedges ---
  const signs: SignSegment[] = [];
  for (let i = 0; i < 12; i++) {
    const startLon = i * DEGREES_PER_SIGN;
    const glyphAngle = longitudeToAngle(startLon + DEGREES_PER_SIGN / 2, ascLon);
    signs.push({
      index: i,
      startAngle: longitudeToAngle(startLon, ascLon),
      endAngle: longitudeToAngle(startLon + DEGREES_PER_SIGN, ascLon),
      glyph: pointOnCircle(center, radii.signGlyph, glyphAngle),
      glyphAngle,
    });
  }

  // --- Degree ticks (every 5°, major every 30°) ---
  const ticks: DegreeTick[] = [];
  for (let lon = 0; lon < FULL_CIRCLE; lon += 5) {
    const major = lon % DEGREES_PER_SIGN === 0;
    const angle = longitudeToAngle(lon, ascLon);
    const tickLen = (radii.outer - radii.zodiacInner) * (major ? 0.5 : 0.25);
    ticks.push({
      angle,
      major,
      outer: pointOnCircle(center, radii.zodiacInner + tickLen, angle),
      inner: pointOnCircle(center, radii.zodiacInner, angle),
    });
  }

  // --- House cusp lines (only when house data is available) ---
  const cusps = input.houseCusps ?? [];
  const hasHouses = cusps.length === 12;
  const houses: HouseLine[] = [];
  if (hasHouses) {
    const ordered = [...cusps].sort((a, b) => a.house - b.house);
    for (let i = 0; i < 12; i++) {
      const cusp = ordered[i]!;
      const nextCusp = ordered[(i + 1) % 12]!;
      const angle = longitudeToAngle(cusp.longitude, ascLon);
      // Place the number half-way along the arc to the next cusp.
      const span = normalize360(nextCusp.longitude - cusp.longitude);
      const labelAngle = longitudeToAngle(cusp.longitude + span / 2, ascLon);
      houses.push({
        house: cusp.house,
        angle,
        angular: cusp.house === 1 || cusp.house === 10,
        outer: pointOnCircle(center, radii.zodiacInner, angle),
        inner: pointOnCircle(center, radii.houseHub, angle),
        label: pointOnCircle(center, radii.houseHub + (radii.planetRing - radii.houseHub) * 0.35, labelAngle),
      });
    }
  }

  // --- Planet glyphs, de-collided so they don't overlap ---
  const trueAngles = input.planets.map((p) => longitudeToAngle(p.longitude, ascLon));
  const glyphAngles = spreadAngles(trueAngles, options.minPlanetGapDeg);
  const planets: PlanetGlyphLayout[] = input.planets.map((p, i) => {
    const trueAngle = trueAngles[i]!;
    const glyphAngle = glyphAngles[i]!;
    return {
      body: p.body,
      longitude: normalize360(p.longitude),
      retrograde: p.retrograde ?? false,
      trueAngle,
      glyphAngle,
      glyph: pointOnCircle(center, radii.planetRing, glyphAngle),
      degreeMark: pointOnCircle(center, radii.zodiacInner, trueAngle),
      aspectPoint: pointOnCircle(center, radii.aspectRing, trueAngle),
    };
  });

  // --- Aspect chords (skip any referencing a body that isn't drawn) ---
  const byBody = new Map(planets.map((p) => [p.body, p]));
  const aspects: AspectLine[] = [];
  for (const aspect of input.aspects ?? []) {
    const a = byBody.get(aspect.bodyA);
    const b = byBody.get(aspect.bodyB);
    if (!a || !b) continue;
    aspects.push({
      bodyA: aspect.bodyA,
      bodyB: aspect.bodyB,
      type: aspect.type,
      from: a.aspectPoint,
      to: b.aspectPoint,
    });
  }

  return { size, center, radii, signs, ticks, houses, planets, aspects, hasHouses };
}
