import type { NumerologyInput } from '../numerology';

/**
 * Hand-computed reference numerology profiles for issue #63.
 *
 * Numerology has no external ephemeris to check against — unlike the natal
 * charts in `reference-charts.ts`, there is no astro-seek to query. The
 * independent source here is arithmetic done **by hand** from the documented
 * rules (Pythagorean letter values, master-number preservation, karmic-debt
 * recording, the `36 − Life Path` Pinnacle anchor), with every step written
 * out in each case's `working` field.
 *
 * That `working` text is the point of this fixture. The unit suites verify
 * each function against its own formula, which cannot catch a formula that is
 * wrong in the same way in both places; these cases were derived without
 * reference to the implementation, so they can. A future reader should be able
 * to re-derive any expected value from `working` alone rather than trust it.
 *
 * **If a case disagrees with the implementation, that is a bug report, not a
 * stale fixture.** Do not edit the expectations until the hand computation has
 * been re-done and found genuinely wrong — and if it was wrong, correct the
 * `working` narrative too, not just the number, or the next reader inherits a
 * fixture whose stated reasoning no longer produces its stated answer.
 */

export interface ReferenceNumerologyExpectation {
  /** Reduced Life Path value. */
  lifePath: number;
  lifePathIsMaster: boolean;
  /** The karmic-debt number passed through, or `null`. */
  lifePathKarmicDebt: number | null;
  expression: number;
  soulUrge: number;
  personality: number;
  /** Day of the month, unreduced. */
  birthday: number;
  maturity: number;
  /** Cycle position, 1–9. */
  personalYear: number;
  /** Cycle position, 1–9. */
  personalMonth: number;
  /** The four Pinnacle values in chronological order. */
  pinnacleValues: number[];
  /** The four Challenge values in chronological order. */
  challengeValues: number[];
}

export interface ReferenceNumerologyCase {
  label: string;
  input: NumerologyInput;
  /** The full hand derivation, so the expectation can be re-checked, not trusted. */
  working: string;
  expected: ReferenceNumerologyExpectation;
}

export const REFERENCE_NUMEROLOGY_CASES: ReferenceNumerologyCase[] = [
  {
    label: 'master Life Path, Latin name',
    input: {
      fullName: 'John Smith',
      birthDate: '1990-03-07',
      referenceDate: '2026-07-20',
    },
    working: [
      'Life Path: month 3, day 7, year 1990 -> 19 -> 10 -> 1; 3+7+1 = 11 (master), no debt.',
      'Expression: JOHN = 1+6+8+5 = 20; SMITH = 1+4+9+2+8 = 24; 44 -> 8.',
      'Soul Urge: vowels O,I = 6+9 = 15 -> 6.',
      'Personality: consonants J,H,N,S,M,T,H = 1+8+5+1+4+2+8 = 29 -> 11 (master).',
      'Birthday: 7. Maturity: 11+8 = 19 -> debt 19 -> 10 -> 1.',
      'Personal Year: 3 + 7 + (2026 -> 10 -> 1) = 11 -> 2. Personal Month: 2 + 7 = 9.',
      'Pinnacles: 3+7=10->1; 7+1=8; 1+8=9; 3+1=4.',
      'Challenges: |3-7|=4; |7-1|=6; |4-6|=2; |3-1|=2.',
    ].join('\n'),
    expected: {
      lifePath: 11,
      lifePathIsMaster: true,
      lifePathKarmicDebt: null,
      expression: 8,
      soulUrge: 6,
      personality: 11,
      birthday: 7,
      maturity: 1,
      personalYear: 2,
      personalMonth: 9,
      pinnacleValues: [1, 8, 9, 4],
      challengeValues: [4, 6, 2, 2],
    },
  },
  {
    label: 'karmic-debt Life Path, Azerbaijani name',
    input: {
      fullName: 'Çingiz Əliyev',
      birthDate: '1969-12-31',
      referenceDate: '2026-07-20',
    },
    working: [
      'Romanized: CINGIZ ELIYEV (Ç -> C, Ə -> E).',
      'Life Path: month 12 -> 3, day 31 -> 4, year 1969 -> 25 -> 7; 3+4+7 = 14 -> debt 14 -> 5.',
      'Expression: CINGIZ = 3+9+5+7+9+8 = 41; ELIYEV = 5+3+9+7+5+4 = 33; 74 -> 11 (master).',
      'Soul Urge: the Y in ELIYEV sits between I and E, both vowels, so it is a consonant.',
      '  Vowels I,I,E,I,E = 9+9+5+9+5 = 37 -> 10 -> 1.',
      'Personality: consonants C,N,G,Z,L,Y,V = 3+5+7+8+3+7+4 = 37 -> 10 -> 1.',
      'Birthday: 31. Maturity: 5+11 = 16 -> debt 16 -> 7.',
      'Personal Year: 3 + 4 + 1 = 8. Personal Month: 8 + 7 = 15 -> 6.',
      'Pinnacles: 3+4=7; 4+7=11; 7+11=18->9; 3+7=10->1.',
      'Challenges: |3-4|=1; |4-7|=3; |1-3|=2; |3-7|=4.',
    ].join('\n'),
    expected: {
      lifePath: 5,
      lifePathIsMaster: false,
      lifePathKarmicDebt: 14,
      expression: 11,
      soulUrge: 1,
      personality: 1,
      birthday: 31,
      maturity: 7,
      personalYear: 8,
      personalMonth: 6,
      pinnacleValues: [7, 11, 9, 1],
      challengeValues: [1, 3, 2, 4],
    },
  },
  {
    label: 'Cyrillic name, zero Challenge',
    input: {
      fullName: 'Иван Иванов',
      birthDate: '1991-05-05',
      referenceDate: '2026-07-20',
    },
    working: [
      'Romanized: IVAN IVANOV.',
      'Life Path: month 5, day 5, year 1991 -> 20 -> 2; 5+5+2 = 12 -> 3.',
      'Expression: IVAN = 9+4+1+5 = 19; IVANOV = 9+4+1+5+6+4 = 29; 48 -> 12 -> 3.',
      'Soul Urge: vowels I,A,I,A,O = 9+1+9+1+6 = 26 -> 8.',
      'Personality: consonants V,N,V,N,V = 4+5+4+5+4 = 22 (master).',
      'Birthday: 5. Maturity: 3+3 = 6.',
      'Personal Year: 5 + 5 + 1 = 11 -> 2. Personal Month: 2 + 7 = 9.',
      'Pinnacles: 5+5=10->1; 5+2=7; 1+7=8; 5+2=7.',
      'Challenges: |5-5|=0; |5-2|=3; |0-3|=3; |5-2|=3.',
    ].join('\n'),
    expected: {
      lifePath: 3,
      lifePathIsMaster: false,
      lifePathKarmicDebt: null,
      expression: 3,
      soulUrge: 8,
      personality: 22,
      birthday: 5,
      maturity: 6,
      personalYear: 2,
      personalMonth: 9,
      pinnacleValues: [1, 7, 8, 7],
      challengeValues: [0, 3, 3, 3],
    },
  },
];
