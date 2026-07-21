import { type ChakraName, type DestinyMatrix } from '@astrocalc/calc-engine';

/**
 * Pure, framework-independent geometry for the **Chakra figure** (#101, #103).
 *
 * Same split as `matrix/geometry.ts` and `chart/geometry.ts`: this module turns a
 * computed {@link DestinyMatrix} into flat, ready-to-draw primitives — seven
 * placed chakra discs on a central channel — and imports nothing from React
 * Native or Skia, so it runs in a plain Node test runner.
 *
 * The body itself is no longer drawn here: it is a masked video (the lotus-pose
 * figure, `assets/chakra-body.gif`) rendered underneath by the component. This
 * module only places the chakra discs onto that figure's spine, so the canvas is
 * **square**, matching the figure image, and every `CHAKRA_Y` is tuned to the
 * body part its chakra governs on that specific silhouette.
 *
 * The chakra *values* are the Matrix of Destiny health map (`computeHealthMap`,
 * Ladini §5.2). The disc shows the **emotional** cell — the synthesis of the row,
 * and the same arcana its reading is written for (`chakraReading.ts`).
 */

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

export interface ChakraFigureLayout {
  /** Square canvas side — matches the figure image. */
  size: number;
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
 * Vertical placement of each chakra as a fraction of the square canvas, crown to
 * root — tuned to the seated lotus figure in `assets/chakra-body.gif`: head,
 * brow, throat, chest, upper belly, lower belly, and the pelvic base where the
 * legs cross. The horizontal axis is the figure's centreline (`x = size / 2`).
 */
const CHAKRA_Y: Readonly<Record<ChakraName, number>> = {
  sahasrara: 0.11,
  ajna: 0.175,
  vishuddha: 0.275,
  anahata: 0.42,
  manipura: 0.5,
  svadhisthana: 0.565,
  muladhara: 0.63,
};

/** Build the chakra-disc layout for a computed Matrix over the square figure. */
export function computeChakraFigureLayout(matrix: DestinyMatrix, size: number): ChakraFigureLayout {
  const cx = size / 2;
  const radius = size * 0.045;

  const nodes: ChakraNode[] = matrix.health.map((row) => {
    const style = CHAKRA_STYLE[row.chakra];
    return {
      chakra: row.chakra,
      center: { x: cx, y: CHAKRA_Y[row.chakra] * size },
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
    channel: { top: nodes[0]!.center, bottom: nodes[nodes.length - 1]!.center },
    nodes,
  };
}
