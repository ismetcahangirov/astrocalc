import * as Astronomy from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { CalcEngineError } from './errors';
import {
  type CelestialBody,
  type PlanetPosition,
  computePlanetaryPositions,
} from './planetary-positions';

/** One arcminute, in degrees — the accuracy target from issue #13. */
const ARCMINUTE = 1 / 60;

/**
 * Reference apparent geocentric ecliptic longitudes (IAU76/80 ecliptic of
 * date, degrees) for 2024-01-01 00:00:00 UT, from NASA/JPL Horizons
 * (CENTER=500@399, quantity 31, ObsEcLon). These are the "known reference
 * values" the acceptance criteria require the engine to reproduce to ±1'.
 */
const HORIZONS_EPOCH = '2024-01-01T00:00:00Z';
const HORIZONS_LONGITUDE: Partial<Record<CelestialBody, number>> = {
  sun: 280.0389812,
  moon: 155.9921866,
  mercury: 262.2816922,
  venus: 242.6122975,
  mars: 267.3083422,
  jupiter: 35.5823812,
  saturn: 333.243533,
  uranus: 49.3839119,
  neptune: 355.0761521,
  pluto: 299.3576621,
  // Chiron: only asserted when the opt-in flag is set (see below).
  chiron: 15.4625666,
};

/** Smallest absolute angular separation between two longitudes, in degrees. */
function separation(a: number, b: number): number {
  const diff = Math.abs((a - b) % 360);
  return diff > 180 ? 360 - diff : diff;
}

function byBody(positions: PlanetPosition[], body: CelestialBody): PlanetPosition {
  const match = positions.find((p) => p.body === body);
  if (!match) throw new Error(`no position for ${body}`);
  return match;
}

describe('computePlanetaryPositions', () => {
  describe('accuracy vs JPL Horizons reference values (±1 arcminute)', () => {
    const positions = computePlanetaryPositions(HORIZONS_EPOCH);

    for (const { body, aeBody } of [
      { body: 'sun' as const, aeBody: 'Sun' },
      { body: 'moon' as const, aeBody: 'Moon' },
      { body: 'mercury' as const, aeBody: 'Mercury' },
      { body: 'venus' as const, aeBody: 'Venus' },
      { body: 'mars' as const, aeBody: 'Mars' },
      { body: 'jupiter' as const, aeBody: 'Jupiter' },
      { body: 'saturn' as const, aeBody: 'Saturn' },
      { body: 'uranus' as const, aeBody: 'Uranus' },
      { body: 'neptune' as const, aeBody: 'Neptune' },
      { body: 'pluto' as const, aeBody: 'Pluto' },
    ]) {
      it(`places ${aeBody} within 1 arcminute of Horizons`, () => {
        const expected = HORIZONS_LONGITUDE[body]!;
        const actual = byBody(positions, body).longitude;
        expect(separation(actual, expected)).toBeLessThan(ARCMINUTE);
      });
    }
  });

  describe('lunar nodes', () => {
    it('reports the descending node exactly opposite the ascending node', () => {
      const positions = computePlanetaryPositions(HORIZONS_EPOCH);
      const north = byBody(positions, 'northNode');
      const south = byBody(positions, 'southNode');
      expect(separation(north.longitude, south.longitude)).toBeCloseTo(180, 6);
      expect(north.retrograde).toBe(south.retrograde);
    });

    it('mean node is always retrograde', () => {
      const positions = computePlanetaryPositions(HORIZONS_EPOCH, { nodeModel: 'mean' });
      expect(byBody(positions, 'northNode').retrograde).toBe(true);
    });

    it('true node matches the Moon at an independently-found ascending crossing', () => {
      // At an ascending node the Moon sits on the ecliptic, so its longitude
      // *is* the ascending node's longitude. Cross-check our osculating true
      // node against Astronomy Engine's independent node search.
      let node = Astronomy.SearchMoonNode(new Date(Date.UTC(2024, 0, 1)));
      while (node.kind !== Astronomy.NodeEventKind.Ascending) {
        node = Astronomy.NextMoonNode(node);
      }
      const at = node.time.date.toISOString();
      const positions = computePlanetaryPositions(at, { nodeModel: 'true' });
      const moon = byBody(positions, 'moon').longitude;
      const northNode = byBody(positions, 'northNode').longitude;
      expect(separation(northNode, moon)).toBeLessThan(ARCMINUTE);
    });
  });

  describe('retrograde status', () => {
    const positions = computePlanetaryPositions(HORIZONS_EPOCH);

    it('never marks the luminaries retrograde', () => {
      expect(byBody(positions, 'sun').retrograde).toBe(false);
      expect(byBody(positions, 'moon').retrograde).toBe(false);
    });

    it('detects Uranus retrograde and Pluto direct on 2024-01-01', () => {
      // Uranus was mid-retrograde (Aug 2023 – Jan 2024); Pluto direct.
      expect(byBody(positions, 'uranus').retrograde).toBe(true);
      expect(byBody(positions, 'pluto').retrograde).toBe(false);
    });
  });

  describe('output shape', () => {
    const positions = computePlanetaryPositions(HORIZONS_EPOCH);

    it('returns the ten bodies plus both nodes, in order, without Chiron by default', () => {
      expect(positions.map((p) => p.body)).toEqual([
        'sun',
        'moon',
        'mercury',
        'venus',
        'mars',
        'jupiter',
        'saturn',
        'uranus',
        'neptune',
        'pluto',
        'northNode',
        'southNode',
      ]);
    });

    it('derives a consistent sign and in-sign degree from every longitude', () => {
      const order: ZodiacName[] = [
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
      for (const p of positions) {
        expect(p.longitude).toBeGreaterThanOrEqual(0);
        expect(p.longitude).toBeLessThan(360);
        expect(p.degree).toBeGreaterThanOrEqual(0);
        expect(p.degree).toBeLessThan(30);
        expect(p.sign).toBe(order[Math.floor(p.longitude / 30)]);
        expect(p.degree).toBeCloseTo(p.longitude - Math.floor(p.longitude / 30) * 30, 9);
      }
    });

    it('places the Sun at ~10° Capricorn on 2024-01-01', () => {
      const sun = byBody(positions, 'sun');
      expect(sun.sign).toBe('Capricorn');
      expect(sun.degree).toBeGreaterThan(9);
      expect(sun.degree).toBeLessThan(11);
    });
  });

  describe('Chiron (opt-in)', () => {
    it('is absent unless enabled', () => {
      const positions = computePlanetaryPositions(HORIZONS_EPOCH);
      expect(positions.some((p) => p.body === 'chiron')).toBe(false);
    });

    it('is appended and matches Horizons within 1 arcminute when enabled', () => {
      const positions = computePlanetaryPositions(HORIZONS_EPOCH, { includeChiron: true });
      const chiron = byBody(positions, 'chiron');
      expect(positions[positions.length - 1]!.body).toBe('chiron');
      expect(separation(chiron.longitude, HORIZONS_LONGITUDE.chiron!)).toBeLessThan(ARCMINUTE);
      expect(chiron.sign).toBe('Aries');
    });
  });

  describe('input validation', () => {
    it('accepts an explicit UTC offset by reducing it to the same instant', () => {
      const z = computePlanetaryPositions('2024-01-01T00:00:00Z');
      const offset = computePlanetaryPositions('2024-01-01T04:00:00+04:00');
      expect(byBody(offset, 'sun').longitude).toBeCloseTo(byBody(z, 'sun').longitude, 9);
    });

    it('throws CalcEngineError(invalid_input) on an unparseable date-time', () => {
      expect(() => computePlanetaryPositions('not-a-date')).toThrowError(CalcEngineError);
      try {
        computePlanetaryPositions('');
      } catch (error) {
        expect(error).toBeInstanceOf(CalcEngineError);
        expect((error as CalcEngineError).code).toBe('invalid_input');
      }
    });
  });
});

type ZodiacName = PlanetPosition['sign'];
