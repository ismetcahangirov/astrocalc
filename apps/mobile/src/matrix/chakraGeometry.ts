import { type ChakraName, type DestinyMatrix } from '@astrocalc/calc-engine';

/**
 * Pure, framework-independent geometry for the **Chakra body chart** (#101).
 *
 * Same split as `matrix/geometry.ts` and `chart/geometry.ts`: this module turns a
 * computed {@link DestinyMatrix} into flat, ready-to-draw primitives — a seated
 * silhouette path, a central channel, and seven placed chakra discs — and imports
 * nothing from React Native or Skia, so it runs in a plain Node test runner and
 * any renderer can consume it.
 *
 * The chakra *values* are the Matrix of Destiny health map (`computeHealthMap`,
 * Ladini §5.2): each of the seven rows has a physical, an energy, and an
 * emotional (their reduced sum) cell. The disc shows the **emotional** cell — the
 * synthesis of the row, and the same arcana its reading is written for
 * (`chakraReading.ts`).
 *
 * Coordinate convention: a portrait canvas `size` wide and {@link CANVAS_RATIO} ×
 * `size` tall, figure centred on the vertical axis `x = size / 2`. All landmark
 * positions are fractions of the canvas so the figure scales with `size`.
 */

/** Canvas height as a multiple of its width — tall enough for a seated figure. */
export const CANVAS_RATIO = 1.32;

/** A 2-D point in canvas pixel space. */
export interface Point {
  x: number;
  y: number;
}

/** One placed chakra, ready to draw. */
export interface ChakraNode {
  chakra: ChakraName;
  /** Disc centre, on the vertical axis. */
  center: Point;
  radius: number;
  /** The chakra's traditional colour. */
  color: string;
  /** Number colour, chosen for contrast against {@link color}. */
  ink: string;
  /** The three health-map cells. */
  physical: number;
  energy: number;
  /** `reduce(physical + energy)` — the value drawn on the disc. */
  emotional: number;
}

export interface ChakraBodyLayout {
  size: number;
  height: number;
  /** Filled seated silhouette (torso + crossed legs). */
  bodyPath: string;
  /** Head circle, drawn on top of the silhouette. */
  head: { center: Point; radius: number };
  /** Two arm strokes resting from the shoulders onto the knees. */
  arms: string[];
  /** The central energy channel (Sushumna), crown disc to root disc. */
  channel: { top: Point; bottom: Point };
  /** The seven chakras, crown to root — the same order as the health map. */
  nodes: ChakraNode[];
}

const WHITE = '#FFFFFF';
const DARK_INK = '#1A1206';

/**
 * The traditional chakra colours, crown to root: violet, indigo, blue, green,
 * yellow, orange, red — the rainbow every chakra chart uses. `ink` is the number
 * colour that stays legible on each fill (dark only on the light yellow).
 */
const CHAKRA_STYLE: Readonly<Record<ChakraName, { color: string; ink: string }>> = {
  sahasrara: { color: '#8B5CF6', ink: WHITE }, // crown — violet
  ajna: { color: '#4F46E5', ink: WHITE }, // brow — indigo
  vishuddha: { color: '#2AA9E0', ink: WHITE }, // throat — blue
  anahata: { color: '#22C55E', ink: WHITE }, // heart — green
  manipura: { color: '#EAB308', ink: DARK_INK }, // solar plexus — yellow
  svadhisthana: { color: '#F97316', ink: WHITE }, // sacral — orange
  muladhara: { color: '#EF4444', ink: WHITE }, // root — red
};

/**
 * Vertical placement of each chakra as a fraction of canvas height, crown to
 * root — head, brow, throat, chest, upper belly, lower belly, base — so each disc
 * lands on the body part its chakra governs.
 */
const CHAKRA_Y: Readonly<Record<ChakraName, number>> = {
  sahasrara: 0.075,
  ajna: 0.155,
  vishuddha: 0.235,
  anahata: 0.335,
  manipura: 0.425,
  svadhisthana: 0.515,
  muladhara: 0.605,
};

/** Body landmarks: y (fraction of height) and half-width (fraction of width). */
const HEAD = { y: 0.13, r: 0.095 };
const NECK = { y: 0.205, half: 0.052 };
const SHOULDER = { y: 0.25, half: 0.2 };
const WAIST = { y: 0.44, half: 0.12 };
const HIP = { y: 0.55, half: 0.175 };
const KNEE = { y: 0.71, half: 0.34 };
const LAP = { y: 0.82, half: 0.22 };

/** A smooth vertical cubic segment between two outline points (tangents vertical). */
function vseg(a: Point, b: Point): string {
  const midY = a.y + (b.y - a.y) * 0.5;
  return `C ${a.x} ${midY} ${b.x} ${midY} ${b.x} ${b.y}`;
}

function buildBodyPath(cx: number, w: number, h: number): string {
  const L = (lm: { y: number; half: number }): Point => ({ x: cx - lm.half * w, y: lm.y * h });
  const R = (lm: { y: number; half: number }): Point => ({ x: cx + lm.half * w, y: lm.y * h });

  const down = [NECK, SHOULDER, WAIST, HIP, KNEE, LAP];
  const up = [KNEE, HIP, WAIST, SHOULDER, NECK];

  let d = `M ${L(NECK).x} ${L(NECK).y} `;
  for (let i = 1; i < down.length; i++) d += vseg(L(down[i - 1]!), L(down[i]!)) + ' ';
  // The seat: a gentle downward bulge across the crossed legs.
  d += `Q ${cx} ${LAP.y * h + h * 0.03} ${R(LAP).x} ${R(LAP).y} `;
  for (let i = 1; i < up.length; i++) d += vseg(R(up[i - 1]!), R(up[i]!)) + ' ';
  d += 'Z';
  return d;
}

function buildArm(cx: number, w: number, h: number, sign: 1 | -1): string {
  const shoulder: Point = { x: cx + sign * SHOULDER.half * w * 0.92, y: SHOULDER.y * h + h * 0.01 };
  const knee: Point = { x: cx + sign * KNEE.half * w * 0.82, y: KNEE.y * h - h * 0.015 };
  // Elbow bows outward then the forearm rests in toward the knee.
  const elbow: Point = {
    x: cx + sign * (SHOULDER.half + 0.03) * w,
    y: (SHOULDER.y + HIP.y) * 0.5 * h,
  };
  return `M ${shoulder.x} ${shoulder.y} Q ${elbow.x} ${elbow.y} ${knee.x} ${knee.y}`;
}

/** Build the full seated-body chakra layout for a computed Matrix. */
export function computeChakraBodyLayout(matrix: DestinyMatrix, size: number): ChakraBodyLayout {
  const height = size * CANVAS_RATIO;
  const cx = size / 2;
  const radius = size * 0.062;

  const nodes: ChakraNode[] = matrix.health.map((row) => {
    const style = CHAKRA_STYLE[row.chakra];
    return {
      chakra: row.chakra,
      center: { x: cx, y: CHAKRA_Y[row.chakra] * height },
      radius,
      color: style.color,
      ink: style.ink,
      physical: row.physical,
      energy: row.energy,
      emotional: row.emotional,
    };
  });

  return {
    size,
    height,
    bodyPath: buildBodyPath(cx, size, height),
    head: { center: { x: cx, y: HEAD.y * height }, radius: HEAD.r * size },
    arms: [buildArm(cx, size, height, -1), buildArm(cx, size, height, 1)],
    channel: {
      top: nodes[0]!.center,
      bottom: nodes[nodes.length - 1]!.center,
    },
    nodes,
  };
}
