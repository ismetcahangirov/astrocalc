import type { ChakraName, DestinyMatrix } from '@astrocalc/calc-engine';

/**
 * Pure, framework-independent geometry for the Matrix of Destiny "octagram".
 *
 * Same split as `src/chart/geometry.ts`, and for the same reason: this module
 * turns a computed {@link DestinyMatrix} into flat, ready-to-draw primitives —
 * points and line segments in canvas pixel space — and imports nothing from
 * React Native or Skia, so it can be exercised in a plain Node test runner and
 * reused by any renderer.
 *
 * Coordinate convention
 * ---------------------
 * Positions are computed on a square canvas of side `size`, centred at
 * `(size/2, size/2)`. A *screen angle* is measured in degrees counter-clockwise
 * from the 3-o'clock position, with a y-axis flip so it reads the way the figure
 * is drawn (0° → right, 90° → top, 180° → left, 270° → bottom).
 *
 * The octagram is two overlaid squares:
 *
 * - the **personal** square, whose corners are the four cardinal points —
 *   day (left/W), month (top/N), year (right/E), sum (bottom/S);
 * - the **ancestral** square, rotated 45°, whose corners are the four diagonal
 *   points — NW, NE, SE, SW.
 *
 * Note the naming trap this deliberately sidesteps: Russian sources call the
 * *personal* square «диагональный» (diagonal) and the *ancestral* one «прямой»
 * (straight), which is the opposite of how the words read in English. Compass
 * directions are used throughout so no reader has to resolve that.
 */

/** A 2-D point in canvas pixel space. */
export interface Point {
  x: number;
  y: number;
}

/** What a node represents, which is what a renderer styles it by. */
export type OctagramNodeKind =
  /** One of the four cardinal points: the primary reading. */
  | 'cardinal'
  /** One of the four ancestral corners. */
  | 'diagonal'
  /** A point on an ancestral arm, between a corner and the ancestral centre. */
  | 'arm'
  /** The personal centre (comfort zone). */
  | 'centre'
  /** The ancestral centre, sitting just below the personal one. */
  | 'ancestralCentre'
  /** A chakra health point on one of the two central axes (§5.2). */
  | 'axis'
  /** An inner point of the money/relationship line (§5.1), on the SE bow. */
  | 'money';

/** One placed arcana, ready to draw. */
export interface OctagramNode {
  /** Stable identity — also the i18n key suffix and the React key. */
  key: string;
  /** The arcana number, 1–22. */
  arcana: number;
  kind: OctagramNodeKind;
  /** Where to draw the node's disc. */
  point: Point;
  /** Screen angle (deg) of the node from the centre; `0` for the two centres. */
  angle: number;
  /**
   * Relative visual weight, 1 (largest) to 3 (smallest). Derived here rather
   * than in the component so the whole visual hierarchy is decided — and
   * testable — in one place.
   */
  emphasis: 1 | 2 | 3;
  /** Where to draw this node's caption, pushed outward from the centre. */
  label: Point;
}

/** Tunable layout ratios (fractions of the canvas half-size). */
export interface OctagramOptions {
  /** Outer margin, leaving room for the captions. */
  marginRatio: number;
  /** Radius of the eight outer points. */
  outerRatio: number;
  /** Radius of the middle point on each ancestral arm. */
  armMiddleRatio: number;
  /** Radius of the inner point on each ancestral arm. */
  armInnerRatio: number;
  /** How far below the personal centre the ancestral centre sits. */
  ancestralCentreOffsetRatio: number;
  /** How far beyond a node its caption is pushed. */
  labelOffsetRatio: number;
}

export const DEFAULT_OCTAGRAM_OPTIONS: OctagramOptions = {
  marginRatio: 0.14,
  outerRatio: 0.86,
  armMiddleRatio: 0.58,
  armInnerRatio: 0.3,
  ancestralCentreOffsetRatio: 0.15,
  labelOffsetRatio: 0.11,
};

/** A drawable straight segment. */
export interface Segment {
  from: Point;
  to: Point;
}

/**
 * One arcana on the perimeter age-forecast timeline — the ruling energy of a
 * ~1.25-year sub-period, sitting just outside its age tick.
 */
export interface AgePeriod {
  /** Age (in years) at the start of the sub-period this arcana rules. */
  age: number;
  /** The arcana number, 1–22. */
  arcana: number;
  /** Screen angle (deg) of the point on the perimeter. */
  angle: number;
  /** Where to draw the small number. */
  point: Point;
}

/** The complete, renderer-agnostic description of one octagram. */
export interface OctagramLayout {
  size: number;
  center: Point;
  /** Radius of the eight outer points, in pixels. */
  radius: number;
  /** Every placed arcana, outer points first, then arms, then the two centres. */
  nodes: OctagramNode[];
  /** The four edges of the personal (cardinal) square. */
  personalSquare: Segment[];
  /** The four edges of the ancestral (diagonal) square. */
  ancestralSquare: Segment[];
  /** The two parental diagonals, drawn corner to opposite corner through the centre. */
  parentalLines: Segment[];
  /** Spokes from the centre out to each of the eight outer points. */
  spokes: Segment[];
  /**
   * The money/relationship line as a polyline, entry → toEntry → core →
   * toPartner → partner, bowing through the SE quadrant (§5.1). Its two ends are
   * the Svadhisthana chakra points, which is exactly where the method says the
   * line sits, so a renderer draws it over points already placed on the axes.
   */
  moneyLine: Segment[];
  /** Where to draw the money ("$") and love ("♥") marks on that line. */
  moneyMark: Point;
  loveMark: Point;
  /**
   * The age-forecast timeline: the ruling arcana of each ~1.25-year sub-period
   * between the eight decade vertices (ages 0–80), placed around the perimeter.
   */
  agePeriods: AgePeriod[];
}

const DEG = Math.PI / 180;
const FULL_CIRCLE = 360;

/** Wrap an angle in degrees into `[0, 360)`. */
export function normalize360(deg: number): number {
  const wrapped = deg % FULL_CIRCLE;
  return wrapped < 0 ? wrapped + FULL_CIRCLE : wrapped;
}

/**
 * Point on a circle of `radius` about `center` at the given screen angle. The
 * y term is subtracted so positive angles read counter-clockwise on a screen
 * whose y-axis points down.
 */
export function pointOnCircle(center: Point, radius: number, angleDeg: number): Point {
  const rad = angleDeg * DEG;
  return {
    x: center.x + radius * Math.cos(rad),
    y: center.y - radius * Math.sin(rad),
  };
}

/** Screen angles of the four cardinal points, in the order the layout emits them. */
const CARDINAL_ANGLES = { day: 180, month: 90, year: 0, sum: 270 } as const;
/** Screen angles of the four ancestral corners. */
const DIAGONAL_ANGLES = {
  paternalSpiritual: 135, // NW
  maternalSpiritual: 45, // NE
  paternalMaterial: 315, // SE
  maternalMaterial: 225, // SW
} as const;

function closedPath(points: Point[]): Segment[] {
  return points.map((from, i) => ({ from, to: points[(i + 1) % points.length]! }));
}

/**
 * Reduce a sum back into the 1–22 arcana range by repeated digit-summing — the
 * same rule the calc-engine uses, re-expressed locally because it is not exported
 * from the package and this module must stay dependency-light. Both inputs here
 * are already 1–22, so the sum is ≤ 44 and one digit-sum pass always suffices.
 */
function reduceArcana(sum: number): number {
  let n = sum;
  while (n > 22) {
    let digits = 0;
    for (let r = n; r > 0; r = Math.floor(r / 10)) digits += r % 10;
    n = digits;
  }
  return n;
}

/**
 * The perimeter age-forecast timeline (#97): the ruling arcana of each 1.25-year
 * sub-period between two decade vertices, by recursive bisection — each new point
 * is the reduced sum of the two it falls between. Three levels deep gives the
 * seven sub-points the reference figures draw between every decade.
 *
 * Returned in age order: +1.25, +2.5, +3.75, +5, +6.25, +7.5, +8.75 years past
 * `startAge`. The two endpoints (the decade vertices) are the outer octagram
 * discs and are not repeated here.
 */
function bisectDecade(startAge: number, a0: number, a1: number): { age: number; arcana: number }[] {
  const m4 = reduceArcana(a0 + a1); // +5   (the decade midpoint)
  const m2 = reduceArcana(a0 + m4); // +2.5
  const m6 = reduceArcana(m4 + a1); // +7.5
  const m1 = reduceArcana(a0 + m2); // +1.25
  const m3 = reduceArcana(m2 + m4); // +3.75
  const m5 = reduceArcana(m4 + m6); // +6.25
  const m7 = reduceArcana(m6 + a1); // +8.75
  const arcana = [m1, m2, m3, m4, m5, m6, m7];
  return arcana.map((a, i) => ({ age: startAge + (i + 1) * 1.25, arcana: a }));
}

/**
 * Turn a computed Matrix into flat drawable primitives.
 *
 * The result is deterministic and side-effect free, so a renderer can compute it
 * once in a `useMemo` and simply draw the returned points.
 *
 * Laid out here are every position the Ladini method fixes a place for: the
 * four cardinals, the four ancestral corners with their arm points, the two
 * centres, the chakra health cross on the two axes (§5.2), and the
 * money/relationship line on the SE diagonal (§5.1). The **purposes** are the
 * one block left to the written breakdown (`matrixText.ts`): the method gives
 * them no agreed position on the figure — two of the three reference
 * implementations do not even draw `planetary` — so placing them here would
 * mean inventing coordinates rather than reading them off the method.
 */
export function computeOctagramLayout(
  matrix: DestinyMatrix,
  size: number,
  options: Partial<OctagramOptions> = {},
): OctagramLayout {
  const opts = { ...DEFAULT_OCTAGRAM_OPTIONS, ...options };
  const center: Point = { x: size / 2, y: size / 2 };
  const half = size / 2;
  const radius = half * (1 - opts.marginRatio) * opts.outerRatio;

  const nodes: OctagramNode[] = [];

  const place = (
    key: string,
    arcana: number,
    kind: OctagramNodeKind,
    angle: number,
    nodeRadius: number,
    emphasis: 1 | 2 | 3,
  ): Point => {
    const point = pointOnCircle(center, nodeRadius, angle);
    nodes.push({
      key,
      arcana,
      kind,
      point,
      angle,
      emphasis,
      label: pointOnCircle(center, nodeRadius + half * opts.labelOffsetRatio, angle),
    });
    return point;
  };

  // --- The four cardinal points (the personal square) ---
  const cardinalPoints: Point[] = [];
  for (const [key, angle] of Object.entries(CARDINAL_ANGLES)) {
    const arcana = matrix.core[key as keyof typeof CARDINAL_ANGLES];
    cardinalPoints.push(place(`core.${key}`, arcana, 'cardinal', angle, radius, 1));
  }

  // --- The four ancestral corners, each with its inward arm ---
  const diagonalPoints: Point[] = [];
  for (const [key, angle] of Object.entries(DIAGONAL_ANGLES)) {
    const corner = matrix.ancestral[key as keyof typeof DIAGONAL_ANGLES];
    diagonalPoints.push(place(`ancestral.${key}`, corner.corner, 'diagonal', angle, radius, 2));
    // The arm runs inward along the same diagonal: corner → middle → inner.
    place(`ancestral.${key}.middle`, corner.middle, 'arm', angle, half * opts.armMiddleRatio, 3);
    place(`ancestral.${key}.inner`, corner.inner, 'arm', angle, half * opts.armInnerRatio, 3);
  }

  // --- The two centres ---
  // The personal centre sits dead centre; the ancestral centre just below it,
  // which is where every reference drawing puts it. Both are emitted with
  // `angle: 0` because an angle is meaningless at (or near) the origin — a
  // renderer must not try to place their captions radially.
  nodes.push({
    key: 'core.centre',
    arcana: matrix.core.centre,
    kind: 'centre',
    point: center,
    angle: 0,
    emphasis: 1,
    label: center,
  });
  const ancestralCentrePoint: Point = {
    x: center.x,
    y: center.y + half * opts.ancestralCentreOffsetRatio,
  };
  nodes.push({
    key: 'ancestral.centre',
    arcana: matrix.ancestral.centre,
    kind: 'ancestralCentre',
    point: ancestralCentrePoint,
    angle: 0,
    emphasis: 2,
    label: ancestralCentrePoint,
  });

  // --- The chakra health cross (§5.2) ---
  // The physical column lies on the horizontal (earth) axis, the energy column
  // on the vertical (sky) axis, each a recursive bisection of its crown arm:
  // vishuddha at the arm's midpoint, ajna outward of it, anahata inward. The
  // crown/root ends (sahasrara, muladhara) and manipura already exist as the
  // cardinals and the centre, so only the interior points are added here.
  const chakra = (name: ChakraName) => matrix.health.find((r) => r.chakra === name)!;
  const axisPoints: { key: string; arcana: number; angle: number; r: number }[] = [
    // Physical → horizontal axis; the crown arm is the west side (A = day).
    { key: 'chakra.ajna.physical', arcana: chakra('ajna').physical, angle: 180, r: radius * 0.75 },
    {
      key: 'chakra.vishuddha.physical',
      arcana: chakra('vishuddha').physical,
      angle: 180,
      r: radius * 0.5,
    },
    {
      key: 'chakra.anahata.physical',
      arcana: chakra('anahata').physical,
      angle: 180,
      r: radius * 0.25,
    },
    {
      key: 'chakra.svadhisthana.physical',
      arcana: chakra('svadhisthana').physical,
      angle: 0,
      r: radius * 0.5,
    },
    // Energy → vertical axis; the crown arm is the north side (B = month).
    { key: 'chakra.ajna.energy', arcana: chakra('ajna').energy, angle: 90, r: radius * 0.75 },
    {
      key: 'chakra.vishuddha.energy',
      arcana: chakra('vishuddha').energy,
      angle: 90,
      r: radius * 0.5,
    },
    { key: 'chakra.anahata.energy', arcana: chakra('anahata').energy, angle: 90, r: radius * 0.25 },
    {
      key: 'chakra.svadhisthana.energy',
      arcana: chakra('svadhisthana').energy,
      angle: 270,
      r: radius * 0.5,
    },
  ];
  for (const p of axisPoints) place(p.key, p.arcana, 'axis', p.angle, p.r, 3);

  // --- The money/relationship line (§5.1) ---
  // Its two ends are the Svadhisthana points already placed as axis nodes —
  // partner (C+E) at the east 0.5 mark, entry (D+E) at the south 0.5 mark. The
  // three inner arcana (toEntry, core, toPartner) lie *on the line between those
  // two ends*, so they are placed on a quadratic bow from entry to partner whose
  // control point is pushed toward the SE corner. The bow is what keeps `core`
  // clear of the SE ancestral arm's inner point, which sits on the straight
  // chord it would otherwise land on. The two endpoints are not re-emitted here
  // — they are already the two Svadhisthana axis discs — so only the three inner
  // points are added, and the "$"/"♥" marks label the `core` they flank.
  const entryPt = pointOnCircle(center, radius * 0.5, 270); // svadhisthana.energy (D+E)
  const partnerPt = pointOnCircle(center, radius * 0.5, 0); // svadhisthana.physical (C+E)
  const moneyControl = pointOnCircle(center, radius * 0.85, 315); // pushed toward the SE corner
  const onMoneyBow = (t: number): Point => {
    const u = 1 - t;
    return {
      x: u * u * entryPt.x + 2 * u * t * moneyControl.x + t * t * partnerPt.x,
      y: u * u * entryPt.y + 2 * u * t * moneyControl.y + t * t * partnerPt.y,
    };
  };
  const money = matrix.moneyAndRelationships;
  const moneyInner: { key: string; arcana: number; t: number }[] = [
    { key: 'money.toEntry', arcana: money.toEntry, t: 0.25 },
    { key: 'money.core', arcana: money.core, t: 0.5 },
    { key: 'money.toPartner', arcana: money.toPartner, t: 0.75 },
  ];
  for (const m of moneyInner) {
    const point = onMoneyBow(m.t);
    nodes.push({
      key: m.key,
      arcana: m.arcana,
      kind: 'money',
      point,
      angle: 315,
      emphasis: 3,
      label: point,
    });
  }
  const corePt = onMoneyBow(0.5);

  // --- The perimeter age-forecast timeline (#97) ---
  // The eight decade vertices (ages 0/10/…/70) are the outer discs; between each
  // adjacent pair the sub-period arcana are found by bisection. Age runs
  // clockwise from the west vertex at 4.5°/year — the same scale the age ruler
  // uses — so each sub-arcana sits on its own age angle, in a band just outside
  // the discs and inside the age-number labels.
  const decadeArcana = [
    matrix.core.day, // age 0  — W
    matrix.ancestral.paternalSpiritual.corner, // age 10 — NW
    matrix.core.month, // age 20 — N
    matrix.ancestral.maternalSpiritual.corner, // age 30 — NE
    matrix.core.year, // age 40 — E
    matrix.ancestral.paternalMaterial.corner, // age 50 — SE
    matrix.core.sum, // age 60 — S
    matrix.ancestral.maternalMaterial.corner, // age 70 — SW
  ];
  const ageArcanaRadius = radius + size * 0.075;
  const agePeriods: AgePeriod[] = [];
  for (let seg = 0; seg < 8; seg++) {
    const a0 = decadeArcana[seg]!;
    const a1 = decadeArcana[(seg + 1) % 8]!;
    for (const sub of bisectDecade(seg * 10, a0, a1)) {
      const angle = 180 - sub.age * 4.5;
      agePeriods.push({
        age: sub.age,
        arcana: sub.arcana,
        angle,
        point: pointOnCircle(center, ageArcanaRadius, angle),
      });
    }
  }

  // --- Structure ---
  const byKey = (key: string) => nodes.find((n) => n.key === key)!.point;

  return {
    size,
    center,
    radius,
    nodes,
    personalSquare: closedPath(cardinalPoints),
    ancestralSquare: closedPath(diagonalPoints),
    // The parental lines connect OPPOSITE corners — NW↔SE is the paternal line,
    // NE↔SW the maternal one. Adjacent corners would draw the ancestral square
    // again, which is a different (and already-drawn) thing.
    parentalLines: [
      { from: byKey('ancestral.paternalSpiritual'), to: byKey('ancestral.paternalMaterial') },
      { from: byKey('ancestral.maternalSpiritual'), to: byKey('ancestral.maternalMaterial') },
    ],
    spokes: [...cardinalPoints, ...diagonalPoints].map((to) => ({ from: center, to })),
    // The bowed polyline entry → toEntry → core → toPartner → partner, so the
    // drawn line passes through all five arcana instead of cutting straight
    // across the quadrant.
    moneyLine: [entryPt, onMoneyBow(0.25), corePt, onMoneyBow(0.75), partnerPt].reduce<Segment[]>(
      (segs, point, i, all) => (i === 0 ? segs : [...segs, { from: all[i - 1]!, to: point }]),
      [],
    ),
    // The two marks flank `core` — money just past it toward the partner (east)
    // end, love toward the entry (south) end — labelling the one point that
    // carries both readings without crowding the disc's own number.
    moneyMark: { x: corePt.x + size * 0.05, y: corePt.y - size * 0.03 },
    loveMark: { x: corePt.x - size * 0.03, y: corePt.y + size * 0.05 },
    agePeriods,
  };
}
