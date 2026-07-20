import { describe, expect, it } from 'vitest';
import { CalcEngineError } from '../errors';
import { expressionNumber, personalityNumber, soulUrgeNumber } from './coreNumbers';
import { computeNumerologyProfile, NUMEROLOGY_SCHEMA_VERSION } from './index';

const INPUT = {
  fullName: 'John Smith',
  birthDate: '1990-03-07',
  referenceDate: '2026-07-20',
};

describe('computeNumerologyProfile', () => {
  const profile = computeNumerologyProfile(INPUT);

  it('stamps the schema version', () => {
    expect(profile.schemaVersion).toBe(NUMEROLOGY_SCHEMA_VERSION);
  });

  it('composes every number the epic promises', () => {
    expect(profile.lifePath.value).toBe(11);
    expect(profile.expression.value).toBe(8);
    expect(profile.soulUrge.value).toBe(6);
    expect(profile.personality.value).toBe(11);
    expect(profile.birthday).toBe(7);
    expect(profile.maturity.value).toBe(1);
    expect(profile.personalYear).toBe(2);
    expect(profile.personalMonth).toBe(9);
    expect(profile.pinnacles).toHaveLength(4);
    expect(profile.challenges).toHaveLength(4);
  });

  it('marks which pinnacle and challenge period the person is in now', () => {
    // Born 1990-03-07, reference 2026-07-20 -> age 36 -> second period.
    expect(profile.currentAge).toBe(36);
    expect(profile.currentPinnacle).toBe(2);
    expect(profile.currentChallenge).toBe(2);
  });

  it('handles a birthday that has not yet occurred in the reference year', () => {
    const before = computeNumerologyProfile({ ...INPUT, referenceDate: '2026-01-05' });
    expect(before.currentAge).toBe(35);
  });

  it('treats the birthday itself as the day the age ticks over', () => {
    const dayBefore = computeNumerologyProfile({ ...INPUT, referenceDate: '2026-03-06' });
    const onTheDay = computeNumerologyProfile({ ...INPUT, referenceDate: '2026-03-07' });
    expect(dayBefore.currentAge).toBe(35);
    expect(onTheDay.currentAge).toBe(36);
  });

  it('is deterministic for the same input', () => {
    expect(computeNumerologyProfile(INPUT)).toEqual(profile);
  });

  it('is JSON-serialisable with no loss', () => {
    expect(JSON.parse(JSON.stringify(profile))).toEqual(profile);
  });

  it('rejects invalid input with CalcEngineError', () => {
    expect(() => computeNumerologyProfile({ ...INPUT, birthDate: 'nope' })).toThrow(
      CalcEngineError,
    );
    expect(() => computeNumerologyProfile({ ...INPUT, fullName: '' })).toThrow(CalcEngineError);
    expect(() => computeNumerologyProfile({ ...INPUT, referenceDate: '1980-01-01' })).toThrow(
      CalcEngineError,
    );
  });

  it('accepts a reference date equal to the birth date (age 0)', () => {
    const newborn = computeNumerologyProfile({ ...INPUT, referenceDate: '1990-03-07' });
    expect(newborn.currentAge).toBe(0);
    expect(newborn.currentPinnacle).toBe(1);
  });
});

/**
 * The assembly computes the three name-derived numbers from a single
 * `nameSums()` pass rather than by calling `expressionNumber()` /
 * `soulUrgeNumber()` / `personalityNumber()`. That optimisation is only safe
 * while the two paths agree, so this suite pins them together across the
 * alphabets the romanizer supports — Latin, Azerbaijani (diacritic folding) and
 * Cyrillic (multi-letter expansion). If the one-pass path ever drifts, this
 * fails rather than the drift shipping silently.
 */
describe('computeNumerologyProfile name numbers vs the individual functions', () => {
  const names = ['John Smith', 'Çingiz Əliyev', 'Иван Иванов'];

  for (const fullName of names) {
    it(`matches expressionNumber/soulUrgeNumber/personalityNumber for ${fullName}`, () => {
      const composed = computeNumerologyProfile({ ...INPUT, fullName });

      expect(composed.expression).toEqual(expressionNumber(fullName));
      expect(composed.soulUrge).toEqual(soulUrgeNumber(fullName));
      expect(composed.personality).toEqual(personalityNumber(fullName));
    });
  }
});
