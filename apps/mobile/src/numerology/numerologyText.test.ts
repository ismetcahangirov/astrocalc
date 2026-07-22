import { describe, expect, it } from 'vitest';
import type { NumerologyProfile } from '@astrocalc/calc-engine';
import { formatNumerologyDetails } from './numerologyText';

const EN_LABELS = {
  master: 'master number',
  karmicDebt: 'karmic debt',
  pinnacle: 'Pinnacle',
  challenge: 'Challenge',
};

const AZ_LABELS = {
  master: 'usta rəqəm',
  karmicDebt: 'karmik borc',
  pinnacle: 'Zirvə',
  challenge: 'Sınaq',
};

/**
 * A hand-rolled profile with just the fields the formatter reads. Chosen so each
 * badge case is exercised: a master Life Path (11), a karmic-debt Expression
 * (19 seen on the way down to 1), and plain numbers everywhere else.
 */
function makeProfile(): NumerologyProfile {
  return {
    schemaVersion: 1,
    lifePath: { value: 11, isMaster: true, karmicDebt: null },
    expression: { value: 1, isMaster: false, karmicDebt: 19 },
    soulUrge: { value: 7, isMaster: false, karmicDebt: null },
    personality: { value: 3, isMaster: false, karmicDebt: null },
    birthday: 24,
    maturity: { value: 22, isMaster: true, karmicDebt: null },
    personalYear: 5,
    personalMonth: 8,
    pinnacles: [
      {
        index: 1,
        startAge: 0,
        endAge: 34,
        number: { value: 6, isMaster: false, karmicDebt: null },
      },
      {
        index: 2,
        startAge: 35,
        endAge: 43,
        number: { value: 9, isMaster: false, karmicDebt: null },
      },
      {
        index: 3,
        startAge: 44,
        endAge: 52,
        // Pinnacle 3 sums Pinnacles 1 and 2, so its master ceiling is 22, not 33
        // (see PINNACLE_THIRD_RANGE in calc-engine/interpretations.ts).
        number: { value: 22, isMaster: true, karmicDebt: null },
      },
      {
        index: 4,
        startAge: 53,
        endAge: null,
        number: { value: 4, isMaster: false, karmicDebt: 13 },
      },
    ],
    challenges: [
      { index: 1, startAge: 0, endAge: 34, value: 2 },
      { index: 2, startAge: 35, endAge: 43, value: 0 },
      { index: 3, startAge: 44, endAge: 52, value: 2 },
      { index: 4, startAge: 53, endAge: null, value: 4 },
    ],
    currentAge: 46,
    currentPinnacle: 3,
    currentChallenge: 3,
  };
}

describe('formatNumerologyDetails — core and extended numbers', () => {
  it('lists every core number as a labelled row (English)', () => {
    const { core } = formatNumerologyDetails(makeProfile(), 'en', EN_LABELS);

    expect(core.map((r) => r.key)).toEqual(['lifePath', 'expression', 'soulUrge', 'personality']);
    expect(core.map((r) => [r.label, r.value])).toEqual([
      ['Life Path', '11'],
      ['Expression', '1'],
      ['Soul Urge', '7'],
      ['Personality', '3'],
    ]);
  });

  it('lists the extended numbers', () => {
    const { extended } = formatNumerologyDetails(makeProfile(), 'en', EN_LABELS);

    expect(extended).toEqual([
      { key: 'birthday', label: 'Birthday', value: '24', badge: null, subjectKey: 'birthday-24' },
      {
        key: 'maturity',
        label: 'Maturity',
        value: '22',
        badge: 'master number',
        subjectKey: 'maturity-22',
      },
    ]);
  });

  it('lists the cycle numbers, which are always plain 1–9', () => {
    const { cycles } = formatNumerologyDetails(makeProfile(), 'en', EN_LABELS);

    expect(cycles).toEqual([
      {
        key: 'personalYear',
        label: 'Personal Year',
        value: '5',
        badge: null,
        subjectKey: 'personal-year-5',
      },
      {
        key: 'personalMonth',
        label: 'Personal Month',
        value: '8',
        badge: null,
        subjectKey: 'personal-month-8',
      },
    ]);
  });

  it('badges a master number and appends the number to a karmic debt', () => {
    const { core } = formatNumerologyDetails(makeProfile(), 'en', EN_LABELS);

    expect(core[0]!.badge).toBe('master number');
    expect(core[1]!.badge).toBe('karmic debt 19');
    expect(core[2]!.badge).toBeNull();
  });

  it('localizes labels and badges in Azerbaijani', () => {
    const { core, extended, cycles } = formatNumerologyDetails(makeProfile(), 'az', AZ_LABELS);

    expect(core.map((r) => r.label)).toEqual(['Həyat Yolu', 'İfadə', 'Ruh Arzusu', 'Şəxsiyyət']);
    expect(core[0]!.badge).toBe('usta rəqəm');
    expect(core[1]!.badge).toBe('karmik borc 19');
    expect(extended.map((r) => r.label)).toEqual(['Doğum Günü', 'Yetkinlik']);
    expect(cycles.map((r) => r.label)).toEqual(['Şəxsi İl', 'Şəxsi Ay']);
  });
});

describe('formatNumerologyDetails — pinnacles and challenges', () => {
  it('numbers each period and renders its age range', () => {
    const { pinnacles } = formatNumerologyDetails(makeProfile(), 'en', EN_LABELS);

    expect(pinnacles).toHaveLength(4);
    expect(pinnacles[0]).toMatchObject({
      key: 'pinnacle-1',
      label: 'Pinnacle 1',
      value: '6',
      ageRange: '0–34',
    });
    // The final period is open-ended — no upper bound to print.
    expect(pinnacles[3]!.ageRange).toBe('53+');
  });

  it('badges a master or karmic-debt pinnacle, and leaves challenges unbadged', () => {
    const { pinnacles, challenges } = formatNumerologyDetails(makeProfile(), 'en', EN_LABELS);

    expect(pinnacles.map((p) => p.badge)).toEqual([
      null,
      null,
      'master number', // 22 at position 3 — provenance the bare "22" would lose
      'karmic debt 13',
    ]);
    // Challenges have no master/debt concept, so their badge is always null.
    expect(challenges.map((c) => c.badge)).toEqual([null, null, null, null]);
  });

  it('localizes a pinnacle badge in Azerbaijani', () => {
    const { pinnacles } = formatNumerologyDetails(makeProfile(), 'az', AZ_LABELS);

    expect(pinnacles[2]!.badge).toBe('usta rəqəm');
    expect(pinnacles[3]!.badge).toBe('karmik borc 13');
  });

  it('marks only the current pinnacle and challenge', () => {
    const { pinnacles, challenges } = formatNumerologyDetails(makeProfile(), 'en', EN_LABELS);

    expect(pinnacles.map((p) => p.isCurrent)).toEqual([false, false, true, false]);
    expect(challenges.map((c) => c.isCurrent)).toEqual([false, false, true, false]);
  });

  it('renders challenge values, including a genuine zero', () => {
    const { challenges } = formatNumerologyDetails(makeProfile(), 'en', EN_LABELS);

    expect(challenges.map((c) => c.value)).toEqual(['2', '0', '2', '4']);
    expect(challenges[3]).toMatchObject({
      key: 'challenge-4',
      label: 'Challenge 4',
      ageRange: '53+',
    });
  });

  it('localizes the period labels in Azerbaijani', () => {
    const { pinnacles, challenges } = formatNumerologyDetails(makeProfile(), 'az', AZ_LABELS);

    expect(pinnacles[0]!.label).toBe('Zirvə 1');
    expect(challenges[0]!.label).toBe('Sınaq 1');
    // Age ranges are digits — identical in either locale.
    expect(pinnacles[3]!.ageRange).toBe('53+');
  });
});

describe('formatNumerologyDetails — interpretation subject keys', () => {
  it('attaches the right subjectKey to core, cycle, pinnacle and challenge rows', () => {
    const { core, cycles, pinnacles, challenges } = formatNumerologyDetails(
      makeProfile(),
      'en',
      EN_LABELS,
    );

    expect(core.find((r) => r.key === 'lifePath')!.subjectKey).toBe('life-path-11');
    expect(cycles.find((r) => r.key === 'personalYear')!.subjectKey).toBe('personal-year-5');
    expect(pinnacles[0]!.subjectKey).toBe('pinnacle-1-6');
    expect(challenges[0]!.subjectKey).toBe('challenge-1-2');
  });
});
