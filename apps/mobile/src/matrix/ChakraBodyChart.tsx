import { Platform } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Line,
  Path,
  Text as SkiaText,
  matchFont,
  type SkFont,
} from '@shopify/react-native-skia';
import type { ChakraBodyLayout, ChakraNode, Point } from './chakraGeometry';
import { chartTheme } from '../chart/theme';

interface ChakraBodyChartProps {
  /** Precomputed via `computeChakraBodyLayout()` — this component only draws it. */
  layout: ChakraBodyLayout;
}

/** Skia doesn't auto-centre text on a point; offset by the glyph's own measured box. */
function centered(font: SkFont, text: string, cx: number, cy: number): Point {
  const box = font.measureText(text);
  return { x: cx - box.width / 2, y: cy + box.height / 2 };
}

/** Soft translucent body fill and its rim, so the silhouette reads without dominating the discs. */
const BODY_FILL = 'rgba(150, 134, 190, 0.15)';
const BODY_RIM = 'rgba(228, 185, 91, 0.34)';

/**
 * Renders a precomputed {@link ChakraBodyLayout} (`chakraGeometry.ts`) as a seated
 * figure with the seven chakras placed along the spine — the familiar chakra
 * chart, in the app's gold/dark theme. Each disc carries its emotional
 * (synthesis) arcana; the physical/energy/emotional breakdown and the reading
 * live in the list beneath the figure.
 *
 * Pure presentation over flat point data, mirroring `OctagramChart` /
 * `NatalChartWheel`. Numbers are plain ASCII, so the system font via `matchFont`
 * is enough — asked for by an explicit `fontFamily`, without which Android draws
 * no text for a weighted style.
 */
export function ChakraBodyChart({ layout }: ChakraBodyChartProps) {
  const { size, height } = layout;
  const fontFamily = Platform.select({ ios: 'Helvetica', default: 'sans-serif' });
  const numberFont = matchFont({ fontFamily, fontSize: size * 0.046, fontWeight: '700' });

  const renderNode = (node: ChakraNode) => {
    const label = String(node.emotional);
    const pos = numberFont ? centered(numberFont, label, node.center.x, node.center.y) : null;
    return (
      <Group key={node.chakra}>
        {/* A soft same-colour glow lifts each chakra off the dark figure. */}
        <Circle
          cx={node.center.x}
          cy={node.center.y}
          r={node.radius * 1.7}
          color={node.color}
          opacity={0.12}
        />
        <Circle cx={node.center.x} cy={node.center.y} r={node.radius} color={node.color} />
        <Circle
          cx={node.center.x}
          cy={node.center.y}
          r={node.radius}
          style="stroke"
          strokeWidth={1.4}
          color="rgba(255, 255, 255, 0.7)"
        />
        {numberFont && pos ? (
          <SkiaText font={numberFont} text={label} x={pos.x} y={pos.y} color={node.ink} />
        ) : null}
      </Group>
    );
  };

  return (
    <Canvas style={{ width: size, height }}>
      {/* Body silhouette: torso + crossed legs, then the head on top. */}
      <Path path={layout.bodyPath} color={BODY_FILL} />
      <Path path={layout.bodyPath} style="stroke" strokeWidth={1.4} color={BODY_RIM} />
      <Circle
        cx={layout.head.center.x}
        cy={layout.head.center.y}
        r={layout.head.radius}
        color={BODY_FILL}
      />
      <Circle
        cx={layout.head.center.x}
        cy={layout.head.center.y}
        r={layout.head.radius}
        style="stroke"
        strokeWidth={1.4}
        color={BODY_RIM}
      />
      {layout.arms.map((d, i) => (
        <Path key={`arm-${i}`} path={d} style="stroke" strokeWidth={1.4} color={BODY_RIM} />
      ))}

      {/* The central channel (Sushumna) the chakras sit on. */}
      <Line
        p1={layout.channel.top}
        p2={layout.channel.bottom}
        color={chartTheme.goldMuted}
        strokeWidth={1.2}
      />

      {layout.nodes.map(renderNode)}
    </Canvas>
  );
}
