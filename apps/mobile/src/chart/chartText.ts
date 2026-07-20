import {
  findHouseNumber,
  type AspectType,
  type CelestialBody,
  type NatalChart,
  type ZodiacSign,
} from '@astrocalc/calc-engine';
import type { Locale } from '../i18n/translations';

/**
 * Turns a computed {@link NatalChart} into localized, human-readable rows for
 * the on-screen "chart details" list — planet placements, the chart angles, and
 * the aspects — shown above the (separately-fetched) interpretation text.
 *
 * Deliberately uses **names**, not the Unicode astrological glyphs: this list is
 * rendered with React Native `Text` (the system font), which — like the wheel's
 * Skia text before its bundled symbol font — has no glyphs for the astrological
 * block, so names are the readable, font-safe choice. Pure and locale-driven, so
 * it unit-tests without React.
 */

const SIGN_NAMES: Record<Locale, Record<ZodiacSign, string>> = {
  en: {
    Aries: 'Aries',
    Taurus: 'Taurus',
    Gemini: 'Gemini',
    Cancer: 'Cancer',
    Leo: 'Leo',
    Virgo: 'Virgo',
    Libra: 'Libra',
    Scorpio: 'Scorpio',
    Sagittarius: 'Sagittarius',
    Capricorn: 'Capricorn',
    Aquarius: 'Aquarius',
    Pisces: 'Pisces',
  },
  az: {
    Aries: 'Qoç',
    Taurus: 'Buğa',
    Gemini: 'Əkizlər',
    Cancer: 'Xərçəng',
    Leo: 'Şir',
    Virgo: 'Qız',
    Libra: 'Tərəzi',
    Scorpio: 'Əqrəb',
    Sagittarius: 'Oxatan',
    Capricorn: 'Oğlaq',
    Aquarius: 'Dolça',
    Pisces: 'Balıqlar',
  },
};

const BODY_NAMES: Record<Locale, Record<CelestialBody, string>> = {
  en: {
    sun: 'Sun',
    moon: 'Moon',
    mercury: 'Mercury',
    venus: 'Venus',
    mars: 'Mars',
    jupiter: 'Jupiter',
    saturn: 'Saturn',
    uranus: 'Uranus',
    neptune: 'Neptune',
    pluto: 'Pluto',
    northNode: 'North Node',
    southNode: 'South Node',
    chiron: 'Chiron',
  },
  az: {
    sun: 'Günəş',
    moon: 'Ay',
    mercury: 'Merkuri',
    venus: 'Venera',
    mars: 'Mars',
    jupiter: 'Yupiter',
    saturn: 'Saturn',
    uranus: 'Uran',
    neptune: 'Neptun',
    pluto: 'Pluton',
    northNode: 'Şimal Qovşağı',
    southNode: 'Cənub Qovşağı',
    chiron: 'Xiron',
  },
};

const ASPECT_NAMES: Record<Locale, Record<AspectType, string>> = {
  en: {
    conjunction: 'Conjunction',
    sextile: 'Sextile',
    square: 'Square',
    trine: 'Trine',
    opposition: 'Opposition',
  },
  az: {
    conjunction: 'Qovuşma',
    sextile: 'Sekstil',
    square: 'Kvadrat',
    trine: 'Trigon',
    opposition: 'Oppozisiya',
  },
};

/** Applying/separating, localized. `null` when it couldn't be determined. */
const APPLYING_LABELS: Record<Locale, { applying: string; separating: string }> = {
  en: { applying: 'applying', separating: 'separating' },
  az: { applying: 'yaxınlaşan', separating: 'uzaqlaşan' },
};

/** `24.53` (degrees within a sign) → `24°32′`, with minute rollover handled. */
export function formatDegree(degreeInSign: number): string {
  let d = Math.floor(degreeInSign);
  let m = Math.round((degreeInSign - d) * 60);
  if (m === 60) {
    m = 0;
    d += 1;
  }
  return `${d}°${String(m).padStart(2, '0')}′`;
}

export interface PlanetDetail {
  body: CelestialBody;
  name: string;
  /** e.g. `24°32′ Capricorn`. */
  position: string;
  /** House number 1–12, or `null` when the birth time (and so houses) is unknown. */
  house: number | null;
  retrograde: boolean;
}

export interface AngleDetail {
  name: string;
  /** e.g. `19°59′ Virgo`. */
  position: string;
}

export interface HouseDetail {
  house: number;
  /** The sign + degree the house cusp falls on, e.g. `19°14′ Libra`. */
  position: string;
}

export interface AspectDetail {
  key: string;
  bodyA: string;
  bodyB: string;
  aspect: string;
  /** e.g. `orb 2.3°`. */
  orb: string;
  /** Localized "applying"/"separating", or `null` when undetermined. */
  motion: string | null;
}

export interface ChartDetails {
  planets: PlanetDetail[];
  angles: AngleDetail[];
  /** The 12 house cusps and the sign each falls on (empty when the birth time is unknown). */
  houses: HouseDetail[];
  aspects: AspectDetail[];
}

/** Build the localized detail rows for a chart. */
export function formatChartDetails(
  chart: NatalChart,
  locale: Locale,
  labels: { ascendant: string; midheaven: string },
): ChartDetails {
  const signNames = SIGN_NAMES[locale];
  const bodyNames = BODY_NAMES[locale];
  const aspectNames = ASPECT_NAMES[locale];
  const applying = APPLYING_LABELS[locale];
  const cusps = chart.houses?.cusps ?? null;

  const planets: PlanetDetail[] = chart.positions.map((p) => ({
    body: p.body,
    name: bodyNames[p.body],
    position: `${formatDegree(p.degree)} ${signNames[p.sign]}`,
    house: cusps ? findHouseNumber(cusps, p.longitude) : null,
    retrograde: p.retrograde,
  }));

  const angles: AngleDetail[] = chart.houses
    ? [
        {
          name: labels.ascendant,
          position: `${formatDegree(chart.houses.ascendant.degree)} ${signNames[chart.houses.ascendant.sign]}`,
        },
        {
          name: labels.midheaven,
          position: `${formatDegree(chart.houses.midheaven.degree)} ${signNames[chart.houses.midheaven.sign]}`,
        },
      ]
    : [];

  const houses: HouseDetail[] = (chart.houses?.cusps ?? []).map((cusp) => ({
    house: cusp.house,
    position: `${formatDegree(cusp.degree)} ${signNames[cusp.sign]}`,
  }));

  const aspects: AspectDetail[] = chart.aspects.map((a, i) => ({
    key: `${a.bodyA}-${a.bodyB}-${a.type}-${i}`,
    bodyA: bodyNames[a.bodyA],
    bodyB: bodyNames[a.bodyB],
    aspect: aspectNames[a.type],
    orb: `orb ${a.orb.toFixed(1)}°`,
    motion: a.applying == null ? null : a.applying ? applying.applying : applying.separating,
  }));

  return { planets, angles, houses, aspects };
}
