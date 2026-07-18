import { describe, expect, it } from 'vitest';
import { CalcEngineError } from './errors';
import { computeNatalChart, NATAL_CHART_SCHEMA_VERSION, type NatalChartInput } from './natal-chart';
import { computePlanetaryPositions } from './planetary-positions';
import { computeHouses } from './houses';
import { computeAspects } from './aspects';
import { resolveBirthInstant } from './timezone-lookup';

/** A fully-specified New York birth (exact time known). */
const NY_BIRTH: NatalChartInput = {
  birthDate: '2007-03-15',
  birthTime: '12:00',
  birthTimeKnown: true,
  latitude: 40.7128,
  longitude: -74.006,
  timezone: 'America/New_York',
};

describe('computeNatalChart', () => {
  it('assembles positions, houses and aspects for a known birth time', () => {
    const chart = computeNatalChart(NY_BIRTH);

    expect(chart.schemaVersion).toBe(NATAL_CHART_SCHEMA_VERSION);
    // 2007-03-15 12:00 EDT (-4, post the 2007 DST extension) => 16:00 UTC.
    expect(chart.utDateTime).toBe('2007-03-15T16:00:00.000Z');
    expect(chart.timezone).toBe('America/New_York');
    expect(chart.offsetMinutes).toBe(-240);
    expect(chart.birthTimeKnown).toBe(true);
    expect(chart.coordinates).toEqual({ latitude: 40.7128, longitude: -74.006 });

    // Sun through Pluto + both nodes = 12 bodies (Chiron off by default).
    expect(chart.positions.map((p) => p.body)).toEqual([
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
    expect(chart.houses).not.toBeNull();
    expect(chart.houses?.cusps).toHaveLength(12);
    expect(chart.aspects.length).toBeGreaterThan(0);
  });

  it('never emits interpretation/reading text (Pro data stays on the backend)', () => {
    const chart = computeNatalChart(NY_BIRTH);
    // AC #4 at the engine level: no valuable Pro data is computable on-device.
    expect(chart).not.toHaveProperty('interpretation');
    expect(chart).not.toHaveProperty('reading');
    expect(JSON.stringify(chart)).not.toMatch(/interpretation|reading/i);
  });

  it('produces a plain, JSON-serialisable result', () => {
    const chart = computeNatalChart(NY_BIRTH);
    expect(JSON.parse(JSON.stringify(chart))).toEqual(chart);
  });

  it('is deterministic — identical input yields a deep-equal chart', () => {
    expect(computeNatalChart(NY_BIRTH)).toEqual(computeNatalChart({ ...NY_BIRTH }));
  });

  describe('unknown birth time', () => {
    const noTime: NatalChartInput = { ...NY_BIRTH, birthTime: null, birthTimeKnown: false };

    it('omits houses but still computes positions (at local noon)', () => {
      const chart = computeNatalChart(noTime);
      expect(chart.birthTimeKnown).toBe(false);
      expect(chart.houses).toBeNull();
      expect(chart.positions.length).toBeGreaterThan(0);
      // Local noon in New York on this date (EDT, -4) => 16:00 UTC.
      expect(chart.utDateTime).toBe('2007-03-15T16:00:00.000Z');
    });
  });

  describe('options', () => {
    it('includes Chiron when requested', () => {
      const chart = computeNatalChart(NY_BIRTH, { includeChiron: true });
      expect(chart.positions.some((p) => p.body === 'chiron')).toBe(true);
    });

    it('honours a non-default house system', () => {
      const chart = computeNatalChart(NY_BIRTH, { houseSystem: 'whole-sign' });
      expect(chart.houses?.system).toBe('whole-sign');
    });
  });

  describe('validation', () => {
    it('rejects a malformed birth date', () => {
      expect(() => computeNatalChart({ ...NY_BIRTH, birthDate: '15/03/2007' })).toThrowError(
        CalcEngineError,
      );
    });

    it('rejects a malformed birth time when the time is known', () => {
      expect(() => computeNatalChart({ ...NY_BIRTH, birthTime: '12h00' })).toThrowError(
        CalcEngineError,
      );
    });

    it('rejects a missing birth time when birthTimeKnown is true', () => {
      try {
        computeNatalChart({ ...NY_BIRTH, birthTime: null });
        throw new Error('expected computeNatalChart to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(CalcEngineError);
        expect((error as CalcEngineError).code).toBe('invalid_input');
      }
    });

    it('rejects an unknown IANA timezone', () => {
      try {
        computeNatalChart({ ...NY_BIRTH, timezone: 'Mars/Olympus' });
        throw new Error('expected computeNatalChart to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(CalcEngineError);
        expect((error as CalcEngineError).code).toBe('invalid_timezone');
      }
    });
  });
});

/**
 * The heart of issue #20's acceptance criterion "no difference between an
 * offline-computed result and the backend's result": the backend resolves the
 * zone from coordinates with `geo-tz` (`resolveBirthInstant`) and then computes
 * the chart; the device reuses that stored zone with the pure engine. Feeding
 * the geo-tz-resolved zone into `computeNatalChart` must reproduce, to the byte,
 * the instant and every module's output the full pipeline would produce.
 */
describe('offline / backend equivalence (AC: same algorithm)', () => {
  const place = { latitude: NY_BIRTH.latitude, longitude: NY_BIRTH.longitude };
  const local = { year: 2007, month: 3, day: 15, hour: 12, minute: 0 };

  it('matches the full geo-tz pipeline instant and every downstream module', () => {
    const resolved = resolveBirthInstant(local, place);
    const chart = computeNatalChart({ ...NY_BIRTH, timezone: resolved.zone });

    // Same UT instant as the coordinate-driven backend resolution.
    expect(chart.utDateTime).toBe(resolved.utc);
    expect(chart.offsetMinutes).toBe(resolved.offsetMinutes);

    // Byte-identical to computing each module directly from that instant.
    const positions = computePlanetaryPositions(resolved.utc, {
      nodeModel: 'true',
      includeChiron: false,
    });
    expect(chart.positions).toEqual(positions);
    expect(chart.houses).toEqual(computeHouses(resolved.utc, place, { system: 'placidus' }));
    expect(chart.aspects).toEqual(
      computeAspects(
        positions.map((p) => ({ body: p.body, longitude: p.longitude, speed: p.speed })),
      ),
    );
  });
});
