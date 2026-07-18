import { describe, expect, it } from 'vitest';
import { hashChartCacheKey, type ChartCacheKeyInput } from './chartCacheKey';

function baseInput(overrides: Partial<ChartCacheKeyInput> = {}): ChartCacheKeyInput {
  return {
    birthDate: '1990-05-12',
    birthTime: '10:30',
    lat: 40.4093,
    lng: 49.8671,
    houseSystem: 'placidus',
    orbConfig: {},
    ...overrides,
  };
}

describe('hashChartCacheKey', () => {
  it('is deterministic for identical input', () => {
    expect(hashChartCacheKey(baseInput())).toBe(hashChartCacheKey(baseInput()));
  });

  it('is stable regardless of orbConfig key insertion order', () => {
    const a = hashChartCacheKey(baseInput({ orbConfig: { conjunction: 8, square: 7 } }));
    const b = hashChartCacheKey(baseInput({ orbConfig: { square: 7, conjunction: 8 } }));
    expect(a).toBe(b);
  });

  it('changes when birthDate changes', () => {
    const a = hashChartCacheKey(baseInput({ birthDate: '1990-05-12' }));
    const b = hashChartCacheKey(baseInput({ birthDate: '1990-05-13' }));
    expect(a).not.toBe(b);
  });

  it('changes when birthTime changes, including to/from unknown (null)', () => {
    const known = hashChartCacheKey(baseInput({ birthTime: '10:30' }));
    const otherKnown = hashChartCacheKey(baseInput({ birthTime: '10:31' }));
    const unknown = hashChartCacheKey(baseInput({ birthTime: null }));
    expect(known).not.toBe(otherKnown);
    expect(known).not.toBe(unknown);
  });

  it('changes when lat/lng changes', () => {
    const a = hashChartCacheKey(baseInput({ lat: 40.4093 }));
    const b = hashChartCacheKey(baseInput({ lat: 41.0 }));
    expect(a).not.toBe(b);

    const c = hashChartCacheKey(baseInput({ lng: 49.8671 }));
    const d = hashChartCacheKey(baseInput({ lng: 50.0 }));
    expect(c).not.toBe(d);
  });

  it('changes when houseSystem changes', () => {
    const a = hashChartCacheKey(baseInput({ houseSystem: 'placidus' }));
    const b = hashChartCacheKey(baseInput({ houseSystem: 'whole-sign' }));
    expect(a).not.toBe(b);
  });

  it('changes when orbConfig changes', () => {
    const a = hashChartCacheKey(baseInput({ orbConfig: {} }));
    const b = hashChartCacheKey(baseInput({ orbConfig: { conjunction: 8 } }));
    expect(a).not.toBe(b);
  });

  it('produces a hex-encoded sha256 digest', () => {
    expect(hashChartCacheKey(baseInput())).toMatch(/^[0-9a-f]{64}$/);
  });
});
