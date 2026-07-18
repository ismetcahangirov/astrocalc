import { describe, expect, it } from 'vitest';
import {
  computeWheelLayout,
  longitudeToAngle,
  normalize360,
  pointOnCircle,
  spreadAngles,
  type WheelInput,
} from './geometry';

const closeTo = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe('normalize360', () => {
  it('wraps into [0, 360)', () => {
    expect(normalize360(0)).toBe(0);
    expect(normalize360(360)).toBe(0);
    expect(normalize360(370)).toBe(10);
    expect(normalize360(-10)).toBe(350);
    expect(normalize360(-370)).toBe(350);
  });
});

describe('longitudeToAngle', () => {
  it('puts 0° Aries on the left when no ascendant is given', () => {
    expect(longitudeToAngle(0)).toBe(180);
  });

  it('puts the ascendant on the left (9 o’clock)', () => {
    expect(longitudeToAngle(123.4, 123.4)).toBe(180);
  });

  it('increases counter-clockwise: +90° longitude → toward the bottom', () => {
    // 90° past the ascendant maps to the 6-o’clock screen angle (270°).
    expect(longitudeToAngle(90, 0)).toBe(270);
  });

  it('wraps across the 0°/360° seam', () => {
    expect(longitudeToAngle(350, 10)).toBe(160);
  });
});

describe('pointOnCircle', () => {
  const c = { x: 100, y: 100 };
  it('maps cardinal screen angles with y pointing down', () => {
    const right = pointOnCircle(c, 50, 0);
    expect(closeTo(right.x, 150) && closeTo(right.y, 100)).toBe(true);

    const top = pointOnCircle(c, 50, 90);
    expect(closeTo(top.x, 100) && closeTo(top.y, 50)).toBe(true); // y up on screen

    const left = pointOnCircle(c, 50, 180);
    expect(closeTo(left.x, 50) && closeTo(left.y, 100)).toBe(true);

    const bottom = pointOnCircle(c, 50, 270);
    expect(closeTo(bottom.x, 100) && closeTo(bottom.y, 150)).toBe(true);
  });
});

describe('spreadAngles (planet de-collision)', () => {
  it('leaves a single planet untouched', () => {
    expect(spreadAngles([42], 10)).toEqual([42]);
  });

  it('leaves well-separated planets untouched', () => {
    expect(spreadAngles([10, 100, 200], 10)).toEqual([10, 100, 200]);
  });

  it('fans out a tight clump to exactly the minimum gap, centred on the mean', () => {
    const out = spreadAngles([100, 102], 10);
    // Mean 101 preserved; symmetric ±5.
    expect(closeTo(out[0]!, 96)).toBe(true);
    expect(closeTo(out[1]!, 106)).toBe(true);
    expect(closeTo((out[0]! + out[1]!) / 2, 101)).toBe(true);
  });

  it('preserves input order for the returned array', () => {
    // Give them out of sorted order; result must line up index-for-index.
    const out = spreadAngles([102, 100, 101], 10);
    // Sorted mean is 101; three glyphs at 91, 101, 111.
    expect(closeTo(out[1]!, 91)).toBe(true); // the 100
    expect(closeTo(out[2]!, 101)).toBe(true); // the 101
    expect(closeTo(out[0]!, 111)).toBe(true); // the 102
  });

  it('spreads a clump straddling the 0°/360° seam', () => {
    const out = spreadAngles([359, 1], 10);
    // Mean across the seam is 360 → 0; symmetric ±5 → 355 and 5.
    expect(closeTo(out[0]!, 355)).toBe(true);
    expect(closeTo(out[1]!, 5)).toBe(true);
  });

  it('always yields at least minGap between every adjacent pair', () => {
    const input = [10, 11, 12, 13, 200, 201];
    const out = spreadAngles(input, 9)
      .slice()
      .sort((a, b) => a - b);
    for (let i = 1; i < out.length; i++) {
      expect(out[i]! - out[i - 1]!).toBeGreaterThanOrEqual(9 - 1e-9);
    }
  });
});

const samplePlanets = [
  { body: 'sun', longitude: 15, retrograde: false },
  { body: 'moon', longitude: 210, retrograde: false },
  { body: 'mercury', longitude: 16, retrograde: true },
];

describe('computeWheelLayout', () => {
  const base: WheelInput = { size: 300, planets: samplePlanets };

  it('always produces the twelve zodiac wedges', () => {
    const layout = computeWheelLayout(base);
    expect(layout.signs).toHaveLength(12);
    expect(layout.signs[0]!.index).toBe(0);
  });

  it('degrades gracefully without house data (zodiac ring + planets only)', () => {
    const layout = computeWheelLayout(base);
    expect(layout.hasHouses).toBe(false);
    expect(layout.houses).toHaveLength(0);
    expect(layout.planets).toHaveLength(3);
    expect(layout.signs).toHaveLength(12);
  });

  it('draws twelve house lines when cusps are supplied', () => {
    const houseCusps = Array.from({ length: 12 }, (_, i) => ({
      house: i + 1,
      longitude: normalize360(30 + i * 30),
    }));
    const layout = computeWheelLayout({
      ...base,
      houseCusps,
      ascendantLongitude: 30,
    });
    expect(layout.hasHouses).toBe(true);
    expect(layout.houses).toHaveLength(12);
    // Ascendant (house 1) is emphasised and sits on the left horizon.
    const asc = layout.houses.find((h) => h.house === 1)!;
    expect(asc.angular).toBe(true);
    expect(closeTo(asc.angle, 180)).toBe(true);
    const mc = layout.houses.find((h) => h.house === 10)!;
    expect(mc.angular).toBe(true);
  });

  it('preserves retrograde flags on the planet layout', () => {
    const layout = computeWheelLayout(base);
    const mercury = layout.planets.find((p) => p.body === 'mercury')!;
    expect(mercury.retrograde).toBe(true);
  });

  it('resolves aspect chords to endpoints and skips unknown bodies', () => {
    const layout = computeWheelLayout({
      ...base,
      aspects: [
        { bodyA: 'sun', bodyB: 'moon', type: 'trine' },
        { bodyA: 'sun', bodyB: 'pluto', type: 'square' }, // pluto not drawn → skipped
      ],
    });
    expect(layout.aspects).toHaveLength(1);
    expect(layout.aspects[0]!.type).toBe('trine');
    expect(layout.aspects[0]!.from).toBeDefined();
    expect(layout.aspects[0]!.to).toBeDefined();
  });

  it('de-collides the near-conjunct Sun and Mercury glyphs', () => {
    const layout = computeWheelLayout(base);
    const sun = layout.planets.find((p) => p.body === 'sun')!;
    const mercury = layout.planets.find((p) => p.body === 'mercury')!;
    // True longitudes are 1° apart; glyph angles must be pushed further apart.
    const glyphGap = Math.abs(sun.glyphAngle - mercury.glyphAngle);
    expect(glyphGap).toBeGreaterThan(1);
    // The degree marks still sit at the true longitudes (connectors stay honest).
    expect(closeTo(sun.trueAngle, longitudeToAngle(15))).toBe(true);
    expect(closeTo(mercury.trueAngle, longitudeToAngle(16))).toBe(true);
  });

  it('keeps every drawn point finite and on-canvas-ish', () => {
    const layout = computeWheelLayout(base);
    for (const p of layout.planets) {
      expect(Number.isFinite(p.glyph.x)).toBe(true);
      expect(Number.isFinite(p.glyph.y)).toBe(true);
    }
  });
});
