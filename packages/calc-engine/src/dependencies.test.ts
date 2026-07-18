/**
 * These tests don't exercise any calc-engine logic — actual astronomy,
 * numerology, and timezone calculations land in later sub-issues. They only
 * confirm the three third-party dependencies this package is built on
 * (astronomy-engine, luxon, geo-tz — see the repo README's tech stack table)
 * are correctly installed, importable, and runnable under the package's own
 * TypeScript + Vitest configuration.
 */
import * as Astronomy from 'astronomy-engine';
import { find } from 'geo-tz';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

describe('third-party dependency wiring', () => {
  it('astronomy-engine builds an AstroTime from a JS Date', () => {
    const time = Astronomy.MakeTime(new Date(Date.UTC(2000, 0, 1)));

    expect(time.ut).toBeCloseTo(-0.5, 5);
  });

  it('luxon parses and formats a UTC instant', () => {
    const dt = DateTime.utc(2000, 1, 1);

    expect(dt.toISODate()).toBe('2000-01-01');
  });

  it('geo-tz resolves IANA timezones from coordinates', () => {
    const zones = find(40.4093, 49.8671); // Baku, Azerbaijan

    expect(zones).toContain('Asia/Baku');
  });
});
