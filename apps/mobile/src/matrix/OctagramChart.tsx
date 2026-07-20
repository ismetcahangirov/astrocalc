import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Line,
  Text as SkiaText,
  matchFont,
  type SkFont,
} from '@shopify/react-native-skia';
import {
  Easing,
  interpolate,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { pointOnCircle, type OctagramLayout, type OctagramNode, type Point } from './geometry';
import { arcanaColors } from './palette';
import { chartTheme } from '../chart/theme';

interface OctagramChartProps {
  /** Precomputed via `computeOctagramLayout()` — this component only draws it. */
  layout: OctagramLayout;
}

/** Skia doesn't auto-centre text on a point; offset by the glyph's own measured box. */
function centered(font: SkFont, text: string, cx: number, cy: number): Point {
  const box = font.measureText(text);
  return { x: cx - box.width / 2, y: cy + box.height / 2 };
}

/** Disc radius for a node, by its visual weight. */
function discRadius(node: OctagramNode, size: number): number {
  const byEmphasis = { 1: 0.052, 2: 0.042, 3: 0.03 } as const;
  return size * byEmphasis[node.emphasis];
}

/**
 * The age each of the eight outer points marks. Life runs clockwise from the
 * left (west) vertex — 0 there, +10 years per point — the standard Matrix age
 * scale every reference calculator prints around the figure. Keyed by the
 * point's screen angle so it needs no extra field on the node.
 */
const AGE_BY_ANGLE: Readonly<Record<number, string>> = {
  180: '0', // W
  135: '10', // NW
  90: '20', // N
  45: '30', // NE
  0: '40', // E
  315: '50', // SE
  270: '60', // S
  225: '70', // SW
};

/**
 * Renders a precomputed {@link OctagramLayout} (`geometry.ts`) as the Matrix of
 * Destiny octagram: the two overlaid squares, the parental diagonals, spokes out
 * to the eight points, a colour-coded numbered disc at every position, and the
 * 0–70 age scale around the perimeter — the rich, multi-coloured figure the
 * reference calculators draw. Disc colours come from {@link arcanaColors}.
 *
 * All the placement math already ran in `computeOctagramLayout` — this component
 * is pure presentation over flat point data, mirroring `NatalChartWheel`'s split
 * exactly.
 *
 * **No bundled glyph font is needed**: every value here is an arcana number,
 * plain ASCII, so the system font via `matchFont` is enough — but note it is
 * asked for by an explicit `fontFamily`, without which Android silently draws no
 * text for a weighted style. The `AstroSymbols.ttf` subset carries zodiac and
 * planet glyphs, none of which appear on this figure.
 */
export function OctagramChart({ layout }: OctagramChartProps) {
  const { size, center } = layout;

  // Android's `matchFont` needs an explicit family — without one, a weighted
  // style resolves to nothing and the numbers silently don't draw. iOS is
  // forgiving, but naming a family there too keeps the two platforms identical.
  const fontFamily = Platform.select({ ios: 'Helvetica', default: 'sans-serif' });
  const arcanaFonts = {
    1: matchFont({ fontFamily, fontSize: size * 0.055, fontWeight: '700' }),
    2: matchFont({ fontFamily, fontSize: size * 0.045, fontWeight: '600' }),
    3: matchFont({ fontFamily, fontSize: size * 0.033, fontWeight: '600' }),
  } as const;
  const ageFont = matchFont({ fontFamily, fontSize: size * 0.03, fontWeight: '600' });

  // One-shot "reveal" on mount, driving a single 0→1 progress on the UI thread —
  // the same staged entrance the wheel uses: the structure draws in first, then
  // the outer points, then the inner detail.
  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) });
  }, [reveal]);

  const structureOpacity = useDerivedValue(() =>
    interpolate(reveal.value, [0, 0.45], [0, 1], 'clamp'),
  );
  const structureTransform = useDerivedValue(() => [
    { scale: interpolate(reveal.value, [0, 0.6], [0.92, 1], 'clamp') },
  ]);
  const outerOpacity = useDerivedValue(() =>
    interpolate(reveal.value, [0.35, 0.8], [0, 1], 'clamp'),
  );
  const innerOpacity = useDerivedValue(() => interpolate(reveal.value, [0.6, 1], [0, 1], 'clamp'));

  // Outer points and inner detail are drawn in two groups so each can fade on its
  // own; splitting here (rather than per-node) keeps it to two animated groups.
  const { outerNodes, innerNodes } = useMemo(
    () => ({
      outerNodes: layout.nodes.filter((n) => n.kind === 'cardinal' || n.kind === 'diagonal'),
      innerNodes: layout.nodes.filter(
        (n) => n.kind === 'arm' || n.kind === 'centre' || n.kind === 'ancestralCentre',
      ),
    }),
    [layout.nodes],
  );

  const renderNode = (node: OctagramNode) => {
    const font = arcanaFonts[node.emphasis];
    const label = String(node.arcana);
    const radius = discRadius(node, size);
    // Every disc is filled with its arcana's own colour, and its number drawn in
    // the ink that colour was paired with for contrast — so the figure reads as
    // the multi-coloured Matrix the reference calculators draw, with the number
    // legible on every point rather than gold-on-gold.
    const { fill, ink } = arcanaColors(node.arcana);
    const pos = font ? centered(font, label, node.point.x, node.point.y) : null;

    return (
      <Group key={node.key}>
        <Circle cx={node.point.x} cy={node.point.y} r={radius} color={fill} />
        {/* A soft light rim gives each disc a bead-like edge and lifts it off
            the dark backdrop, whatever its fill. */}
        <Circle
          cx={node.point.x}
          cy={node.point.y}
          r={radius}
          style="stroke"
          strokeWidth={1.3}
          color="rgba(255, 255, 255, 0.55)"
        />
        {font && pos ? <SkiaText font={font} text={label} x={pos.x} y={pos.y} color={ink} /> : null}
      </Group>
    );
  };

  // The 0–70 age scale, one label just outside each of the eight outer points.
  const renderAge = (node: OctagramNode) => {
    const age = AGE_BY_ANGLE[node.angle];
    if (!age || !ageFont) return null;
    const at = pointOnCircle(
      center,
      layout.radius + discRadius(node, size) + size * 0.03,
      node.angle,
    );
    const pos = centered(ageFont, age, at.x, at.y);
    return (
      <SkiaText
        key={`age-${node.key}`}
        font={ageFont}
        text={age}
        x={pos.x}
        y={pos.y}
        color={chartTheme.textMuted}
      />
    );
  };

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group opacity={structureOpacity} transform={structureTransform} origin={center}>
        {/* Backdrop disc behind the figure, for depth */}
        <Circle cx={center.x} cy={center.y} r={layout.radius * 1.08} color={chartTheme.disc} />

        {/* Spokes from the centre to each of the eight points */}
        {layout.spokes.map((spoke, i) => (
          <Line
            key={`spoke-${i}`}
            p1={spoke.from}
            p2={spoke.to}
            color={chartTheme.goldFaint}
            strokeWidth={0.7}
          />
        ))}

        {/* The two parental diagonals, emphasised — they are read as lines */}
        {layout.parentalLines.map((line, i) => (
          <Line
            key={`parental-${i}`}
            p1={line.from}
            p2={line.to}
            color={chartTheme.goldMuted}
            strokeWidth={1.3}
          />
        ))}

        {/* The personal square (cardinals) and the ancestral square (diagonals),
            overlaid to form the eight-pointed star. */}
        {layout.personalSquare.map((edge, i) => (
          <Line
            key={`personal-${i}`}
            p1={edge.from}
            p2={edge.to}
            color={chartTheme.gold}
            strokeWidth={1.5}
          />
        ))}
        {layout.ancestralSquare.map((edge, i) => (
          <Line
            key={`ancestral-${i}`}
            p1={edge.from}
            p2={edge.to}
            color={chartTheme.goldMuted}
            strokeWidth={1.2}
          />
        ))}
      </Group>

      <Group opacity={outerOpacity}>
        {outerNodes.map(renderAge)}
        {outerNodes.map(renderNode)}
      </Group>
      <Group opacity={innerOpacity}>{innerNodes.map(renderNode)}</Group>
    </Canvas>
  );
}
