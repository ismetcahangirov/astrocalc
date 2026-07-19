import { describe, expect, it } from 'vitest';
import { deriveBirthTimezone } from './birthTimezone';

describe('deriveBirthTimezone (real geo-tz lookup)', () => {
  it('derives Asia/Baku from Baku coordinates', () => {
    expect(deriveBirthTimezone(40.4093, 49.8671)).toBe('Asia/Baku');
  });

  it('derives America/New_York from New York coordinates', () => {
    expect(deriveBirthTimezone(40.7128, -74.006)).toBe('America/New_York');
  });

  it('returns null when either coordinate is missing', () => {
    expect(deriveBirthTimezone(null, 49.8671)).toBeNull();
    expect(deriveBirthTimezone(40.4093, null)).toBeNull();
    expect(deriveBirthTimezone(null, null)).toBeNull();
    expect(deriveBirthTimezone(undefined, undefined)).toBeNull();
  });
});
