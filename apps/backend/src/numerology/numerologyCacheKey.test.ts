import { describe, expect, it } from 'vitest';
import { hashNumerologyCacheKey, type NumerologyCacheKeyInput } from './numerologyCacheKey';

function baseInput(overrides: Partial<NumerologyCacheKeyInput> = {}): NumerologyCacheKeyInput {
  return {
    fullName: 'Ada Lovelace',
    birthDate: '1990-05-12',
    referenceMonth: '2026-07',
    ...overrides,
  };
}

describe('hashNumerologyCacheKey', () => {
  it('is deterministic for identical input', () => {
    expect(hashNumerologyCacheKey(baseInput())).toBe(hashNumerologyCacheKey(baseInput()));
  });

  it('is stable regardless of property insertion order', () => {
    const a = hashNumerologyCacheKey({
      fullName: 'Ada Lovelace',
      birthDate: '1990-05-12',
      referenceMonth: '2026-07',
    });
    const b = hashNumerologyCacheKey({
      referenceMonth: '2026-07',
      birthDate: '1990-05-12',
      fullName: 'Ada Lovelace',
    });
    expect(a).toBe(b);
  });

  it('changes when fullName changes', () => {
    const a = hashNumerologyCacheKey(baseInput({ fullName: 'Ada Lovelace' }));
    const b = hashNumerologyCacheKey(baseInput({ fullName: 'Ada Byron Lovelace' }));
    expect(a).not.toBe(b);
  });

  it('changes when birthDate changes', () => {
    const a = hashNumerologyCacheKey(baseInput({ birthDate: '1990-05-12' }));
    const b = hashNumerologyCacheKey(baseInput({ birthDate: '1990-05-13' }));
    expect(a).not.toBe(b);
  });

  it('changes when referenceMonth changes', () => {
    const a = hashNumerologyCacheKey(baseInput({ referenceMonth: '2026-07' }));
    const b = hashNumerologyCacheKey(baseInput({ referenceMonth: '2026-08' }));
    expect(a).not.toBe(b);
  });

  it('is identical for two different days inside the same month, and different on the 1st of the next', () => {
    // The whole point of month-scoping, exercised through the same
    // `referenceDate -> referenceMonth` narrowing the service performs: every
    // request within a calendar month shares one entry, and that entry stops
    // being reachable the moment the month rolls over.
    const forDate = (referenceDate: string) =>
      hashNumerologyCacheKey(baseInput({ referenceMonth: referenceDate.slice(0, 7) }));

    const earlyJuly = forDate('2026-07-01');
    const lateJuly = forDate('2026-07-31');
    const firstOfAugust = forDate('2026-08-01');

    expect(lateJuly).toBe(earlyJuly);
    expect(firstOfAugust).not.toBe(earlyJuly);
  });

  it('produces a hex-encoded sha256 digest', () => {
    expect(hashNumerologyCacheKey(baseInput())).toMatch(/^[0-9a-f]{64}$/);
  });
});
