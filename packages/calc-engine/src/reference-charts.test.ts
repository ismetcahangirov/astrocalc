import { describe, expect, it } from 'vitest';
import { DEFAULT_ORBS } from './aspects';
import { computeNatalChart } from './natal-chart';
import type { ZodiacSign } from './planetary-positions';
import { REFERENCE_CHARTS } from './__fixtures__/reference-charts';

/**
 * Cross-validation against real external calculators (#21). Each fixture in
 * `__fixtures__/reference-charts.ts` was manually collected from
 * astro-seek.com (spot-checked against astro.com); this suite computes the
 * same birth data through this package's own `computeNatalChart()` and
 * asserts the two land within a documented tolerance.
 *
 * Tolerances are deliberately looser than raw ephemeris precision (see
 * `planetary-positions.test.ts`'s ±1 arcminute JPL Horizons checks) because
 * the reference values are display-rounded to the nearest arcminute at the
 * source and come from an independent implementation — a couple of
 * arcminutes of cross-implementation variance is normal and immaterial for
 * astrological interpretation. What this suite is actually guarding against
 * is a *real* miscalculation (wrong sign, wrong house, a body off by
 * degrees), not sub-arcminute drift.
 */
const POSITION_TOLERANCE_ARCMIN = 3;
const ANGLE_TOLERANCE_ARCMIN = 3;

/** Aspects are only compared when the reference orb sits comfortably inside
 * our own {@link DEFAULT_ORBS} cap for that aspect type — astro-seek's own
 * default orb table is wider for some aspect types than ours, so an aspect
 * reported there with an orb near (or past) our cap would fail here for a
 * configuration reason, not a computation bug. See the fixture header. */
const ASPECT_ORB_SAFETY_MARGIN_DEG = 1.5;

const SIGNS: readonly ZodiacSign[] = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
];

function toLongitude(sign: ZodiacSign, degree: number, minute: number): number {
  return SIGNS.indexOf(sign) * 30 + degree + minute / 60;
}

/** Shortest angular distance in degrees, wrap-safe around 0°/360°. */
function angularDistanceDeg(a: number, b: number): number {
  const norm = (deg: number) => ((deg % 360) + 360) % 360;
  const diff = Math.abs(norm(a) - norm(b));
  return Math.min(diff, 360 - diff);
}

describe.each(REFERENCE_CHARTS)('cross-validation: $label', (fixture) => {
  const chart = computeNatalChart(fixture.input);
  const skip = new Set(fixture.knownDeviations?.fields ?? []);

  it('matches every planetary position within tolerance', () => {
    const skipDegrees = skip.has('positions'); // documented deviation — see fixture's knownDeviations

    for (const refPos of fixture.positions) {
      const ours = chart.positions.find((p) => p.body === refPos.body);
      expect(ours, `${refPos.body} is missing from the computed chart`).toBeDefined();

      // Retrograde status doesn't flip over the ~1 hour a documented time-offset
      // deviation could introduce, so it's always worth checking.
      expect(ours!.retrograde, `${refPos.body} retrograde status mismatch`).toBe(refPos.retrograde);

      if (skipDegrees) continue;

      const refLongitude = toLongitude(refPos.sign, refPos.degree, refPos.minute);
      const diffArcmin = angularDistanceDeg(refLongitude, ours!.longitude) * 60;
      expect(
        diffArcmin,
        `${refPos.body}: reference ${refPos.sign} ${refPos.degree}°${refPos.minute}' vs ` +
          `computed ${ours!.sign} ${ours!.degree.toFixed(2)}° — off by ${diffArcmin.toFixed(1)}'`,
      ).toBeLessThanOrEqual(POSITION_TOLERANCE_ARCMIN);
    }
  });

  it('matches Ascendant and Midheaven within tolerance', () => {
    if (skip.has('houses')) return; // documented deviation — see fixture's knownDeviations
    expect(chart.houses, 'expected houses to be computed (birth time is known)').not.toBeNull();

    const refAsc = toLongitude(
      fixture.ascendant.sign,
      fixture.ascendant.degree,
      fixture.ascendant.minute,
    );
    const ascDiff = angularDistanceDeg(refAsc, chart.houses!.ascendant.longitude) * 60;
    expect(ascDiff, `Ascendant off by ${ascDiff.toFixed(1)}'`).toBeLessThanOrEqual(
      ANGLE_TOLERANCE_ARCMIN,
    );

    const refMc = toLongitude(
      fixture.midheaven.sign,
      fixture.midheaven.degree,
      fixture.midheaven.minute,
    );
    const mcDiff = angularDistanceDeg(refMc, chart.houses!.midheaven.longitude) * 60;
    expect(mcDiff, `Midheaven off by ${mcDiff.toFixed(1)}'`).toBeLessThanOrEqual(
      ANGLE_TOLERANCE_ARCMIN,
    );
  });

  it('reproduces every unambiguous reference aspect', () => {
    for (const refAspect of fixture.aspects) {
      const cap = DEFAULT_ORBS[refAspect.type];
      if (cap - refAspect.orbDegrees < ASPECT_ORB_SAFETY_MARGIN_DEG) continue;

      const found = chart.aspects.some(
        (a) =>
          a.type === refAspect.type &&
          ((a.bodyA === refAspect.bodyA && a.bodyB === refAspect.bodyB) ||
            (a.bodyA === refAspect.bodyB && a.bodyB === refAspect.bodyA)),
      );
      expect(
        found,
        `${refAspect.bodyA}-${refAspect.bodyB} ${refAspect.type} ` +
          `(orb ${refAspect.orbDegrees}°) not found among our computed aspects`,
      ).toBe(true);
    }
  });
});

describe('reference fixture completeness', () => {
  it('covers at least 10 scenarios, per issue #21 acceptance criteria', () => {
    expect(REFERENCE_CHARTS.length).toBeGreaterThanOrEqual(10);
  });

  it('every scenario documents its source', () => {
    for (const fixture of REFERENCE_CHARTS) {
      expect(fixture.source.site.length).toBeGreaterThan(0);
      expect(fixture.source.url.length).toBeGreaterThan(0);
    }
  });
});
