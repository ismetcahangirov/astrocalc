import { describe, expect, it } from 'vitest';
import type { NatalChart } from '@astrocalc/calc-engine';
import { formatChartDetails, formatDegree } from './chartText';

const LABELS = { ascendant: 'Ascendant', midheaven: 'Midheaven' };

// A minimal chart with just the fields formatChartDetails reads. Cusps are the
// 12 sign boundaries (Whole-Sign from 0° Aries), so a longitude's house number
// is predictable: 0–30° → house 1, 30–60° → house 2, …
function makeChart(): NatalChart {
  const cusps = Array.from({ length: 12 }, (_, i) => ({
    house: i + 1,
    longitude: i * 30,
    sign: 'Aries',
    degree: 0,
  }));
  return {
    positions: [
      {
        body: 'sun',
        longitude: 294.53,
        sign: 'Capricorn',
        degree: 24.53,
        speed: 1,
        retrograde: false,
      },
      { body: 'mercury', longitude: 40, sign: 'Taurus', degree: 10, speed: -0.5, retrograde: true },
    ],
    houses: {
      ascendant: { longitude: 169.99, sign: 'Virgo', degree: 19.99 },
      midheaven: { longitude: 81.55, sign: 'Gemini', degree: 21.55 },
      cusps,
    },
    aspects: [
      {
        bodyA: 'sun',
        bodyB: 'moon',
        type: 'conjunction',
        angle: 0,
        separation: 2,
        orb: 2.34,
        applying: true,
      },
      {
        bodyA: 'mars',
        bodyB: 'saturn',
        type: 'square',
        angle: 90,
        separation: 92,
        orb: 2,
        applying: null,
      },
    ],
  } as unknown as NatalChart;
}

describe('formatDegree', () => {
  it('formats degrees-within-a-sign as D°MM′', () => {
    expect(formatDegree(24.53)).toBe('24°32′');
    expect(formatDegree(0)).toBe('0°00′');
    expect(formatDegree(10)).toBe('10°00′');
  });

  it('rolls minutes over at 60', () => {
    expect(formatDegree(9.999)).toBe('10°00′');
  });
});

describe('formatChartDetails', () => {
  it('attaches interpretation subjectKeys to each detail row', () => {
    const details = formatChartDetails(makeChart(), 'en', LABELS);

    const sun = details.planets.find((p) => p.body === 'sun')!;
    expect(sun.signSubjectKey).toBe('sun-Capricorn');
    expect(sun.houseSubjectKey).toBe('sun-10');

    expect(details.houses[0]!.subjectKey).toBe('house-1');
    expect(details.houses[3]!.subjectKey).toBe('house-4');

    const conj = details.aspects.find((a) => a.aspect === 'Conjunction')!;
    expect(conj.subjectKey).toBe('conjunction-moon-sun'); // alphabetical, like aspectSubjectKey
  });

  it('leaves houseSubjectKey null when the birth time is unknown', () => {
    const chart = makeChart();
    (chart as { houses: unknown }).houses = undefined;
    const details = formatChartDetails(chart, 'en', LABELS);
    expect(details.planets[0]!.houseSubjectKey).toBeNull();
    expect(details.houses).toEqual([]);
  });

  it('lists planet placements with position, house and retrograde (English)', () => {
    const { planets } = formatChartDetails(makeChart(), 'en', LABELS);
    expect(planets[0]).toMatchObject({
      name: 'Sun',
      position: '24°32′ Capricorn',
      house: 10, // 294.53° → 10th 30°-slice (270–300)
      retrograde: false,
    });
    expect(planets[1]).toMatchObject({ name: 'Mercury', house: 2, retrograde: true });
  });

  it('localizes names in Azerbaijani', () => {
    const { planets, aspects } = formatChartDetails(makeChart(), 'az', LABELS);
    expect(planets[0].name).toBe('Günəş');
    expect(planets[0].position).toBe('24°32′ Oğlaq');
    expect(aspects[0].aspect).toBe('Qovuşma');
    expect(aspects[0].motion).toBe('yaxınlaşan');
  });

  it('exposes the chart angles', () => {
    const { angles } = formatChartDetails(makeChart(), 'en', LABELS);
    expect(angles).toEqual([
      { name: 'Ascendant', position: '19°59′ Virgo' },
      { name: 'Midheaven', position: '21°33′ Gemini' },
    ]);
  });

  it('lists all 12 house cusps with their sign', () => {
    const { houses } = formatChartDetails(makeChart(), 'en', LABELS);
    expect(houses).toHaveLength(12);
    expect(houses[0]).toEqual({ house: 1, position: '0°00′ Aries', subjectKey: 'house-1' });
    expect(houses[11].house).toBe(12);
  });

  it('formats aspects with orb and motion, null motion when undetermined', () => {
    const { aspects } = formatChartDetails(makeChart(), 'en', LABELS);
    expect(aspects[0]).toMatchObject({
      bodyA: 'Sun',
      bodyB: 'Moon',
      aspect: 'Conjunction',
      orb: 'orb 2.3°',
      motion: 'applying',
    });
    expect(aspects[1].motion).toBeNull();
  });

  it('omits houses and angles when the birth time is unknown', () => {
    const chart = makeChart();
    (chart as { houses: unknown }).houses = null;
    const { planets, angles, houses } = formatChartDetails(chart, 'en', LABELS);
    expect(angles).toEqual([]);
    expect(houses).toEqual([]);
    expect(planets.every((p) => p.house === null)).toBe(true);
  });
});
