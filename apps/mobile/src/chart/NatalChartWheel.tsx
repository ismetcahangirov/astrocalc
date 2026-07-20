import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import {
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Line,
  Path,
  Text as SkiaText,
  matchFont,
  useFont,
  type SkFont,
} from '@shopify/react-native-skia';
import {
  Easing,
  interpolate,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { normalize360, type Point, type WheelLayout } from './geometry';
import { aspectStyles, chartTheme } from './theme';
import { bodyGlyph, SIGN_GLYPHS } from './symbols';

interface NatalChartWheelProps {
  /** Precomputed via `computeWheelLayout()` — this component only draws it. */
  layout: WheelLayout;
}

/** Skia doesn't auto-centre text on a point; offset by the glyph's own measured box. */
function centered(font: SkFont, text: string, cx: number, cy: number): Point {
  const box = font.measureText(text);
  return { x: cx - box.width / 2, y: cy + box.height / 2 };
}

/** SVG-style path data for a straight segment — what `<Path>` expects for a chord/leader line. */
function linePath(from: Point, to: Point): string {
  return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
}

/** Shortest angular distance between two screen angles, wrap-safe around 0°/360°. */
function angularDistance(a: number, b: number): number {
  const diff = Math.abs(normalize360(a) - normalize360(b));
  return Math.min(diff, 360 - diff);
}

/**
 * Renders a precomputed {@link WheelLayout} (`geometry.ts`) as the natal-chart
 * "wheel": the zodiac ring with sign glyphs, degree ticks, house-cusp lines
 * and numbers (only present when the birth time is known — the layout itself
 * degrades gracefully, so this component just draws whatever it's handed),
 * de-collided planet glyphs with a retrograde "R" mark, and aspect chords
 * (dashed for sextiles, per the brand's `aspectStyles`).
 *
 * All the geometry/de-collision math already ran in `computeWheelLayout` —
 * this component is pure presentation over flat point data, so a parent can
 * `useMemo` the layout and keep this cheap enough to redraw at ~60fps.
 */
export function NatalChartWheel({ layout }: NatalChartWheelProps) {
  const { size, center, radii } = layout;

  // Zodiac + planet glyphs are Unicode astrological symbols that the default
  // system fonts don't include, so they render blank with `matchFont`. Load a
  // tiny bundled subset font (see assets/fonts/AstroSymbols.ttf) that has them.
  // House numbers and the retrograde "R" are plain ASCII, so they keep the
  // system font — but `matchFont` must be given an explicit family, or on
  // Android a weighted style (the "R") resolves to nothing and draws blank.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const glyphSource = require('../../assets/fonts/AstroSymbols.ttf');
  const systemFamily = Platform.select({ ios: 'Helvetica', default: 'sans-serif' });
  const signFont = useFont(glyphSource, size * 0.05);
  const planetFont = useFont(glyphSource, size * 0.05);
  const houseFont = useMemo(
    () => matchFont({ fontFamily: systemFamily, fontSize: size * 0.028 }),
    [size, systemFamily],
  );
  const retroFont = useMemo(
    () => matchFont({ fontFamily: systemFamily, fontSize: size * 0.022, fontWeight: '700' }),
    [size, systemFamily],
  );

  // One-shot "reveal" on mount, driving a single 0→1 progress on the UI thread:
  // the ring/signs fade + scale in, then the aspect chords draw on, then the
  // planet glyphs fade in — a calm, staged entrance rather than a hard cut.
  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) });
  }, [reveal]);

  // Ring + signs + houses: fade in over the first ~half, with a gentle scale-up.
  const ringOpacity = useDerivedValue(() => interpolate(reveal.value, [0, 0.45], [0, 1], 'clamp'));
  const ringTransform = useDerivedValue(() => [
    { scale: interpolate(reveal.value, [0, 0.6], [0.92, 1], 'clamp') },
  ]);
  // Aspect chords "draw on" (Skia trims the path to `end`) through the middle.
  const aspectEnd = useDerivedValue(() => interpolate(reveal.value, [0.35, 0.8], [0, 1], 'clamp'));
  // Planet glyphs fade in last.
  const planetsOpacity = useDerivedValue(() =>
    interpolate(reveal.value, [0.55, 1], [0, 1], 'clamp'),
  );

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group opacity={ringOpacity} transform={ringTransform} origin={center}>
        {/* Backdrop disc + zodiac ring strokes */}
        <Circle cx={center.x} cy={center.y} r={radii.outer} color={chartTheme.disc} />
        <Circle
          cx={center.x}
          cy={center.y}
          r={radii.outer}
          style="stroke"
          strokeWidth={1.5}
          color={chartTheme.gold}
        />
        <Circle
          cx={center.x}
          cy={center.y}
          r={radii.zodiacInner}
          style="stroke"
          strokeWidth={1}
          color={chartTheme.goldMuted}
        />
        {layout.hasHouses ? (
          <Circle
            cx={center.x}
            cy={center.y}
            r={radii.aspectRing}
            style="stroke"
            strokeWidth={0.75}
            color={chartTheme.goldFaint}
          />
        ) : null}

        {/* Degree ticks, every 5° (bolder every 30°, at the sign boundaries) */}
        {layout.ticks.map((tick) => (
          <Line
            key={`tick-${tick.angle}`}
            p1={tick.inner}
            p2={tick.outer}
            color={tick.major ? chartTheme.gold : chartTheme.goldFaint}
            strokeWidth={tick.major ? 1.25 : 0.6}
          />
        ))}

        {/* Zodiac sign glyphs (only once the bundled glyph font has loaded) */}
        {signFont &&
          layout.signs.map((sign) => {
            const glyph = SIGN_GLYPHS[sign.index] ?? '?';
            const pos = centered(signFont, glyph, sign.glyph.x, sign.glyph.y);
            return (
              <SkiaText
                key={`sign-${sign.index}`}
                font={signFont}
                text={glyph}
                x={pos.x}
                y={pos.y}
                color={chartTheme.gold}
              />
            );
          })}

        {/* House-cusp lines + numbers (absent entirely when the birth time is unknown) */}
        {layout.houses.map((house) => {
          const label = String(house.house);
          const pos = centered(houseFont, label, house.label.x, house.label.y);
          return (
            <Group key={`house-${house.house}`}>
              <Line
                p1={house.inner}
                p2={house.outer}
                color={house.angular ? chartTheme.gold : chartTheme.goldMuted}
                strokeWidth={house.angular ? 1.75 : 0.85}
              />
              <SkiaText
                font={houseFont}
                text={label}
                x={pos.x}
                y={pos.y}
                color={chartTheme.textMuted}
              />
            </Group>
          );
        })}

        {/* Aspect chords — animated `end` trims each chord so they draw on. */}
        {layout.aspects.map((aspect, i) => {
          const style = aspectStyles[aspect.type];
          return (
            <Path
              key={`aspect-${aspect.bodyA}-${aspect.bodyB}-${i}`}
              path={linePath(aspect.from, aspect.to)}
              style="stroke"
              strokeWidth={style.width}
              color={style.color}
              end={aspectEnd}
            >
              {style.dashed ? <DashPathEffect intervals={[6, 4]} /> : null}
            </Path>
          );
        })}

        {/* Planet glyphs (fade in last) — a short leader line only when de-collision
          moved the glyph away from its true degree, plus a retrograde "R" mark. */}
        <Group opacity={planetsOpacity}>
          {planetFont &&
            layout.planets.map((planet) => {
              const glyph = bodyGlyph(planet.body);
              const glyphPos = centered(planetFont, glyph, planet.glyph.x, planet.glyph.y);
              const needsLeader = angularDistance(planet.trueAngle, planet.glyphAngle) > 0.5;
              return (
                <Group key={`planet-${planet.body}`}>
                  {needsLeader ? (
                    <Line
                      p1={planet.degreeMark}
                      p2={planet.glyph}
                      color={chartTheme.goldFaint}
                      strokeWidth={0.6}
                    />
                  ) : null}
                  <Circle
                    cx={planet.glyph.x}
                    cy={planet.glyph.y}
                    r={size * 0.018}
                    color={chartTheme.gold}
                  />
                  <SkiaText
                    font={planetFont}
                    text={glyph}
                    x={glyphPos.x}
                    y={glyphPos.y}
                    color={chartTheme.onGold}
                  />
                  {planet.retrograde ? (
                    <SkiaText
                      font={retroFont}
                      text="R"
                      x={planet.glyph.x + size * 0.02}
                      y={planet.glyph.y - size * 0.02}
                      color={chartTheme.retrograde}
                    />
                  ) : null}
                </Group>
              );
            })}
        </Group>
      </Group>
    </Canvas>
  );
}
