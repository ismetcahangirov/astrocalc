import * as Astronomy from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { CalcEngineError } from './errors';
import { DEFAULT_HOUSE_SYSTEM, type HousesResult, computeHouses } from './houses';
import type { GeoCoordinates } from './types';

/** A representative mid-latitude birth (near Philadelphia, USA). */
const BIRTH = '1990-05-15T13:45:00Z';
const PLACE: GeoCoordinates = { latitude: 40.0, longitude: -74.0 };

/** Smallest absolute angular separation between two longitudes, in degrees. */
function separation(a: number, b: number): number {
  const diff = Math.abs((a - b) % 360);
  return diff > 180 ? 360 - diff : diff;
}

function normalize(deg: number): number {
  const w = deg % 360;
  return w < 0 ? w + 360 : w;
}

// --- Independent ground truth from astronomy-engine's frame machinery -------
// The Ascendant is the ecliptic degree on the eastern horizon (altitude 0,
// rising); the Midheaven is the degree whose right ascension equals the RAMC.
// We reproduce those two conditions straight from the rotation matrices, with
// none of houses.ts's closed-form trigonometry, to check the module.

function ramcDegrees(iso: string, longitude: number): number {
  const time = Astronomy.MakeTime(new Date(iso));
  return normalize(Astronomy.SiderealTime(time) * 15 + longitude);
}

function eqdVector(iso: string, lonDeg: number): Astronomy.Vector {
  const time = Astronomy.MakeTime(new Date(iso));
  const ect = Astronomy.VectorFromSphere(new Astronomy.Spherical(0, lonDeg, 1), time);
  return Astronomy.RotateVector(Astronomy.Rotation_ECT_EQD(time), ect);
}

function rightAscension(iso: string, lonDeg: number): number {
  return normalize(Astronomy.SphereFromVector(eqdVector(iso, lonDeg)).lon);
}

function altitude(iso: string, place: GeoCoordinates, lonDeg: number): number {
  const time = Astronomy.MakeTime(new Date(iso));
  const observer = new Astronomy.Observer(place.latitude, place.longitude, 0);
  const hor = Astronomy.RotateVector(
    Astronomy.Rotation_EQD_HOR(time, observer),
    eqdVector(iso, lonDeg),
  );
  return Astronomy.SphereFromVector(hor).lat;
}

/** Forward gap a→b around the circle, in `(0, 360)`. */
function forwardGap(a: number, b: number): number {
  const gap = normalize(b - a);
  return gap === 0 ? 360 : gap;
}

describe('computeHouses', () => {
  describe('Ascendant and Midheaven (vs astronomy-engine ground truth)', () => {
    const result = computeHouses(BIRTH, PLACE);

    it('puts the Midheaven on the meridian (its RA equals the RAMC)', () => {
      const ramc = ramcDegrees(BIRTH, PLACE.longitude);
      expect(separation(rightAscension(BIRTH, result.midheaven.longitude), ramc)).toBeLessThan(
        1e-6,
      );
    });

    it('puts the Ascendant on the eastern horizon (altitude 0, rising)', () => {
      expect(Math.abs(altitude(BIRTH, PLACE, result.ascendant.longitude))).toBeLessThan(1e-6);
      // Rising, not setting: the very same degree climbs higher one minute later.
      const later = new Date(new Date(BIRTH).getTime() + 60_000).toISOString();
      expect(altitude(later, PLACE, result.ascendant.longitude)).toBeGreaterThan(
        altitude(BIRTH, PLACE, result.ascendant.longitude),
      );
    });

    it('reports a consistent sign and in-sign degree for both angles', () => {
      for (const point of [result.ascendant, result.midheaven]) {
        expect(point.longitude).toBeGreaterThanOrEqual(0);
        expect(point.longitude).toBeLessThan(360);
        expect(point.degree).toBeGreaterThanOrEqual(0);
        expect(point.degree).toBeLessThan(30);
      }
    });
  });

  describe('Placidus (default)', () => {
    const result = computeHouses(BIRTH, PLACE);

    it('is the default system', () => {
      expect(DEFAULT_HOUSE_SYSTEM).toBe('placidus');
      expect(result.system).toBe('placidus');
      expect(result.fallbackApplied).toBe(false);
      expect(result.fallbackReason).toBeNull();
    });

    it('returns twelve cusps numbered 1..12', () => {
      expect(result.cusps.map((c) => c.house)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it('anchors cusp 1 to the Ascendant and cusp 10 to the Midheaven', () => {
      expect(result.cusps[0]!.longitude).toBeCloseTo(result.ascendant.longitude, 9);
      expect(result.cusps[9]!.longitude).toBeCloseTo(result.midheaven.longitude, 9);
    });

    it('places opposite cusps exactly 180° apart', () => {
      for (let h = 0; h < 6; h++) {
        expect(separation(result.cusps[h]!.longitude, result.cusps[h + 6]!.longitude)).toBeCloseTo(
          180,
          9,
        );
      }
    });

    it('orders the cusps monotonically once around the ecliptic', () => {
      let total = 0;
      for (let h = 0; h < 12; h++) {
        const gap = forwardGap(result.cusps[h]!.longitude, result.cusps[(h + 1) % 12]!.longitude);
        expect(gap).toBeGreaterThan(0);
        expect(gap).toBeLessThan(180);
        total += gap;
      }
      expect(total).toBeCloseTo(360, 6);
    });

    it('derives each cusp sign and degree from its longitude', () => {
      for (const cusp of result.cusps) {
        expect(cusp.degree).toBeCloseTo(cusp.longitude - Math.floor(cusp.longitude / 30) * 30, 9);
      }
    });
  });

  describe('quadrant systems degenerate to equal RA-division at the equator', () => {
    // At latitude 0 every quadrant system coincides (all semi-arcs are 90°), so
    // Placidus and Koch must agree, and the intermediate cusps sit at RAMC + 30k.
    const equatorBirth = '2024-06-21T12:00:00Z';
    const equator: GeoCoordinates = { latitude: 0, longitude: 0 };
    const placidus = computeHouses(equatorBirth, equator, { system: 'placidus' });
    const koch = computeHouses(equatorBirth, equator, { system: 'koch' });

    it('Placidus and Koch give identical cusps', () => {
      for (let h = 0; h < 12; h++) {
        expect(separation(placidus.cusps[h]!.longitude, koch.cusps[h]!.longitude)).toBeLessThan(
          1e-4,
        );
      }
    });

    it('cusp 11 has right ascension RAMC + 30°', () => {
      const ramc = ramcDegrees(equatorBirth, 0);
      expect(
        separation(rightAscension(equatorBirth, placidus.cusps[10]!.longitude), ramc + 30),
      ).toBeLessThan(1e-4);
    });
  });

  describe('Koch', () => {
    const result = computeHouses(BIRTH, PLACE, { system: 'koch' });

    it('anchors cusp 1 to the Ascendant and cusp 10 to the Midheaven', () => {
      expect(result.system).toBe('koch');
      expect(result.cusps[0]!.longitude).toBeCloseTo(result.ascendant.longitude, 9);
      expect(result.cusps[9]!.longitude).toBeCloseTo(result.midheaven.longitude, 9);
    });

    it('orders the cusps monotonically once around the ecliptic', () => {
      let total = 0;
      for (let h = 0; h < 12; h++) {
        const gap = forwardGap(result.cusps[h]!.longitude, result.cusps[(h + 1) % 12]!.longitude);
        expect(gap).toBeGreaterThan(0);
        total += gap;
      }
      expect(total).toBeCloseTo(360, 6);
    });
  });

  describe('Whole Sign', () => {
    const result = computeHouses(BIRTH, PLACE, { system: 'whole-sign' });

    it('never triggers a fallback and works as chosen', () => {
      expect(result.system).toBe('whole-sign');
      expect(result.fallbackApplied).toBe(false);
    });

    it('starts house 1 at 0° of the Ascendant sign and gives every house one whole sign', () => {
      expect(result.cusps[0]!.degree).toBe(0);
      expect(result.cusps[0]!.sign).toBe(result.ascendant.sign);
      for (let h = 0; h < 12; h++) {
        expect(result.cusps[h]!.degree).toBe(0);
        const gap = forwardGap(result.cusps[h]!.longitude, result.cusps[(h + 1) % 12]!.longitude);
        expect(gap).toBeCloseTo(30, 9);
      }
      // All twelve signs appear exactly once.
      expect(new Set(result.cusps.map((c) => c.sign)).size).toBe(12);
    });
  });

  describe('polar-latitude fallback', () => {
    // Longyearbyen, Svalbard — well inside the Arctic Circle.
    const arctic: GeoCoordinates = { latitude: 78.22, longitude: 15.65 };

    const expectFallback = (result: HousesResult, label: string) => {
      expect(result.system).toBe('whole-sign');
      expect(result.fallbackApplied).toBe(true);
      expect(result.fallbackReason).toContain(label);
      // The Ascendant/Midheaven are still reported, and Whole Sign cusps stand in.
      expect(result.ascendant.longitude).toBeGreaterThanOrEqual(0);
      expect(result.cusps).toHaveLength(12);
      expect(result.cusps[0]!.degree).toBe(0);
    };

    it('falls back from Placidus to Whole Sign and explains why', () => {
      const result = computeHouses(BIRTH, arctic, { system: 'placidus' });
      expect(result.requestedSystem).toBe('placidus');
      expectFallback(result, 'Placidus');
    });

    it('falls back from Koch to Whole Sign and explains why', () => {
      const result = computeHouses(BIRTH, arctic, { system: 'koch' });
      expect(result.requestedSystem).toBe('koch');
      expectFallback(result, 'Koch');
    });

    it('does not fall back for Placidus at a temperate latitude', () => {
      expect(computeHouses(BIRTH, PLACE, { system: 'placidus' }).fallbackApplied).toBe(false);
    });
  });

  describe('input validation', () => {
    it('throws CalcEngineError(invalid_input) on an unparseable date-time', () => {
      expect(() => computeHouses('not-a-date', PLACE)).toThrowError(CalcEngineError);
    });

    it('rejects non-finite coordinates', () => {
      expect(() => computeHouses(BIRTH, { latitude: Number.NaN, longitude: 0 })).toThrowError(
        CalcEngineError,
      );
    });

    it('rejects the geographic poles, where no house system is defined', () => {
      try {
        computeHouses(BIRTH, { latitude: 90, longitude: 0 });
        throw new Error('expected a throw');
      } catch (error) {
        expect(error).toBeInstanceOf(CalcEngineError);
        expect((error as CalcEngineError).code).toBe('unsupported');
      }
    });
  });
});
