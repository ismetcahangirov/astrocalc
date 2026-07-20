import type { MatrixInput } from '../matrix';

/**
 * Reference Matrix of Destiny cases for issue #72.
 *
 * The Matrix has no ephemeris to check against — unlike the natal charts in
 * `reference-charts.ts`, there is no astro-seek to query. What it *does* have,
 * which numerology did not, is **other implementations**: the expectations below
 * were taken from two live reference calculators that were driven directly
 * (`matrica-sudby.ru`, `beloesolnce.ru/matrix`, for cases 1 and 2), and every
 * case was additionally checked against an independent open-source
 * implementation executed on the same dates.
 *
 * That makes these genuinely external expectations rather than a restatement of
 * this engine's own arithmetic — which is the whole point. The unit suites check
 * each function against its own formula, and cannot catch a formula that is
 * wrong in the same way in both places; these can.
 *
 * The `working` field carries the hand derivation so a reader can re-check any
 * expected value rather than trust it. See the method spec, §6.
 *
 * **If a case disagrees with the implementation, that is a bug report, not a
 * stale fixture.** Do not edit the expectations until the derivation has been
 * re-done and found genuinely wrong — and if it was wrong, correct the `working`
 * narrative too, not just the number, or the next reader inherits a fixture
 * whose stated reasoning no longer produces its stated answer.
 */

/**
 * A lighter second tier of cross-validation: five further birth dates whose
 * core square, ancestral corners and purposes were read from three *additional*
 * reference calculators (`matrica-sudby.ru`, `beloesolnce.ru`,
 * `matrixdestinycalculator.com`), all of which agreed with each other.
 *
 * Deliberately a narrower shape than {@link ReferenceMatrixExpectation}: those
 * calculators' money-line and chakra values were either not displayed or not
 * unanimous, so only the positions that were actually corroborated are asserted
 * here. Recording a value nobody independently confirmed — merely because the
 * struct has a field for it — would launder this engine's own output into
 * something that looks like external evidence, which is the exact failure mode
 * these fixtures exist to prevent.
 */
export interface CorroboratedMatrixCase {
  birthDate: string;
  covers: string;
  core: { day: number; month: number; year: number; sum: number; centre: number };
  /** Corners in the order the reference calculators print them: TL, TR, BR, BL. */
  corners: [number, number, number, number];
  purposes: { sky: number; earth: number; personal: number; social: number; spiritual: number };
}

export const CORROBORATED_MATRIX_CASES: CorroboratedMatrixCase[] = [
  {
    birthDate: '1979-07-29',
    covers: 'day 29 -> 11, year 1979 -> 26 -> 8',
    core: { day: 11, month: 7, year: 8, sum: 8, centre: 7 },
    corners: [18, 15, 16, 19],
    purposes: { sky: 15, earth: 19, personal: 7, social: 14, spiritual: 21 },
  },
  {
    birthDate: '1983-11-22',
    covers: 'a second day-22 case, with a different year',
    core: { day: 22, month: 11, year: 21, sum: 9, centre: 9 },
    corners: [6, 5, 3, 4],
    purposes: { sky: 20, earth: 7, personal: 9, social: 18, spiritual: 9 },
  },
  {
    birthDate: '1990-04-12',
    covers: 'the order-of-reduction trap: ancestral centre 5 vs social purpose 14',
    core: { day: 12, month: 4, year: 19, sum: 8, centre: 7 },
    corners: [16, 5, 9, 20],
    purposes: { sky: 12, earth: 4, personal: 16, social: 14, spiritual: 3 },
  },
  {
    birthDate: '1988-04-10',
    covers: 'the bottom vertex landing on exactly 22',
    core: { day: 10, month: 4, year: 8, sum: 22, centre: 8 },
    corners: [14, 12, 3, 5],
    purposes: { sky: 8, earth: 18, personal: 8, social: 7, spiritual: 15 },
  },
  {
    birthDate: '1985-06-24',
    covers: 'day 24 -> 6, and an ancestral corner landing on exactly 22',
    core: { day: 6, month: 6, year: 5, sum: 17, centre: 7 },
    corners: [12, 11, 22, 5],
    purposes: { sky: 5, earth: 11, personal: 16, social: 5, spiritual: 21 },
  },
];

export interface ReferenceMatrixExpectation {
  /** The core square: day, month, year, sum, centre. */
  core: { day: number; month: number; year: number; sum: number; centre: number };
  /** The four ancestral corners, by compass direction. */
  corners: { nw: number; ne: number; se: number; sw: number };
  ancestralCentre: number;
  paternalLine: number;
  maternalLine: number;
  purposes: {
    sky: number;
    earth: number;
    personal: number;
    social: number;
    spiritual: number;
    planetary: number;
  };
  /** `entry, toEntry, core, toPartner, partner` in line order. */
  moneyAndRelationships: number[];
}

export interface ReferenceMatrixCase {
  label: string;
  input: MatrixInput;
  /** What this case exists to exercise — every case covers a distinct edge. */
  covers: string;
  /** The full derivation, so the expectation can be re-checked, not trusted. */
  working: string;
  expected: ReferenceMatrixExpectation;
}

export const REFERENCE_MATRIX_CASES: ReferenceMatrixCase[] = [
  {
    label: 'birth day of exactly 22',
    input: { birthDate: '1990-11-22' },
    covers:
      'The strict `> 22` reduction boundary: day 22 is kept as arcana 22 rather ' +
      'than reduced to 4 or zeroed. Verified cell-by-cell against two live calculators.',
    working: [
      'day 22 -> 22 (already within 1-22, so untouched).',
      'month 11 -> 11. year 1990 -> 1+9+9+0 = 19 (<= 22, no further reduction).',
      'sum = 22+11+19 = 52 -> 5+2 = 7.',
      'centre = 22+11+19+7 = 59 -> 5+9 = 14.',
      'NW = 22+11 = 33 -> 6.  NE = 11+19 = 30 -> 3.',
      'SE = 19+7 = 26 -> 8.   SW = 7+22 = 29 -> 11.',
      'ancestral centre = 6+3+8+11 = 28 -> 10.',
      'paternal = NW+SE = 6+8 = 14.  maternal = NE+SW = 3+11 = 14.',
      'sky = month+sum = 11+7 = 18.  earth = day+year = 22+19 = 41 -> 5.',
      'personal = 18+5 = 23 -> 5.  social = 14+14 = 28 -> 10.',
      'spiritual = 5+10 = 15.  planetary = 10+15 = 25 -> 7.',
      'money: entry = sum+centre = 7+14 = 21; partner = year+centre = 19+14 = 33 -> 6;',
      '  core = 21+6 = 27 -> 9; toEntry = 21+9 = 30 -> 3; toPartner = 9+6 = 15.',
    ].join('\n'),
    expected: {
      core: { day: 22, month: 11, year: 19, sum: 7, centre: 14 },
      corners: { nw: 6, ne: 3, se: 8, sw: 11 },
      ancestralCentre: 10,
      paternalLine: 14,
      maternalLine: 14,
      purposes: { sky: 18, earth: 5, personal: 5, social: 10, spiritual: 15, planetary: 7 },
      moneyAndRelationships: [21, 3, 9, 15, 6],
    },
  },
  {
    label: 'day and year both reduce',
    input: { birthDate: '1987-01-29' },
    covers:
      'Day 29 -> 11 and year 1987 -> 25 -> 7, a two-pass year reduction. Also the ' +
      'other way arcana 22 occurs: a raw sum landing on exactly 22 ' +
      '(Vishuddha physical = day + centre = 11 + 11). Verified against a live ' +
      'calculator and against a published worked example that agrees with it.',
    working: [
      'day 29 -> 2+9 = 11. month 1 -> 1. year 1987 -> 1+9+8+7 = 25 -> 2+5 = 7.',
      'sum = 11+1+7 = 19 (note: from the REDUCED cardinals, not 29+1+25).',
      'centre = 11+1+7+19 = 38 -> 3+8 = 11.',
      'NW = 11+1 = 12.  NE = 1+7 = 8.  SE = 7+19 = 26 -> 8.  SW = 19+11 = 30 -> 3.',
      'ancestral centre = 12+8+8+3 = 31 -> 4.',
      'paternal = 12+8 = 20.  maternal = 8+3 = 11.',
      'sky = 1+19 = 20.  earth = 11+7 = 18.  personal = 20+18 = 38 -> 11.',
      'social = 20+11 = 31 -> 4.  spiritual = 11+4 = 15.  planetary = 4+15 = 19.',
      'money: entry = 19+11 = 30 -> 3; partner = 7+11 = 18; core = 3+18 = 21;',
      '  toEntry = 3+21 = 24 -> 6; toPartner = 21+18 = 39 -> 12.',
    ].join('\n'),
    expected: {
      core: { day: 11, month: 1, year: 7, sum: 19, centre: 11 },
      corners: { nw: 12, ne: 8, se: 8, sw: 3 },
      ancestralCentre: 4,
      paternalLine: 20,
      maternalLine: 11,
      purposes: { sky: 20, earth: 18, personal: 11, social: 4, spiritual: 15, planetary: 19 },
      moneyAndRelationships: [3, 6, 21, 12, 18],
    },
  },
  {
    label: 'nothing reduces — the plain case',
    input: { birthDate: '1990-05-12' },
    covers:
      'The baseline: every cardinal point is already within 1-22, so no reduction ' +
      'fires on the inputs at all and only the derived sums reduce.',
    working: [
      'day 12 -> 12. month 5 -> 5. year 1990 -> 19.',
      'sum = 12+5+19 = 36 -> 9.  centre = 12+5+19+9 = 45 -> 9.',
      'NW = 12+5 = 17.  NE = 5+19 = 24 -> 6.  SE = 19+9 = 28 -> 10.  SW = 9+12 = 21.',
      'ancestral centre = 17+6+10+21 = 54 -> 9.',
      'paternal = 17+10 = 27 -> 9.  maternal = 6+21 = 27 -> 9.',
      'sky = 5+9 = 14.  earth = 12+19 = 31 -> 4.  personal = 14+4 = 18.',
      'social = 9+9 = 18.  spiritual = 18+18 = 36 -> 9.  planetary = 18+9 = 27 -> 9.',
      'money: entry = 9+9 = 18; partner = 19+9 = 28 -> 10; core = 18+10 = 28 -> 10;',
      '  toEntry = 18+10 = 28 -> 10; toPartner = 10+10 = 20.',
    ].join('\n'),
    expected: {
      core: { day: 12, month: 5, year: 19, sum: 9, centre: 9 },
      corners: { nw: 17, ne: 6, se: 10, sw: 21 },
      ancestralCentre: 9,
      paternalLine: 9,
      maternalLine: 9,
      purposes: { sky: 14, earth: 4, personal: 18, social: 18, spiritual: 9, planetary: 9 },
      moneyAndRelationships: [18, 10, 10, 20, 10],
    },
  },
  {
    label: 'day 31 and a year with a tiny digit sum',
    input: { birthDate: '2000-12-31' },
    covers:
      'The largest possible day (31 -> 4), the largest month (12), and a year whose ' +
      'digit sum is only 2 — the low end of the year range. Also produces an ' +
      'ancestral corner of exactly 22 (SW = sum + day = 18 + 4).',
    working: [
      'day 31 -> 3+1 = 4. month 12 -> 12. year 2000 -> 2+0+0+0 = 2.',
      'sum = 4+12+2 = 18.  centre = 4+12+2+18 = 36 -> 9.',
      'NW = 4+12 = 16.  NE = 12+2 = 14.  SE = 2+18 = 20.  SW = 18+4 = 22 (kept).',
      'ancestral centre = 16+14+20+22 = 72 -> 9.',
      'paternal = 16+20 = 36 -> 9.  maternal = 14+22 = 36 -> 9.',
      'sky = 12+18 = 30 -> 3.  earth = 4+2 = 6.  personal = 3+6 = 9.',
      'social = 9+9 = 18.  spiritual = 9+18 = 27 -> 9.  planetary = 18+9 = 27 -> 9.',
      'money: entry = 18+9 = 27 -> 9; partner = 2+9 = 11; core = 9+11 = 20;',
      '  toEntry = 9+20 = 29 -> 11; toPartner = 20+11 = 31 -> 4.',
    ].join('\n'),
    expected: {
      core: { day: 4, month: 12, year: 2, sum: 18, centre: 9 },
      corners: { nw: 16, ne: 14, se: 20, sw: 22 },
      ancestralCentre: 9,
      paternalLine: 9,
      maternalLine: 9,
      purposes: { sky: 3, earth: 6, personal: 9, social: 18, spiritual: 9, planetary: 9 },
      moneyAndRelationships: [9, 11, 20, 4, 11],
    },
  },
  {
    label: 'day 30 and a year digit-summing to exactly 22',
    input: { birthDate: '1975-08-30' },
    covers:
      'The reduction is not monotonic: day 30 -> 3 is a *lower* arcana than day ' +
      '29 -> 11. Also a year whose digit sum is exactly 22 (1+9+7+5), kept rather ' +
      'than reduced — the third distinct route to arcana 22.',
    working: [
      'day 30 -> 3+0 = 3 (lower than day 29 -> 11; the non-monotonicity).',
      'month 8 -> 8. year 1975 -> 1+9+7+5 = 22 (kept as 22).',
      'sum = 3+8+22 = 33 -> 6.  centre = 3+8+22+6 = 39 -> 12.',
      'NW = 3+8 = 11.  NE = 8+22 = 30 -> 3.  SE = 22+6 = 28 -> 10.  SW = 6+3 = 9.',
      'ancestral centre = 11+3+10+9 = 33 -> 6.',
      'paternal = 11+10 = 21.  maternal = 3+9 = 12.',
      'sky = 8+6 = 14.  earth = 3+22 = 25 -> 7.  personal = 14+7 = 21.',
      'social = 21+12 = 33 -> 6.  spiritual = 21+6 = 27 -> 9.  planetary = 6+9 = 15.',
      'money: entry = 6+12 = 18; partner = 22+12 = 34 -> 7; core = 18+7 = 25 -> 7;',
      '  toEntry = 18+7 = 25 -> 7; toPartner = 7+7 = 14.',
    ].join('\n'),
    expected: {
      core: { day: 3, month: 8, year: 22, sum: 6, centre: 12 },
      corners: { nw: 11, ne: 3, se: 10, sw: 9 },
      ancestralCentre: 6,
      paternalLine: 21,
      maternalLine: 12,
      purposes: { sky: 14, earth: 7, personal: 21, social: 6, spiritual: 9, planetary: 15 },
      moneyAndRelationships: [18, 7, 7, 14, 7],
    },
  },
];
