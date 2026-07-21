import { useEffect, useMemo, type ReactElement } from 'react';
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
  /** Localized caption for the paternal (NW–SE) diagonal. */
  maleLineLabel?: string;
  /** Localized caption for the maternal (NE–SW) diagonal. */
  femaleLineLabel?: string;
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

/** Colour of the half-decade age numbers, dimmer than the decade ones. */
const AGE_MINOR = 'rgba(185, 180, 199, 0.5)';

/** The money ("$") and love ("♥") marks on the money/relationship line. */
const MONEY_GREEN = '#3FB56B';
const LOVE_RED = '#E5484D';

/**
 * An SVG heart path centred on `(cx, cy)`, `w` wide — drawn as a shape rather
 * than the "♥" glyph, which the system font has no glyph for on Android (it
 * renders as tofu).
 */
function heartPath(cx: number, cy: number, w: number): string {
  const r = w / 4;
  const top = cy - w * 0.28;
  const cleft = cy - w * 0.06;
  const bottom = cy + w * 0.42;
  return (
    `M ${cx} ${bottom} ` +
    `C ${cx - w * 0.5} ${cy} ${cx - w * 0.5} ${top} ${cx - r} ${top} ` +
    `C ${cx - r * 0.4} ${top} ${cx} ${cleft} ${cx} ${cleft} ` +
    `C ${cx} ${cleft} ${cx + r * 0.4} ${top} ${cx + r} ${top} ` +
    `C ${cx + w * 0.5} ${top} ${cx + w * 0.5} ${cy} ${cx} ${bottom} Z`
  );
}

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
export function OctagramChart({
  layout,
  maleLineLabel = 'male generation line',
  femaleLineLabel = 'female generation line',
}: OctagramChartProps) {
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
  const tickLabelFont = matchFont({ fontFamily, fontSize: size * 0.021, fontWeight: '500' });
  const genFont = matchFont({ fontFamily, fontSize: size * 0.023, fontWeight: '500' });
  const markFont = matchFont({ fontFamily, fontSize: size * 0.05, fontWeight: '700' });
  // The perimeter age-forecast arcana are deliberately tiny — a dense background
  // ring of ~56 numbers, read on close inspection, not competing with the discs.
  const agePeriodFont = matchFont({ fontFamily, fontSize: size * 0.019, fontWeight: '600' });

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
        (n) =>
          n.kind === 'arm' ||
          n.kind === 'centre' ||
          n.kind === 'ancestralCentre' ||
          n.kind === 'axis' ||
          n.kind === 'money',
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

  // The age scale around the perimeter: a fine tick every year, a longer tick and
  // a number at each half-decade, longest and brightest at each decade. Age runs
  // clockwise from the west vertex (0); one full turn is 80 years, so 1 year =
  // 4.5°. This is the ruler every reference figure prints outside the octagram.
  const ageTickInner = layout.radius + size * 0.055;
  const ageLabelR = layout.radius + size * 0.1;
  const renderAgeScale = (): ReactElement[] => {
    const items: ReactElement[] = [];
    for (let a = 0; a < 80; a++) {
      const angle = 180 - a * 4.5;
      const decade = a % 10 === 0;
      const half = a % 5 === 0;
      const len = size * (decade ? 0.03 : half ? 0.022 : 0.013);
      items.push(
        <Line
          key={`tick-${a}`}
          p1={pointOnCircle(center, ageTickInner, angle)}
          p2={pointOnCircle(center, ageTickInner + len, angle)}
          color={decade ? chartTheme.goldMuted : chartTheme.goldFaint}
          strokeWidth={decade ? 1 : 0.6}
        />,
      );
      const font = decade ? ageFont : tickLabelFont;
      if (half && font) {
        const at = pointOnCircle(center, ageLabelR, angle);
        const pos = centered(font, String(a), at.x, at.y);
        items.push(
          <SkiaText
            key={`age-${a}`}
            font={font}
            text={String(a)}
            x={pos.x}
            y={pos.y}
            color={decade ? chartTheme.textMuted : AGE_MINOR}
          />,
        );
      }
    }
    return items;
  };

  // The age-forecast arcana: one tiny number per ~1.25-year sub-period, sitting
  // in a band just outside the discs — the ruling energy of each slice of the
  // life timeline the age ruler measures.
  const renderAgePeriods = (): ReactElement[] => {
    if (!agePeriodFont) return [];
    return layout.agePeriods.map((p) => {
      const label = String(p.arcana);
      const pos = centered(agePeriodFont, label, p.point.x, p.point.y);
      return (
        <SkiaText
          key={`ageperiod-${p.age}`}
          font={agePeriodFont}
          text={label}
          x={pos.x}
          y={pos.y}
          color={AGE_MINOR}
        />
      );
    });
  };

  // The two diagonals name the parental "generation lines" — male on the paternal
  // (NW–SE) diagonal, female on the maternal (NE–SW) one — each rotated to run
  // along its line, as the reference figures label them.
  const renderGenerationLabels = (): ReactElement | null => {
    if (!genFont) return null;
    const male = pointOnCircle(center, layout.radius * 0.6, 135); // NW arm
    const female = pointOnCircle(center, layout.radius * 0.6, 45); // NE arm
    const malePos = centered(genFont, maleLineLabel, male.x, male.y);
    const femalePos = centered(genFont, femaleLineLabel, female.x, female.y);
    return (
      <>
        {/* NW–SE diagonal is a "\" — the label slants with it (clockwise 45°). */}
        <Group transform={[{ rotate: Math.PI / 4 }]} origin={male}>
          <SkiaText
            font={genFont}
            text={maleLineLabel}
            x={malePos.x}
            y={malePos.y}
            color={chartTheme.textMuted}
          />
        </Group>
        {/* NE–SW diagonal is a "/" — the label slants the other way. */}
        <Group transform={[{ rotate: -Math.PI / 4 }]} origin={female}>
          <SkiaText
            font={genFont}
            text={femaleLineLabel}
            x={femalePos.x}
            y={femalePos.y}
            color={chartTheme.textMuted}
          />
        </Group>
      </>
    );
  };

  // The "$" and "♥" marks flanking the money/relationship line's core.
  const renderMark = (glyph: string, color: string, at: Point) => {
    if (!markFont) return null;
    const pos = centered(markFont, glyph, at.x, at.y);
    return (
      <SkiaText
        key={`mark-${glyph}`}
        font={markFont}
        text={glyph}
        x={pos.x}
        y={pos.y}
        color={color}
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

        {/* The money/relationship line, drawn along the SE diagonal. */}
        {layout.moneyLine.map((seg, i) => (
          <Line
            key={`money-${i}`}
            p1={seg.from}
            p2={seg.to}
            color="rgba(228, 185, 91, 0.5)"
            strokeWidth={1.1}
          />
        ))}

        {/* The age ruler around the perimeter — outside the discs, so it lives
            in the structure layer. */}
        {renderAgeScale()}
        {/* The age-forecast arcana ride the same ruler, one per sub-period. */}
        {renderAgePeriods()}
      </Group>

      <Group opacity={outerOpacity}>{outerNodes.map(renderNode)}</Group>
      <Group opacity={innerOpacity}>
        {innerNodes.map(renderNode)}
        {renderMark('$', MONEY_GREEN, layout.moneyMark)}
        <Path
          path={heartPath(layout.loveMark.x, layout.loveMark.y, size * 0.05)}
          color={LOVE_RED}
        />
        {/* The generation-line names cross the arm discs, so they are drawn last
            to stay legible over them — as the reference figures show them. */}
        {renderGenerationLabels()}
      </Group>
    </Canvas>
  );
}
