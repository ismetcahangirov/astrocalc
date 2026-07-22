import { describe, expect, it } from 'vitest';
import { CalcEngineError } from './errors';
import {
  INTERPRETED_BODIES,
  SUPPORTED_LOCALES,
  angleSubjectKey,
  aspectSubjectKey,
  houseSubjectKey,
  listInterpretationSubjects,
  listMatrixSubjects,
  listNumerologySubjects,
  matrixSubjectKey,
  numerologySubjectKey,
  planetHouseSubjectKey,
  planetSignSubjectKey,
  type MatrixSubjectKind,
  type NumerologyNumberKind,
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

  it('builds a stable house key', () => {
    expect(houseSubjectKey(4)).toBe('house-4');
  });

  it('rejects an out-of-range house key', () => {
    expect(() => houseSubjectKey(0)).toThrowError(CalcEngineError);
    expect(() => houseSubjectKey(13)).toThrowError(CalcEngineError);
    expect(() => houseSubjectKey(1.5)).toThrowError(CalcEngineError);
  });

  it('builds a stable angle key', () => {
    expect(angleSubjectKey('ascendant', 'Virgo')).toBe('ascendant-Virgo');
    expect(angleSubjectKey('midheaven', 'Gemini')).toBe('midheaven-Gemini');
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

  it('covers all 12 houses in the house category', () => {
    const houses = subjects.filter((s) => s.category === 'house');
    expect(houses).toHaveLength(12);
    expect(new Set(houses.map((s) => s.subjectKey))).toEqual(
      new Set(Array.from({ length: 12 }, (_, i) => `house-${i + 1}`)),
    );
  });

  it('covers both angles across all 12 signs in the angle category', () => {
    const angles = subjects.filter((s) => s.category === 'angle');
    expect(angles).toHaveLength(24);
    expect(angles.some((s) => s.subjectKey === 'ascendant-Aries')).toBe(true);
    expect(angles.some((s) => s.subjectKey === 'midheaven-Pisces')).toBe(true);
  });
});

describe('numerology subject keys', () => {
  it('builds a stable key per number kind and value', () => {
    expect(numerologySubjectKey('life-path', 7)).toBe('life-path-7');
    expect(numerologySubjectKey('personal-year', 1)).toBe('personal-year-1');
    expect(numerologySubjectKey('challenge-1', 0)).toBe('challenge-1-0');
  });

  it('rejects a value outside the kind range', () => {
    expect(() => numerologySubjectKey('life-path', 10)).toThrow(CalcEngineError);
    expect(() => numerologySubjectKey('birthday', 32)).toThrow(CalcEngineError);
    expect(() => numerologySubjectKey('challenge-1', 9)).toThrow(CalcEngineError);
  });

  it('rejects an unrecognized kind', () => {
    // Cast through unknown: the point is to exercise the runtime guard that
    // protects against a JS caller or an `as` at a call site.
    const bad = (kind: string) => numerologySubjectKey(kind as NumerologyNumberKind, 5);
    expect(() => bad('lifepath')).toThrow(CalcEngineError);
    expect(() => bad('')).toThrow(CalcEngineError);
  });

  it('rejects non-integer and negative values', () => {
    expect(() => numerologySubjectKey('life-path', 5.5)).toThrow(CalcEngineError);
    expect(() => numerologySubjectKey('life-path', -1)).toThrow(CalcEngineError);
    expect(() => numerologySubjectKey('life-path', Number.NaN)).toThrow(CalcEngineError);
  });
});

describe('listNumerologySubjects', () => {
  const subjects = listNumerologySubjects();

  it('enumerates 185 subjects, all in the numerology category', () => {
    // life-path (11: 1-9,11,22 — a 3-component sum of reduced 1-9 digits
    // maxes at 27, so 33 is unreachable) + expression/soul-urge/personality
    // (12 each — name-derived, unbounded, all masters reachable) + birthday
    // (31) + maturity (12 — sums life path ≤22 with expression ≤33, so 33 is
    // reachable) + personal-year/personal-month (9 each) + pinnacles 1, 2, 4
    // (10 each: 1-9,11 — a 2-component sum of reduced digits maxes at 18, so
    // only 11 is reachable) + pinnacle 3 (11: 1-9,11,22 — sums two pinnacles
    // each ≤11, maxing at 22) + challenges 1-4 (9 each)
    // = 11 + 12*3 + 31 + 12 + 9*2 + 10*3 + 11 + 9*4
    // = 11 + 36 + 31 + 12 + 18 + 30 + 11 + 36 = 185
    expect(subjects).toHaveLength(185);
    expect(subjects.every((s) => s.category === 'numerology')).toBe(true);
  });

  it('has no duplicate keys', () => {
    expect(new Set(subjects.map((s) => s.subjectKey)).size).toBe(subjects.length);
  });

  it('is folded into listInterpretationSubjects as of #82, on top of the 465 astrology subjects', () => {
    const all = listInterpretationSubjects();
    // 618 astrology (12 bodies incl. nodes) + 12 house + 24 angle + 185
    // numerology + 682 matrix = 1521.
    expect(all).toHaveLength(1521);
    expect(all.filter((s) => s.category === 'numerology')).toHaveLength(185);
    expect(all.filter((s) => s.category === 'matrix')).toHaveLength(682);
    // Every numerology subject listNumerologySubjects() enumerates is present.
    const foldedKeys = new Set(
      all.filter((s) => s.category === 'numerology').map((s) => s.subjectKey),
    );
    expect(subjects.every((s) => foldedKeys.has(s.subjectKey))).toBe(true);
  });

  it('excludes master numbers the formulas cannot reach', () => {
    const keys = new Set(listNumerologySubjects().map((s) => s.subjectKey));
    // Life Path sums three reduced components: max 27, so 33 is impossible.
    expect(keys.has('life-path-22')).toBe(true);
    expect(keys.has('life-path-33')).toBe(false);
    // Pinnacles 1, 2 and 4 sum two reduced components: max 18.
    for (const position of [1, 2, 4]) {
      expect(keys.has(`pinnacle-${position}-11`)).toBe(true);
      expect(keys.has(`pinnacle-${position}-22`)).toBe(false);
    }
    // Pinnacle 3 sums two pinnacles, so 22 is reachable but 33 is not.
    expect(keys.has('pinnacle-3-22')).toBe(true);
    expect(keys.has('pinnacle-3-33')).toBe(false);
    // Name-derived numbers are unbounded, so all three masters stay.
    expect(keys.has('expression-33')).toBe(true);
    expect(keys.has('maturity-33')).toBe(true);
  });
});

describe('listMatrixSubjects', () => {
  const subjects = listMatrixSubjects();

  it('enumerates 682 subjects: 22 base arcana + 30 positions x 22 arcana', () => {
    // 'arcana' (base, #80) + 30 named positions (#81), each across the 22 Major
    // Arcana: 31 kinds x 22 = 682.
    expect(subjects).toHaveLength(31 * 22);
    expect(subjects).toHaveLength(682);
    expect(subjects.every((s) => s.category === 'matrix')).toBe(true);
  });

  it('has no duplicate keys', () => {
    expect(new Set(subjects.map((s) => s.subjectKey)).size).toBe(subjects.length);
  });

  it('keys the base meanings and the position-specific meanings distinctly', () => {
    const keys = new Set(subjects.map((s) => s.subjectKey));
    expect(keys.has('arcana-1')).toBe(true); // #80 base
    expect(keys.has('arcana-22')).toBe(true);
    expect(keys.has('comfort-zone-13')).toBe(true); // #81 position-specific
    expect(keys.has('paternal-line-7')).toBe(true);
    expect(keys.has('chakra-muladhara-22')).toBe(true);
    // Every kind spans exactly the 22 arcana, 1..22.
    for (const arcana of [1, 22]) expect(keys.has(`day-${arcana}`)).toBe(true);
    expect(keys.has('day-0')).toBe(false);
    expect(keys.has('day-23')).toBe(false);
  });

  it('is folded into listInterpretationSubjects', () => {
    const folded = new Set(
      listInterpretationSubjects()
        .filter((s) => s.category === 'matrix')
        .map((s) => s.subjectKey),
    );
    expect(subjects.every((s) => folded.has(s.subjectKey))).toBe(true);
    expect(folded.size).toBe(682);
  });
});

describe('matrixSubjectKey', () => {
  it('builds `${kind}-${arcana}` for a valid arcana', () => {
    expect(matrixSubjectKey('arcana', 1)).toBe('arcana-1');
    expect(matrixSubjectKey('comfort-zone', 22)).toBe('comfort-zone-22');
    expect(matrixSubjectKey('chakra-anahata', 6)).toBe('chakra-anahata-6');
  });

  it('rejects an arcana outside 1..22', () => {
    const kind: MatrixSubjectKind = 'day';
    expect(() => matrixSubjectKey(kind, 0)).toThrow(CalcEngineError);
    expect(() => matrixSubjectKey(kind, 23)).toThrow(CalcEngineError);
    expect(() => matrixSubjectKey(kind, 1.5)).toThrow(CalcEngineError);
  });
});
