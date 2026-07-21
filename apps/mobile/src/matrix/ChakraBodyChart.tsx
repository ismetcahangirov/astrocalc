import { Image, Platform, View } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Line,
  Text as SkiaText,
  matchFont,
  type SkFont,
} from '@shopify/react-native-skia';
import type { ChakraFigureLayout, ChakraNode, Point } from './chakraGeometry';
import { chartTheme } from '../chart/theme';

/** The seated lotus figure with a cosmic video masked to its silhouette (#103). */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CHAKRA_GIF = require('../../assets/chakra-body.gif');

interface ChakraBodyChartProps {
  /** Precomputed via `computeChakraFigureLayout()` — this component only draws it. */
  layout: ChakraFigureLayout;
}

/** Skia doesn't auto-centre text on a point; offset by the glyph's own measured box. */
function centered(font: SkFont, text: string, cx: number, cy: number): Point {
  const box = font.measureText(text);
  return { x: cx - box.width / 2, y: cy + box.height / 2 };
}

/**
 * The Chakra figure: the masked video of a seated body ({@link CHAKRA_GIF}, a
 * looping cosmic animation clipped to the lotus silhouette) with the seven
 * colour-coded chakra discs placed along its spine.
 *
 * Two layers, same square box: the animated `Image` underneath — a plain GIF, so
 * Fresco animates it with no extra native module — and a transparent Skia
 * `Canvas` on top for the discs. The figure image already carries transparency,
 * so the screen's dark background shows through around it.
 *
 * Disc placement is precomputed in `chakraGeometry.ts`; this component only
 * draws. Numbers are plain ASCII, so the system font via `matchFont` is enough —
 * asked for by an explicit `fontFamily`, without which Android draws no text for
 * a weighted style.
 */
export function ChakraBodyChart({ layout }: ChakraBodyChartProps) {
  const { size } = layout;
  const fontFamily = Platform.select({ ios: 'Helvetica', default: 'sans-serif' });
  const numberFont = matchFont({ fontFamily, fontSize: size * 0.042, fontWeight: '700' });

  const renderNode = (node: ChakraNode) => {
    const label = String(node.emotional);
    const pos = numberFont ? centered(numberFont, label, node.center.x, node.center.y) : null;
    return (
      <Group key={node.chakra}>
        {/* A soft same-colour glow lifts each chakra off the figure. */}
        <Circle
          cx={node.center.x}
          cy={node.center.y}
          r={node.radius * 1.7}
          color={node.color}
          opacity={0.18}
        />
        <Circle cx={node.center.x} cy={node.center.y} r={node.radius} color={node.color} />
        <Circle
          cx={node.center.x}
          cy={node.center.y}
          r={node.radius}
          style="stroke"
          strokeWidth={1.4}
          color="rgba(255, 255, 255, 0.8)"
        />
        {numberFont && pos ? (
          <SkiaText font={numberFont} text={label} x={pos.x} y={pos.y} color={node.ink} />
        ) : null}
      </Group>
    );
  };

  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={CHAKRA_GIF}
        style={{ position: 'absolute', width: size, height: size }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <Canvas style={{ position: 'absolute', width: size, height: size }}>
        {/* The energy channel the chakras sit on — faint, since the body shows it. */}
        <Line
          p1={layout.channel.top}
          p2={layout.channel.bottom}
          color={chartTheme.goldFaint}
          strokeWidth={1}
        />
        {layout.nodes.map(renderNode)}
      </Canvas>
    </View>
  );
}
