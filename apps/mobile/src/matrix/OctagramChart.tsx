import { useEffect, useMemo } from 'react';
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
import type { OctagramLayout, OctagramNode, Point } from './geometry';
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
 * Renders a precomputed {@link OctagramLayout} (`geometry.ts`) as the Matrix of
 * Destiny octagram: the two overlaid squares, the parental diagonals, spokes out
 * to the eight points, and a numbered disc at every position.
 *
 * All the placement math already ran in `computeOctagramLayout` — this component
 * is pure presentation over flat point data, mirroring `NatalChartWheel`'s split
 * exactly.
 *
 * Unlike the natal-chart wheel, **no bundled glyph font is needed**: every value
 * here is an arcana number, which is plain ASCII, so `matchFont` (the system
 * font) is enough. The `AstroSymbols.ttf` subset carries zodiac and planet
 * glyphs, none of which appear on this figure.
 */
export function OctagramChart({ layout }: OctagramChartProps) {
  const { size, center } = layout;

  const arcanaFonts = {
    1: matchFont({ fontSize: size * 0.055, fontWeight: '700' }),
    2: matchFont({ fontSize: size * 0.045, fontWeight: '600' }),
    3: matchFont({ fontSize: size * 0.033, fontWeight: '500' }),
  } as const;

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
    // The two primary readings — the cardinals and the comfort zone — get a
    // filled gold disc; everything else is outlined, so the eye lands on the
    // points the method treats as primary rather than on all eighteen at once.
    const filled = node.kind === 'cardinal' || node.kind === 'centre';
    const pos = font ? centered(font, label, node.point.x, node.point.y) : null;

    return (
      <Group key={node.key}>
        <Circle
          cx={node.point.x}
          cy={node.point.y}
          r={radius}
          color={filled ? chartTheme.gold : chartTheme.disc}
        />
        {!filled ? (
          <Circle
            cx={node.point.x}
            cy={node.point.y}
            r={radius}
            style="stroke"
            strokeWidth={1.1}
            color={node.kind === 'arm' ? chartTheme.goldMuted : chartTheme.gold}
          />
        ) : null}
        {font && pos ? (
          <SkiaText
            font={font}
            text={label}
            x={pos.x}
            y={pos.y}
            color={filled ? chartTheme.onGold : chartTheme.gold}
          />
        ) : null}
      </Group>
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

      <Group opacity={outerOpacity}>{outerNodes.map(renderNode)}</Group>
      <Group opacity={innerOpacity}>{innerNodes.map(renderNode)}</Group>
    </Canvas>
  );
}
