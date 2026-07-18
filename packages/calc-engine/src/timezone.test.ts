import { describe, expect, it } from 'vitest';
import { CalcEngineError } from './errors';
import type { GeoCoordinates } from './types';
import {
  findTimeZones,
  localTimeToUtc,
  resolveBirthInstant,
  type LocalDateTime,
} from './timezone';

/** Well-known places, as WGS84 decimal-degree coordinates. */
const PLACES = {
  newYork: { latitude: 40.7128, longitude: -74.006 },
  tokyo: { latitude: 35.6762, longitude: 139.6503 },
  moscow: { latitude: 55.7558, longitude: 37.6173 },
  paris: { latitude: 48.8566, longitude: 2.3522 },
  sydney: { latitude: -33.8688, longitude: 151.2093 },
  // Indianapolis: kept its own DST history distinct from America/New_York.
  indianapolis: { latitude: 39.7684, longitude: -86.1581 },
  // A point in the mid-Pacific, far from any landmass.
  pacificOcean: { latitude: 0, longitude: -160 },
} satisfies Record<string, GeoCoordinates>;

describe('findTimeZones', () => {
  it('resolves New York coordinates to America/New_York', () => {
    expect(findTimeZones(PLACES.newYork)).toEqual(['America/New_York']);
  });

  it('resolves Tokyo coordinates to Asia/Tokyo', () => {
    expect(findTimeZones(PLACES.tokyo)).toEqual(['Asia/Tokyo']);
  });

  it('resolves an Indiana point to its own historical zone, not New York', () => {
    // Pre-1970 divergence: Indiana zones only survive with the "all" dataset.
    expect(findTimeZones(PLACES.indianapolis)).toEqual([
      'America/Indiana/Indianapolis',
    ]);
  });

  it('returns a nautical Etc/GMT zone for a point in the open ocean', () => {
    const zones = findTimeZones(PLACES.pacificOcean);
    expect(zones.length).toBeGreaterThan(0);
    expect(zones[0]).toMatch(/^Etc\/GMT/);
  });

  it('throws invalid_input when latitude is out of range', () => {
    expect(() => findTimeZones({ latitude: 91, longitude: 0 })).toThrowError(
      CalcEngineError,
    );
    try {
      findTimeZones({ latitude: 0, longitude: 200 });
    } catch (error) {
      expect(error).toBeInstanceOf(CalcEngineError);
      expect((error as CalcEngineError).code).toBe('invalid_input');
    }
  });

  it('throws invalid_input when a coordinate is not a finite number', () => {
    expect(() =>
      findTimeZones({ latitude: Number.NaN, longitude: 0 }),
    ).toThrowError(CalcEngineError);
  });
});

describe('localTimeToUtc', () => {
  it('throws invalid_timezone for an unknown IANA zone', () => {
    try {
      localTimeToUtc({ year: 2000, month: 1, day: 1, hour: 12 }, 'Mars/Olympus');
      throw new Error('expected localTimeToUtc to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CalcEngineError);
      expect((error as CalcEngineError).code).toBe('invalid_timezone');
    }
  });

  it('throws invalid_input for an impossible calendar date', () => {
    try {
      localTimeToUtc(
        { year: 2000, month: 13, day: 1, hour: 12 },
        'America/New_York',
      );
      throw new Error('expected localTimeToUtc to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CalcEngineError);
      expect((error as CalcEngineError).code).toBe('invalid_input');
    }
  });

  it('throws invalid_input when a component is not a finite number', () => {
    expect(() =>
      localTimeToUtc(
        { year: 2000, month: 1, day: 1, hour: Number.NaN },
        'America/New_York',
      ),
    ).toThrowError(CalcEngineError);
  });

  it('defaults an omitted hour/minute/second to midnight', () => {
    const result = localTimeToUtc(
      { year: 2020, month: 6, day: 1 },
      'America/New_York',
    );
    // 2020-06-01 00:00 EDT (-4) => 04:00 UTC.
    expect(result.utc).toBe('2020-06-01T04:00:00.000Z');
  });
});

/**
 * The heart of issue #16: local birth time + place must convert to UT using the
 * IANA rules that were actually in force on that date — never a static offset.
 * Each scenario below is a real, independently-verifiable timezone-history fact.
 */
describe('historical & geographic conversion scenarios', () => {
  it('applies the 2007 US DST extension (New York, spring)', () => {
    // Under the pre-2007 rule, DST began the first Sunday of April, so
    // 15 March 2005 was still EST (-5). The 2005 Energy Policy Act moved the
    // start to the second Sunday of March, so 15 March 2007 was EDT (-4).
    const noon: Omit<LocalDateTime, 'year'> = {
      month: 3,
      day: 15,
      hour: 12,
    };
    const before = localTimeToUtc({ year: 2005, ...noon }, 'America/New_York');
    const after = localTimeToUtc({ year: 2007, ...noon }, 'America/New_York');

    expect(before.offsetMinutes).toBe(-300); // EST
    expect(before.utc).toBe('2005-03-15T17:00:00.000Z');
    expect(after.offsetMinutes).toBe(-240); // EDT
    expect(after.utc).toBe('2007-03-15T16:00:00.000Z');
    // Same wall-clock time, one hour apart in UT — proof of the rule change.
    expect(after.offsetMinutes - before.offsetMinutes).toBe(60);
  });

  it('applies pre-1900 Local Mean Time in Paris (before 1891)', () => {
    // Paris kept Local Mean Time (+00:09:21) until 1891; luxon carries the
    // sub-minute offset, so midnight local is 23:50:39 UT the previous day.
    const result = localTimeToUtc(
      { year: 1850, month: 1, day: 1, hour: 0 },
      'Europe/Paris',
    );
    expect(result.utc).toBe('1849-12-31T23:50:39.000Z');
    // A genuine LMT offset — not a standardised whole-hour zone.
    expect(result.offsetMinutes).toBeGreaterThan(0);
    expect(result.offsetMinutes).toBeLessThan(15);
    expect(Number.isInteger(result.offsetMinutes)).toBe(false);
  });

  it('tracks Moscow standard-time changes that are not DST (2011 & 2014)', () => {
    // Moscow winter offset was +3, then +4 after Russia abolished winter time
    // in 2011, then back to +3 after the 2014 reversal — none of it DST.
    const winter2010 = localTimeToUtc(
      { year: 2010, month: 1, day: 15, hour: 12 },
      'Europe/Moscow',
    );
    const winter2012 = localTimeToUtc(
      { year: 2012, month: 1, day: 15, hour: 12 },
      'Europe/Moscow',
    );
    const winter2015 = localTimeToUtc(
      { year: 2015, month: 1, day: 15, hour: 12 },
      'Europe/Moscow',
    );

    expect(winter2010.offsetMinutes).toBe(180);
    expect(winter2012.offsetMinutes).toBe(240);
    expect(winter2015.offsetMinutes).toBe(180);
  });

  it('inverts DST in the southern hemisphere (Sydney)', () => {
    // January is summer (AEDT, +11) and July is winter (AEST, +10) — the
    // reverse of the northern hemisphere.
    const january = localTimeToUtc(
      { year: 1990, month: 1, day: 15, hour: 12 },
      'Australia/Sydney',
    );
    const july = localTimeToUtc(
      { year: 1990, month: 7, day: 15, hour: 12 },
      'Australia/Sydney',
    );

    expect(january.offsetMinutes).toBe(660); // +11, summer DST
    expect(january.isDST).toBe(true);
    expect(july.offsetMinutes).toBe(600); // +10, standard winter time
    expect(july.isDST).toBe(false);
  });

  it("tracks Indiana's late adoption of DST (Indianapolis, 2006)", () => {
    // Indiana largely did not observe DST until 2006, so a June date in 2005
    // stayed on EST (-5) while the same date in 2007 was EDT (-4).
    const summer2005 = localTimeToUtc(
      { year: 2005, month: 6, day: 15, hour: 12 },
      'America/Indiana/Indianapolis',
    );
    const summer2007 = localTimeToUtc(
      { year: 2007, month: 6, day: 15, hour: 12 },
      'America/Indiana/Indianapolis',
    );

    expect(summer2005.offsetMinutes).toBe(-300); // EST, no DST
    expect(summer2007.offsetMinutes).toBe(-240); // EDT, DST now observed
  });
});

describe('resolveBirthInstant', () => {
  it('resolves coordinates and local time to a UT instant end-to-end', () => {
    const result = resolveBirthInstant(
      { year: 2007, month: 3, day: 15, hour: 12 },
      PLACES.newYork,
    );
    expect(result.zone).toBe('America/New_York');
    expect(result.candidateZones).toEqual(['America/New_York']);
    expect(result.utc).toBe('2007-03-15T16:00:00.000Z');
    expect(result.offsetMinutes).toBe(-240);
  });

  it('produces a plain, JSON-serialisable result', () => {
    const result = resolveBirthInstant(
      { year: 1990, month: 5, day: 15, hour: 13, minute: 45 },
      PLACES.tokyo,
    );
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(result.zone).toBe('Asia/Tokyo');
    expect(result.utc).toBe('1990-05-15T04:45:00.000Z'); // JST is +9
  });

  it('feeds an ISO UT string that a UT parser round-trips to the same instant', () => {
    const result = resolveBirthInstant(
      { year: 2007, month: 3, day: 15, hour: 12 },
      PLACES.newYork,
    );
    // The downstream calc modules consume result.utc as an ISO 8601 UT string.
    expect(new Date(result.utc).toISOString()).toBe(result.utc);
  });
});

describe('DST-boundary local times do not crash', () => {
  it('resolves an ambiguous "fall back" local time to one of the two offsets', () => {
    // 2007-11-04 01:30 in New York occurs twice (EDT then EST). We must still
    // return a valid instant on one side of the fold rather than throwing.
    const result = localTimeToUtc(
      { year: 2007, month: 11, day: 4, hour: 1, minute: 30 },
      'America/New_York',
    );
    expect(result.utc.endsWith('Z')).toBe(true);
    expect([-240, -300]).toContain(result.offsetMinutes);
  });

  it('resolves a non-existent "spring forward" local time without throwing', () => {
    // 2007-03-11 02:30 in New York never happened (the clocks jumped
    // 02:00 -> 03:00). luxon shifts it forward; we just must not crash.
    const result = localTimeToUtc(
      { year: 2007, month: 3, day: 11, hour: 2, minute: 30 },
      'America/New_York',
    );
    expect(result.utc.endsWith('Z')).toBe(true);
  });
});
