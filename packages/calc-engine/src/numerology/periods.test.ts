import { describe, expect, it } from 'vitest';
import { challenges, currentPeriodIndex, pinnacles } from './periods';

describe('pinnacles', () => {
  const result = pinnacles('1990-03-07');

  it('returns four periods, indexed 1-4', () => {
    expect(result.map((p) => p.index)).toEqual([1, 2, 3, 4]);
  });

  it('derives the values from the reduced birth components', () => {
    // month 3, day 7, year 1990 -> 1.
    // P1 = 3+7 = 10 -> 1;  P2 = 7+1 = 8;  P3 = P1+P2 = 9;  P4 = 3+1 = 4.
    expect(result.map((p) => p.number.value)).toEqual([1, 8, 9, 4]);
  });

  it('ends the first pinnacle at 36 minus the single-digit Life Path', () => {
    // Life Path is master 11, which collapses to 2 for the age maths: 36-2 = 34.
    expect(result[0]).toMatchObject({ startAge: 0, endAge: 34 });
  });

  it('runs the middle pinnacles for nine years each and leaves the last open', () => {
    expect(result[1]).toMatchObject({ startAge: 35, endAge: 43 });
    expect(result[2]).toMatchObject({ startAge: 44, endAge: 52 });
    expect(result[3]).toMatchObject({ startAge: 53, endAge: null });
  });

  it('covers every age with no gap and no overlap', () => {
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.startAge).toBe(result[i - 1]!.endAge! + 1);
    }
  });

  it('never produces an unreachable master number', () => {
    // Pinnacles 1, 2 and 4 sum two 1-9 components (max 18), so only 11 can
    // survive as a master; pinnacle 3 sums two pinnacles (max 22).
    for (let month = 1; month <= 12; month++) {
      for (let day = 1; day <= 28; day++) {
        const date = `1988-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const [p1, p2, p3, p4] = pinnacles(date);
        for (const p of [p1!, p2!, p4!]) {
          expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 11]).toContain(p.number.value);
        }
        expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22]).toContain(p3!.number.value);
      }
    }
  });
});

describe('challenges', () => {
  const result = challenges('1990-03-07');

  it('returns four periods, indexed 1-4', () => {
    expect(result.map((c) => c.index)).toEqual([1, 2, 3, 4]);
  });

  it('uses absolute differences of the reduced birth components', () => {
    // month 3, day 7, year 1. C1=|3-7|=4; C2=|7-1|=6; C3=|4-6|=2; C4=|3-1|=2.
    expect(result.map((c) => c.value)).toEqual([4, 6, 2, 2]);
  });

  it('allows 0 as a genuine challenge value', () => {
    // 1991-05-05: month 5, day 5 -> C1 = 0.
    expect(challenges('1991-05-05')[0]!.value).toBe(0);
  });

  it('always lands in 0-8', () => {
    for (let month = 1; month <= 12; month++) {
      for (let day = 1; day <= 28; day++) {
        const date = `1999-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        for (const c of challenges(date)) {
          expect(c.value).toBeGreaterThanOrEqual(0);
          expect(c.value).toBeLessThanOrEqual(8);
        }
      }
    }
  });

  it('shares the pinnacles age ranges', () => {
    const ages = pinnacles('1990-03-07');
    expect(result.map((c) => [c.startAge, c.endAge])).toEqual(
      ages.map((p) => [p.startAge, p.endAge]),
    );
  });
});

describe('currentPeriodIndex', () => {
  const periods = pinnacles('1990-03-07');

  it('picks the period containing the given age', () => {
    expect(currentPeriodIndex(periods, 0)).toBe(1);
    expect(currentPeriodIndex(periods, 34)).toBe(1);
    expect(currentPeriodIndex(periods, 35)).toBe(2);
    expect(currentPeriodIndex(periods, 43)).toBe(2);
    expect(currentPeriodIndex(periods, 44)).toBe(3);
    expect(currentPeriodIndex(periods, 99)).toBe(4);
  });
});
