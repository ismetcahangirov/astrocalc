import type { DestinyMatrix } from '@astrocalc/calc-engine';

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
  | 'ancestralCentre';

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
 * Turn a computed Matrix into flat drawable primitives.
 *
 * The result is deterministic and side-effect free, so a renderer can compute it
 * once in a `useMemo` and simply draw the returned points.
 *
 * Only the positions with a place on the figure are laid out here: the four
 * cardinals, the four ancestral corners and their arm points, and the two
 * centres. The purposes, the money/relationship line and the chakra map have no
 * agreed position on the octagram itself and are rendered as the written
 * breakdown beneath it (`matrixText.ts`) — putting them on the figure would mean
 * inventing a placement the method does not define.
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
  };
}
