import { describe, expect, it } from 'vitest';
import { CalcEngineError } from './errors';
import {
  type Aspect,
  type AspectBody,
  computeAspects,
  DEFAULT_ORBS,
} from './aspects';
import { computePlanetaryPositions } from './planetary-positions';

/** Grab the (single) aspect between two named bodies, or fail. */
function between(aspects: Aspect[], a: string, b: string): Aspect {
  const match = aspects.find(
    (x) => (x.bodyA === a && x.bodyB === b) || (x.bodyA === b && x.bodyB === a),
  );
  if (!match) throw new Error(`no aspect between ${a} and ${b}`);
  return match;
}

describe('computeAspects', () => {
  describe('aspect type and exact degree difference', () => {
    it('recognises each major aspect at its exact angle', () => {
      const cases: Array<[number, string, number]> = [
        [0, 'conjunction', 0],
        [60, 'sextile', 60],
        [90, 'square', 90],
        [120, 'trine', 120],
        [180, 'opposition', 180],
      ];
      for (const [offset, type, angle] of cases) {
        const bodies: AspectBody[] = [
          { body: 'sun', longitude: 10 },
          { body: 'mars', longitude: 10 + offset },
        ];
        const [aspect] = computeAspects(bodies);
        expect(aspect).toMatchObject({ type, angle, separation: offset, orb: 0 });
      }
    });

    it('reports the exact degree difference and the deviation (orb) from exactness', () => {
      const bodies: AspectBody[] = [
        { body: 'sun', longitude: 10 },
        { body: 'moon', longitude: 74.5 }, // 64.5° apart → sextile (60°), 4.5° orb
      ];
      const aspect = between(computeAspects(bodies), 'sun', 'moon');
      expect(aspect.type).toBe('sextile');
      expect(aspect.separation).toBeCloseTo(64.5, 9);
      expect(aspect.orb).toBeCloseTo(4.5, 9);
    });

    it('measures separation as the shortest arc across the 0°/360° seam', () => {
      const bodies: AspectBody[] = [
        { body: 'venus', longitude: 350 },
        { body: 'saturn', longitude: 50 }, // 60° apart the short way
      ];
      const aspect = between(computeAspects(bodies), 'venus', 'saturn');
      expect(aspect.type).toBe('sextile');
      expect(aspect.separation).toBeCloseTo(60, 9);
    });

    it('caps separation at 180° (never reports the reflex angle)', () => {
      const bodies: AspectBody[] = [
        { body: 'sun', longitude: 0 },
        { body: 'moon', longitude: 200 }, // reflex 200°, short arc 160°
      ];
      // 160° from opposition (180°) is 20° — outside every default orb.
      expect(computeAspects(bodies)).toHaveLength(0);
    });
  });

  describe('orb configuration', () => {
    it('uses the documented default orb per aspect type', () => {
      // 7.5° from conjunction: inside the 8° default, so it is an aspect.
      expect(computeAspects([
        { body: 'sun', longitude: 0 },
        { body: 'mercury', longitude: 7.5 },
      ])).toHaveLength(1);
      // 6.5° from sextile: outside the 6° default sextile orb, so it is not.
      expect(computeAspects([
        { body: 'sun', longitude: 0 },
        { body: 'mercury', longitude: 66.5 },
      ])).toHaveLength(0);
    });

    it('honours a per-aspect-type orb override from the (admin) configuration', () => {
      const bodies: AspectBody[] = [
        { body: 'sun', longitude: 0 },
        { body: 'mercury', longitude: 66.5 }, // 6.5° from a sextile
      ];
      expect(computeAspects(bodies, { orbs: { sextile: 6 } })).toHaveLength(0);
      const widened = computeAspects(bodies, { orbs: { sextile: 8 } });
      expect(widened).toHaveLength(1);
      expect(widened[0]!.type).toBe('sextile');
    });

    it('picks the closest aspect when a wide orb would match two', () => {
      const bodies: AspectBody[] = [
        { body: 'sun', longitude: 0 },
        { body: 'mars', longitude: 104 }, // 14° from square, 16° from trine
      ];
      const [aspect] = computeAspects(bodies, { orbs: { square: 15, trine: 15 } });
      expect(aspect!.type).toBe('square');
      expect(aspect!.orb).toBeCloseTo(14, 9);
    });

    it('exposes the factory defaults for documentation/admin seeding', () => {
      expect(DEFAULT_ORBS).toEqual({
        conjunction: 8,
        opposition: 8,
        trine: 8,
        square: 7,
        sextile: 6,
      });
    });
  });

  describe('applying / separating status', () => {
    it('marks a faster body catching up from behind as applying', () => {
      // Moon (fast, +13°/day) is 8° behind the Sun (slow, +1°/day) → closing in.
      const aspects = computeAspects([
        { body: 'sun', longitude: 8, speed: 1 },
        { body: 'moon', longitude: 0, speed: 13 },
      ]);
      expect(between(aspects, 'sun', 'moon').applying).toBe(true);
    });

    it('marks a faster body pulling ahead as separating', () => {
      // Moon is 8° ahead of the Sun and moving away faster → separating.
      const aspects = computeAspects([
        { body: 'sun', longitude: 0, speed: 1 },
        { body: 'moon', longitude: 8, speed: 13 },
      ]);
      expect(between(aspects, 'sun', 'moon').applying).toBe(false);
    });

    it('is null when a speed is missing for either body', () => {
      const aspects = computeAspects([
        { body: 'sun', longitude: 0, speed: 1 },
        { body: 'moon', longitude: 8 },
      ]);
      expect(between(aspects, 'sun', 'moon').applying).toBeNull();
    });

    it('handles applying across the 0°/360° seam', () => {
      // Mars at 358° moving forward toward Venus at 4° (conjunction), Venus slower.
      const aspects = computeAspects([
        { body: 'mars', longitude: 358, speed: 0.6 },
        { body: 'venus', longitude: 4, speed: 1.1 },
      ]);
      // Venus (ahead, faster) pulls away from Mars → separating.
      expect(between(aspects, 'mars', 'venus').applying).toBe(false);
    });
  });

  describe('every pair', () => {
    it('evaluates all unordered pairs and returns each aspecting one once', () => {
      const bodies: AspectBody[] = [
        { body: 'sun', longitude: 0 },
        { body: 'moon', longitude: 90 }, // square Sun
        { body: 'mars', longitude: 180 }, // opposition Sun, square Moon
      ];
      const aspects = computeAspects(bodies);
      expect(aspects).toHaveLength(3);
      expect(between(aspects, 'sun', 'moon').type).toBe('square');
      expect(between(aspects, 'sun', 'mars').type).toBe('opposition');
      expect(between(aspects, 'moon', 'mars').type).toBe('square');
    });

    it('returns nothing when no pair is within orb', () => {
      expect(
        computeAspects([
          { body: 'sun', longitude: 0 },
          { body: 'moon', longitude: 45 },
        ]),
      ).toHaveLength(0);
    });
  });

  describe('input validation', () => {
    it('rejects an out-of-range orb override', () => {
      expect(() =>
        computeAspects([{ body: 'sun', longitude: 0 }], { orbs: { conjunction: -1 } }),
      ).toThrowError(CalcEngineError);
      expect(() =>
        computeAspects([{ body: 'sun', longitude: 0 }], { orbs: { conjunction: 999 } }),
      ).toThrowError(CalcEngineError);
    });

    it('rejects a non-finite longitude or speed', () => {
      expect(() => computeAspects([{ body: 'sun', longitude: Number.NaN }])).toThrowError(
        CalcEngineError,
      );
      expect(() =>
        computeAspects([{ body: 'sun', longitude: 0, speed: Number.POSITIVE_INFINITY }]),
      ).toThrowError(CalcEngineError);
    });
  });

  describe('integration with computePlanetaryPositions', () => {
    it('finds the Sun–Moon opposition at the January 2024 full moon', () => {
      // Full moon: 2024-01-25 17:54 UT — Sun and Moon within a degree of exact
      // opposition, comfortably inside the default 8° orb.
      const positions = computePlanetaryPositions('2024-01-25T17:54:00Z');
      const aspect = between(computeAspects(positions), 'sun', 'moon');
      expect(aspect.type).toBe('opposition');
      expect(aspect.orb).toBeLessThan(1);
      // Real speeds flow through, so the status is a concrete boolean.
      expect(typeof aspect.applying).toBe('boolean');
    });

    it('reports the North/South node pairing as an exact opposition', () => {
      const positions = computePlanetaryPositions('2024-01-01T00:00:00Z');
      const aspect = between(computeAspects(positions), 'northNode', 'southNode');
      expect(aspect.type).toBe('opposition');
      expect(aspect.orb).toBeLessThan(1e-6);
    });
  });
});
