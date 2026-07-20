import { describe, expect, it } from 'vitest';
import { REFERENCE_NUMEROLOGY_CASES } from '../__fixtures__/reference-numerology';
import { computeNumerologyProfile } from './index';

/**
 * Cross-validation of the whole assembled profile (#63).
 *
 * Every other numerology suite checks a function against its own formula. This
 * one checks `computeNumerologyProfile()` end to end against cases derived by
 * hand from the documented rules, independently of the code — see
 * `__fixtures__/reference-numerology.ts` for each case's full working, and its
 * header for why a failure here is a bug rather than a fixture to refresh.
 */
describe.each(REFERENCE_NUMEROLOGY_CASES)('reference numerology: $label', (fixture) => {
  const profile = computeNumerologyProfile(fixture.input);

  it('matches the hand-computed core numbers', () => {
    expect(profile.lifePath.value).toBe(fixture.expected.lifePath);
    expect(profile.lifePath.isMaster).toBe(fixture.expected.lifePathIsMaster);
    expect(profile.lifePath.karmicDebt).toBe(fixture.expected.lifePathKarmicDebt);
    expect(profile.expression.value).toBe(fixture.expected.expression);
    expect(profile.soulUrge.value).toBe(fixture.expected.soulUrge);
    expect(profile.personality.value).toBe(fixture.expected.personality);
  });

  it('matches the hand-computed cycle numbers', () => {
    expect(profile.birthday).toBe(fixture.expected.birthday);
    expect(profile.maturity.value).toBe(fixture.expected.maturity);
    expect(profile.personalYear).toBe(fixture.expected.personalYear);
    expect(profile.personalMonth).toBe(fixture.expected.personalMonth);
  });

  it('matches the hand-computed pinnacles and challenges', () => {
    expect(profile.pinnacles.map((pinnacle) => pinnacle.number.value)).toEqual(
      fixture.expected.pinnacleValues,
    );
    expect(profile.challenges.map((challenge) => challenge.value)).toEqual(
      fixture.expected.challengeValues,
    );
  });
});
