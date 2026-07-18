import { describe, expect, it } from 'vitest';
import { CalcEngineError } from './errors';
import {
  INTERPRETED_BODIES,
  SUPPORTED_LOCALES,
  aspectSubjectKey,
  listInterpretationSubjects,
  planetHouseSubjectKey,
  planetSignSubjectKey,
} from './interpretations';

describe('SUPPORTED_LOCALES', () => {
  it('is exactly the four AstroCalc UI languages', () => {
    expect([...SUPPORTED_LOCALES].sort()).toEqual(['az', 'en', 'ru', 'tr']);
  });
});

describe('subject key builders', () => {
  it('builds a stable planet-sign key', () => {
    expect(planetSignSubjectKey('sun', 'Aries')).toBe('sun-Aries');
  });

  it('builds a stable planet-house key', () => {
    expect(planetHouseSubjectKey('moon', 4)).toBe('moon-4');
  });

  it('rejects an out-of-range house', () => {
    expect(() => planetHouseSubjectKey('moon', 13)).toThrowError(CalcEngineError);
    expect(() => planetHouseSubjectKey('moon', 0)).toThrowError(CalcEngineError);
  });

  it('canonicalizes aspect body order regardless of call order', () => {
    expect(aspectSubjectKey('conjunction', 'sun', 'moon')).toBe(
      aspectSubjectKey('conjunction', 'moon', 'sun'),
    );
    expect(aspectSubjectKey('trine', 'venus', 'mars')).toBe('trine-mars-venus');
  });
});

describe('listInterpretationSubjects', () => {
  const subjects = listInterpretationSubjects();

  it('covers every planet-sign combination for the ten interpreted planets', () => {
    const planetSign = subjects.filter((s) => s.category === 'planet-sign');
    expect(planetSign).toHaveLength(INTERPRETED_BODIES.length * 12);
  });

  it('covers every planet-house combination for the ten interpreted planets', () => {
    const planetHouse = subjects.filter((s) => s.category === 'planet-house');
    expect(planetHouse).toHaveLength(INTERPRETED_BODIES.length * 12);
  });

  it('covers every major aspect across every unordered pair of interpreted planets', () => {
    const aspects = subjects.filter((s) => s.category === 'aspect');
    const pairs = (INTERPRETED_BODIES.length * (INTERPRETED_BODIES.length - 1)) / 2;
    expect(aspects).toHaveLength(pairs * 5);
  });

  it('has no duplicate (category, subjectKey) pairs', () => {
    const keys = subjects.map((s) => `${s.category}:${s.subjectKey}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
