import type { AspectType } from '../aspects';
import type { NatalChartInput } from '../natal-chart';
import type { CelestialBody, ZodiacSign } from '../planetary-positions';

/**
 * Manually collected reference data for issue #21 (cross-validation against
 * real external calculators). Every scenario below was entered into
 * astro-seek.com's free natal chart calculator (Placidus house system) by an
 * agent driving a real browser — see each entry's `source.url` for the exact
 * query used and `source.notes` for anything noteworthy about how it was
 * collected. Three scenarios (`quito-2000`, `tromso-1960`, `paris-1885`) were
 * additionally spot-checked against astro.com's free chart tool; astro.com's
 * anonymous tier only exposes Sun/Moon sign (degrees, Ascendant, and houses
 * require a free account, which was deliberately not created for this task),
 * so those cross-checks only confirm sign-level agreement — see each
 * `crossCheck` field.
 *
 * `reference-charts.test.ts` computes each chart via this package's own
 * `computeNatalChart()` and asserts it lands within a documented tolerance of
 * the values here. See `tromso-1960`'s `knownDeviations` for the one
 * documented exception, and its `source.notes` for why it's there.
 */

export interface ReferencePosition {
  body: CelestialBody;
  sign: ZodiacSign;
  degree: number;
  minute: number;
  retrograde: boolean;
}

export interface ReferenceAnglePoint {
  sign: ZodiacSign;
  degree: number;
  minute: number;
}

export interface ReferenceCusp extends ReferenceAnglePoint {
  house: number;
}

export interface ReferenceAspect {
  bodyA: CelestialBody;
  bodyB: CelestialBody;
  type: AspectType;
  orbDegrees: number;
}

export interface ReferenceSource {
  site: string;
  url: string;
  houseSystem: string;
  notes?: string;
}

export interface ReferenceCrossCheck {
  site: string;
  url: string;
  agrees: boolean;
  notes: string;
}

export interface ReferenceChart {
  label: string;
  input: NatalChartInput;
  source: ReferenceSource;
  positions: ReferencePosition[];
  ascendant: ReferenceAnglePoint;
  midheaven: ReferenceAnglePoint;
  cusps: ReferenceCusp[];
  aspects: ReferenceAspect[];
  crossCheck?: ReferenceCrossCheck;
  /**
   * Fields to exclude from the automated comparison, with the reason —
   * used only by `tromso-1960` (see its `source.notes`): the reference site
   * assumed Norway observed DST for a June 1960 date, which it did not
   * (Norway ran no DST between 1945 and 1980), so its Moon/Ascendant/
   * Midheaven/houses are off by the resulting ~1 hour, and separately its
   * Placidus houses don't use the polar fallback ours correctly applies —
   * neither is a defect in this package.
   */
  knownDeviations?: { fields: string[]; reason: string };
}

export const REFERENCE_CHARTS: ReferenceChart[] = [
  {
    label: 'quito-2000',
    input: {
      birthDate: '2000-06-15',
      birthTime: '12:00',
      birthTimeKnown: true,
      latitude: -0.1807,
      longitude: -78.4678,
      timezone: 'America/Guayaquil',
    },
    source: {
      site: 'astro-seek.com',
      url: 'https://horoscopes.astro-seek.com/calculate-birth-chart-horoscope-online/?input_natal=1&send_calculation=1&narozeni_den=15&narozeni_mesic=6&narozeni_rok=2000&narozeni_hodina=12&narozeni_minuta=00&narozeni_sekunda=00&narozeni_city=Quito%2C+Ecuador&narozeni_mesto_hidden=Quito&narozeni_stat_hidden=EC&narozeni_podstat_kratky_hidden=&narozeni_tzid_id=114&narozeni_sirka_stupne=0&narozeni_sirka_minuty=11&narozeni_sirka_smer=1&narozeni_delka_stupne=78&narozeni_delka_minuty=28&narozeni_delka_smer=1&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&hid_fortune=1&hid_fortune_check=on&hid_vertex=1&hid_vertex_check=on&hid_chiron=1&hid_chiron_check=on&hid_lilith=1&hid_lilith_check=on&hid_uzel=1&hid_uzel_check=on&tolerance=1&aya=&tolerance_paral=0',
      houseSystem: 'Placidus',
      notes:
        "Autocomplete's default 'Quito' coords (0°14'S,78°31'W, tzid=114 for America/Guayaquil) were overridden via the manual lat/lon fields to 0°11'S, 78°28'W (nearest arcminute to -0.1807/-78.4678); the auto-detected timezone/tzid was kept. Site header confirmed: 'Date of Birth (local time): 15 June 2000 - 12:00', House system: Placidus system, Latitude/Longitude: 0°11'S, 78°28'W.",
    },
    positions: [
      { body: 'sun', sign: 'Gemini', degree: 24, minute: 52, retrograde: false },
      { body: 'moon', sign: 'Sagittarius', degree: 11, minute: 24, retrograde: false },
      { body: 'mercury', sign: 'Cancer', degree: 17, minute: 45, retrograde: false },
      { body: 'venus', sign: 'Gemini', degree: 26, minute: 2, retrograde: false },
      { body: 'mars', sign: 'Gemini', degree: 29, minute: 27, retrograde: false },
      { body: 'jupiter', sign: 'Taurus', degree: 26, minute: 50, retrograde: false },
      { body: 'saturn', sign: 'Taurus', degree: 24, minute: 55, retrograde: false },
      { body: 'uranus', sign: 'Aquarius', degree: 20, minute: 38, retrograde: true },
      { body: 'neptune', sign: 'Aquarius', degree: 6, minute: 12, retrograde: true },
      { body: 'pluto', sign: 'Sagittarius', degree: 11, minute: 10, retrograde: true },
    ],
    ascendant: { sign: 'Virgo', degree: 19, minute: 59 },
    midheaven: { sign: 'Gemini', degree: 21, minute: 33 },
    cusps: [
      { house: 1, sign: 'Virgo', degree: 19, minute: 59 },
      { house: 2, sign: 'Libra', degree: 22, minute: 31 },
      { house: 3, sign: 'Scorpio', degree: 23, minute: 13 },
      { house: 4, sign: 'Sagittarius', degree: 21, minute: 33 },
      { house: 5, sign: 'Capricorn', degree: 19, minute: 12 },
      { house: 6, sign: 'Aquarius', degree: 18, minute: 20 },
      { house: 7, sign: 'Pisces', degree: 19, minute: 59 },
      { house: 8, sign: 'Aries', degree: 22, minute: 31 },
      { house: 9, sign: 'Taurus', degree: 23, minute: 13 },
      { house: 10, sign: 'Gemini', degree: 21, minute: 33 },
      { house: 11, sign: 'Cancer', degree: 19, minute: 12 },
      { house: 12, sign: 'Leo', degree: 18, minute: 20 },
    ],
    aspects: [
      { bodyA: 'sun', bodyB: 'venus', type: 'conjunction', orbDegrees: 1.1667 },
      { bodyA: 'sun', bodyB: 'mars', type: 'conjunction', orbDegrees: 4.5667 },
      { bodyA: 'sun', bodyB: 'uranus', type: 'trine', orbDegrees: 4.2333 },
      { bodyA: 'moon', bodyB: 'neptune', type: 'sextile', orbDegrees: 5.2 },
      { bodyA: 'moon', bodyB: 'pluto', type: 'conjunction', orbDegrees: 0.2333 },
      { bodyA: 'venus', bodyB: 'mars', type: 'conjunction', orbDegrees: 3.4 },
      { bodyA: 'venus', bodyB: 'uranus', type: 'trine', orbDegrees: 5.4 },
      { bodyA: 'jupiter', bodyB: 'saturn', type: 'conjunction', orbDegrees: 1.9 },
      { bodyA: 'jupiter', bodyB: 'uranus', type: 'square', orbDegrees: 6.2 },
      { bodyA: 'saturn', bodyB: 'uranus', type: 'square', orbDegrees: 4.2833 },
    ],
    crossCheck: {
      site: 'astro.com',
      url: 'https://www.astro.com/cgi/ade.cgi?ract=xx68747470733a2f2f7777772e617374726f2e636f6d2f6367692f63686172742e6367693f&lang=e&btyp=w2gw (birth-data entry; result rendered at /cgi/scus.cgi with a session-scoped cid)',
      agrees: true,
      notes:
        "IMPORTANT LIMITATION: astro.com's anonymous/no-account flow only reveals Sun and Moon SIGN ('Ascendant available after registration') — full degrees, Ascendant, MC and houses require creating a free account (email+password), which was deliberately not done for this task. With atlas coords 0°13'S/78°30'W (astro.com's own Quito atlas point, close to but not identical to the 0°11'S/78°28'W used on astro-seek), astro.com showed Sun in Gemini and Moon in Sagittarius, matching astro-seek's sign placements. No degree-level or house-level comparison was possible.",
    },
  },
  {
    label: 'baku-1995',
    input: {
      birthDate: '1995-03-21',
      birthTime: '08:30',
      birthTimeKnown: true,
      latitude: 40.4093,
      longitude: 49.8671,
      timezone: 'Asia/Baku',
    },
    source: {
      site: 'astro-seek.com',
      url: 'https://horoscopes.astro-seek.com/calculate-birth-chart-horoscope-online/?input_natal=1&send_calculation=1&narozeni_den=21&narozeni_mesic=3&narozeni_rok=1995&narozeni_hodina=08&narozeni_minuta=30&narozeni_sekunda=00&narozeni_city=Baku%2C+Azerbaijan&narozeni_mesto_hidden=Baku&narozeni_stat_hidden=AZ&narozeni_podstat_kratky_hidden=&narozeni_tzid_id=211&narozeni_sirka_stupne=40&narozeni_sirka_minuty=25&narozeni_sirka_smer=0&narozeni_delka_stupne=49&narozeni_delka_minuty=52&narozeni_delka_smer=0&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&hid_fortune=1&hid_fortune_check=on&hid_vertex=1&hid_vertex_check=on&hid_chiron=1&hid_chiron_check=on&hid_lilith=1&hid_lilith_check=on&hid_uzel=1&hid_uzel_check=on&tolerance=1&aya=&tolerance_paral=0',
      houseSystem: 'Placidus',
      notes:
        "Autocomplete's default 'Baku' coords (40°23'N,49°54'E) were overridden to 40°25'N, 49°52'E (nearest arcminute to 40.4093/49.8671); auto-detected timezone (tzid=211, Asia/Baku) kept. Site header confirmed: local time 21 March 1995 08:30 (+04), UT 04:30, House system: Placidus system.",
    },
    positions: [
      { body: 'sun', sign: 'Aries', degree: 0, minute: 5, retrograde: false },
      { body: 'moon', sign: 'Scorpio', degree: 24, minute: 56, retrograde: false },
      { body: 'mercury', sign: 'Pisces', degree: 9, minute: 24, retrograde: false },
      { body: 'venus', sign: 'Aquarius', degree: 21, minute: 36, retrograde: false },
      { body: 'mars', sign: 'Leo', degree: 13, minute: 14, retrograde: true },
      { body: 'jupiter', sign: 'Sagittarius', degree: 15, minute: 10, retrograde: false },
      { body: 'saturn', sign: 'Pisces', degree: 16, minute: 51, retrograde: false },
      { body: 'uranus', sign: 'Capricorn', degree: 29, minute: 38, retrograde: false },
      { body: 'neptune', sign: 'Capricorn', degree: 25, minute: 9, retrograde: false },
      { body: 'pluto', sign: 'Sagittarius', degree: 0, minute: 31, retrograde: true },
    ],
    ascendant: { sign: 'Taurus', degree: 11, minute: 28 },
    midheaven: { sign: 'Capricorn', degree: 23, minute: 43 },
    cusps: [
      { house: 1, sign: 'Taurus', degree: 11, minute: 28 },
      { house: 2, sign: 'Gemini', degree: 10, minute: 38 },
      { house: 3, sign: 'Cancer', degree: 2, minute: 34 },
      { house: 4, sign: 'Cancer', degree: 23, minute: 43 },
      { house: 5, sign: 'Leo', degree: 18, minute: 41 },
      { house: 6, sign: 'Virgo', degree: 23, minute: 38 },
      { house: 7, sign: 'Scorpio', degree: 11, minute: 28 },
      { house: 8, sign: 'Sagittarius', degree: 10, minute: 38 },
      { house: 9, sign: 'Capricorn', degree: 2, minute: 34 },
      { house: 10, sign: 'Capricorn', degree: 23, minute: 43 },
      { house: 11, sign: 'Aquarius', degree: 18, minute: 41 },
      { house: 12, sign: 'Pisces', degree: 23, minute: 38 },
    ],
    aspects: [
      { bodyA: 'sun', bodyB: 'moon', type: 'trine', orbDegrees: 5.15 },
      { bodyA: 'sun', bodyB: 'uranus', type: 'sextile', orbDegrees: 0.45 },
      { bodyA: 'sun', bodyB: 'neptune', type: 'sextile', orbDegrees: 4.9167 },
      { bodyA: 'sun', bodyB: 'pluto', type: 'trine', orbDegrees: 0.4167 },
      { bodyA: 'moon', bodyB: 'venus', type: 'square', orbDegrees: 3.3333 },
      { bodyA: 'moon', bodyB: 'saturn', type: 'trine', orbDegrees: 8.0833 },
      { bodyA: 'moon', bodyB: 'uranus', type: 'sextile', orbDegrees: 4.6833 },
      { bodyA: 'moon', bodyB: 'neptune', type: 'sextile', orbDegrees: 0.2167 },
      { bodyA: 'moon', bodyB: 'pluto', type: 'conjunction', orbDegrees: 5.5667 },
      { bodyA: 'mercury', bodyB: 'jupiter', type: 'square', orbDegrees: 5.7667 },
      { bodyA: 'mars', bodyB: 'jupiter', type: 'trine', orbDegrees: 1.9333 },
      { bodyA: 'jupiter', bodyB: 'saturn', type: 'square', orbDegrees: 1.6667 },
      { bodyA: 'uranus', bodyB: 'neptune', type: 'conjunction', orbDegrees: 4.4667 },
      { bodyA: 'uranus', bodyB: 'pluto', type: 'sextile', orbDegrees: 0.8667 },
    ],
  },
  {
    label: 'sydney-1988',
    input: {
      birthDate: '1988-11-02',
      birthTime: '14:15',
      birthTimeKnown: true,
      latitude: -33.8688,
      longitude: 151.2093,
      timezone: 'Australia/Sydney',
    },
    source: {
      site: 'astro-seek.com',
      url: 'https://horoscopes.astro-seek.com/calculate-birth-chart-horoscope-online/?input_natal=1&send_calculation=1&narozeni_den=2&narozeni_mesic=11&narozeni_rok=1988&narozeni_hodina=14&narozeni_minuta=15&narozeni_sekunda=00&narozeni_city=Sydney%2C+Australia%2C+NSW&narozeni_mesto_hidden=Sydney&narozeni_stat_hidden=AU&narozeni_podstat_kratky_hidden=NSW&narozeni_tzid_id=306&narozeni_sirka_stupne=33&narozeni_sirka_minuty=52&narozeni_sirka_smer=1&narozeni_delka_stupne=151&narozeni_delka_minuty=13&narozeni_delka_smer=0&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&hid_fortune=1&hid_fortune_check=on&hid_vertex=1&hid_vertex_check=on&hid_chiron=1&hid_chiron_check=on&hid_lilith=1&hid_lilith_check=on&hid_uzel=1&hid_uzel_check=on&tolerance=1&aya=&tolerance_paral=0',
      houseSystem: 'Placidus',
      notes:
        "Longitude overridden from autocomplete default 151°12'E to 151°13'E (nearest arcminute to 151.2093); latitude 33°52'S matched default exactly. Site header confirmed local time 2 Nov 1988 14:15 (AEDT, DST), UT 03:15 — correctly applies Australian daylight saving for this date. House system: Placidus system.",
    },
    positions: [
      { body: 'sun', sign: 'Scorpio', degree: 9, minute: 55, retrograde: false },
      { body: 'moon', sign: 'Leo', degree: 17, minute: 44, retrograde: false },
      { body: 'mercury', sign: 'Libra', degree: 23, minute: 12, retrograde: false },
      { body: 'venus', sign: 'Libra', degree: 3, minute: 49, retrograde: false },
      { body: 'mars', sign: 'Aries', degree: 0, minute: 2, retrograde: false },
      { body: 'jupiter', sign: 'Gemini', degree: 3, minute: 45, retrograde: true },
      { body: 'saturn', sign: 'Sagittarius', degree: 29, minute: 1, retrograde: false },
      { body: 'uranus', sign: 'Sagittarius', degree: 28, minute: 24, retrograde: false },
      { body: 'neptune', sign: 'Capricorn', degree: 7, minute: 57, retrograde: false },
      { body: 'pluto', sign: 'Scorpio', degree: 12, minute: 24, retrograde: false },
    ],
    ascendant: { sign: 'Pisces', degree: 6, minute: 6 },
    midheaven: { sign: 'Sagittarius', degree: 3, minute: 36 },
    cusps: [
      { house: 1, sign: 'Pisces', degree: 6, minute: 6 },
      { house: 2, sign: 'Aries', degree: 1, minute: 26 },
      { house: 3, sign: 'Taurus', degree: 1, minute: 1 },
      { house: 4, sign: 'Gemini', degree: 3, minute: 36 },
      { house: 5, sign: 'Cancer', degree: 6, minute: 35 },
      { house: 6, sign: 'Leo', degree: 7, minute: 44 },
      { house: 7, sign: 'Virgo', degree: 6, minute: 6 },
      { house: 8, sign: 'Libra', degree: 1, minute: 26 },
      { house: 9, sign: 'Scorpio', degree: 1, minute: 1 },
      { house: 10, sign: 'Sagittarius', degree: 3, minute: 36 },
      { house: 11, sign: 'Capricorn', degree: 6, minute: 35 },
      { house: 12, sign: 'Aquarius', degree: 7, minute: 44 },
    ],
    aspects: [
      { bodyA: 'sun', bodyB: 'moon', type: 'square', orbDegrees: 7.8167 },
      { bodyA: 'sun', bodyB: 'neptune', type: 'sextile', orbDegrees: 1.9667 },
      { bodyA: 'sun', bodyB: 'pluto', type: 'conjunction', orbDegrees: 2.4833 },
      { bodyA: 'moon', bodyB: 'mercury', type: 'sextile', orbDegrees: 5.45 },
      { bodyA: 'moon', bodyB: 'pluto', type: 'square', orbDegrees: 5.3333 },
      { bodyA: 'venus', bodyB: 'mars', type: 'opposition', orbDegrees: 3.7667 },
      { bodyA: 'venus', bodyB: 'jupiter', type: 'trine', orbDegrees: 0.05 },
      { bodyA: 'venus', bodyB: 'saturn', type: 'square', orbDegrees: 4.7833 },
      { bodyA: 'venus', bodyB: 'uranus', type: 'square', orbDegrees: 5.4 },
      { bodyA: 'venus', bodyB: 'neptune', type: 'square', orbDegrees: 4.1333 },
      { bodyA: 'mars', bodyB: 'jupiter', type: 'sextile', orbDegrees: 3.7167 },
      { bodyA: 'mars', bodyB: 'saturn', type: 'square', orbDegrees: 1 },
      { bodyA: 'mars', bodyB: 'uranus', type: 'square', orbDegrees: 1.6167 },
      { bodyA: 'saturn', bodyB: 'uranus', type: 'conjunction', orbDegrees: 0.6 },
    ],
  },
  {
    label: 'reykjavik-1975',
    input: {
      birthDate: '1975-01-10',
      birthTime: '09:00',
      birthTimeKnown: true,
      latitude: 64.1466,
      longitude: -21.9426,
      timezone: 'Atlantic/Reykjavik',
    },
    source: {
      site: 'astro-seek.com',
      url: 'https://horoscopes.astro-seek.com/calculate-birth-chart-horoscope-online/?input_natal=1&send_calculation=1&narozeni_den=10&narozeni_mesic=1&narozeni_rok=1975&narozeni_hodina=09&narozeni_minuta=00&narozeni_sekunda=00&narozeni_city=Reykjav%C3%ADk%2C+Iceland&narozeni_mesto_hidden=Reykjav%C3%ADk&narozeni_stat_hidden=IS&narozeni_podstat_kratky_hidden=&narozeni_tzid_id=291&narozeni_sirka_stupne=64&narozeni_sirka_minuty=9&narozeni_sirka_smer=0&narozeni_delka_stupne=21&narozeni_delka_minuty=57&narozeni_delka_smer=1&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&hid_fortune=1&hid_fortune_check=on&hid_vertex=1&hid_vertex_check=on&hid_chiron=1&hid_chiron_check=on&hid_lilith=1&hid_lilith_check=on&hid_uzel=1&hid_uzel_check=on&tolerance=1&aya=&tolerance_paral=0',
      houseSystem: 'Placidus',
      notes:
        "Manual override to 64°09'N, 21°57'W (nearest arcminute to 64.1466/-21.9426) exactly matched astro-seek's own autocomplete default for Reykjavík, so no discrepancy. Site header confirmed local time 10 Jan 1975 09:00 (GMT), UT 09:00 — Iceland has used UTC+0 year-round (no DST) since 1968.",
    },
    positions: [
      { body: 'sun', sign: 'Capricorn', degree: 19, minute: 29, retrograde: false },
      { body: 'moon', sign: 'Sagittarius', degree: 26, minute: 24, retrograde: false },
      { body: 'mercury', sign: 'Aquarius', degree: 2, minute: 23, retrograde: false },
      { body: 'venus', sign: 'Aquarius', degree: 5, minute: 8, retrograde: false },
      { body: 'mars', sign: 'Sagittarius', degree: 21, minute: 42, retrograde: false },
      { body: 'jupiter', sign: 'Pisces', degree: 14, minute: 58, retrograde: false },
      { body: 'saturn', sign: 'Cancer', degree: 15, minute: 6, retrograde: true },
      { body: 'uranus', sign: 'Scorpio', degree: 2, minute: 8, retrograde: false },
      { body: 'neptune', sign: 'Sagittarius', degree: 10, minute: 44, retrograde: false },
      { body: 'pluto', sign: 'Libra', degree: 9, minute: 15, retrograde: false },
    ],
    ascendant: { sign: 'Sagittarius', degree: 14, minute: 36 },
    midheaven: { sign: 'Scorpio', degree: 14, minute: 46 },
    cusps: [
      { house: 1, sign: 'Sagittarius', degree: 14, minute: 36 },
      { house: 2, sign: 'Aquarius', degree: 15, minute: 4 },
      { house: 3, sign: 'Aries', degree: 18, minute: 59 },
      { house: 4, sign: 'Taurus', degree: 14, minute: 46 },
      { house: 5, sign: 'Taurus', degree: 28, minute: 31 },
      { house: 6, sign: 'Gemini', degree: 7, minute: 37 },
      { house: 7, sign: 'Gemini', degree: 14, minute: 36 },
      { house: 8, sign: 'Leo', degree: 15, minute: 4 },
      { house: 9, sign: 'Libra', degree: 18, minute: 59 },
      { house: 10, sign: 'Scorpio', degree: 14, minute: 46 },
      { house: 11, sign: 'Scorpio', degree: 28, minute: 31 },
      { house: 12, sign: 'Sagittarius', degree: 7, minute: 37 },
    ],
    aspects: [
      { bodyA: 'sun', bodyB: 'jupiter', type: 'sextile', orbDegrees: 4.5167 },
      { bodyA: 'sun', bodyB: 'saturn', type: 'opposition', orbDegrees: 4.3833 },
      { bodyA: 'moon', bodyB: 'mars', type: 'conjunction', orbDegrees: 4.6833 },
      { bodyA: 'mercury', bodyB: 'venus', type: 'conjunction', orbDegrees: 2.75 },
      { bodyA: 'mercury', bodyB: 'uranus', type: 'square', orbDegrees: 0.2333 },
      { bodyA: 'mercury', bodyB: 'pluto', type: 'trine', orbDegrees: 6.8667 },
      { bodyA: 'venus', bodyB: 'uranus', type: 'square', orbDegrees: 2.9833 },
      { bodyA: 'venus', bodyB: 'pluto', type: 'trine', orbDegrees: 4.1167 },
      { bodyA: 'mars', bodyB: 'jupiter', type: 'square', orbDegrees: 6.7333 },
      { bodyA: 'jupiter', bodyB: 'saturn', type: 'trine', orbDegrees: 0.1167 },
      { bodyA: 'jupiter', bodyB: 'neptune', type: 'square', orbDegrees: 4.2333 },
      { bodyA: 'saturn', bodyB: 'pluto', type: 'square', orbDegrees: 5.8333 },
      { bodyA: 'neptune', bodyB: 'pluto', type: 'sextile', orbDegrees: 1.4667 },
    ],
  },
  {
    label: 'tromso-1960',
    input: {
      birthDate: '1960-06-21',
      birthTime: '00:00',
      birthTimeKnown: true,
      latitude: 69.6492,
      longitude: 18.9553,
      timezone: 'Europe/Oslo',
    },
    source: {
      site: 'astro-seek.com',
      url: 'https://horoscopes.astro-seek.com/calculate-birth-chart-horoscope-online/?input_natal=1&send_calculation=1&narozeni_den=21&narozeni_mesic=6&narozeni_rok=1960&narozeni_hodina=00&narozeni_minuta=00&narozeni_sekunda=00&narozeni_city=Troms%C3%B8%2C+Norway&narozeni_mesto_hidden=Troms%C3%B8&narozeni_stat_hidden=NO&narozeni_podstat_kratky_hidden=&narozeni_tzid_id=353&narozeni_sirka_stupne=69&narozeni_sirka_minuty=39&narozeni_sirka_smer=0&narozeni_delka_stupne=18&narozeni_delka_minuty=57&narozeni_delka_smer=0&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&hid_fortune=1&hid_fortune_check=on&hid_vertex=1&hid_vertex_check=on&hid_chiron=1&hid_chiron_check=on&hid_lilith=1&hid_lilith_check=on&hid_uzel=1&hid_uzel_check=on&tolerance=1&aya=&tolerance_paral=0',
      houseSystem: 'Placidus',
      notes:
        "POLAR EDGE CASE (deliberate, Arctic Circle at summer solstice): astro-seek's autocomplete default (69°39'N, 18°57'E) already matched the nearest-arcminute rounding of the given 69.6492/18.9553, so no override was needed. astro-seek showed NO warning, error message, disclaimer, or automatic house-system fallback anywhere on the results page — a full-page text search for 'polar', 'circumpolar', 'warning', 'undefined', 'does not rise/set' etc. returned nothing. It silently computed a full, plausible-looking set of 12 Placidus house cusps. Header confirmed: 'Date of Birth (local time): 21 June 1960 - 00:00 (CEST, DST)', 'Universal Time (UT/GMT): 20 June 1960 - 22:00', House system: Placidus system. Whether these Placidus cusps are numerically well-conditioned at this latitude/date (vs. some ephemeris libraries which flag or refuse Placidus above ~66.5° under certain Sun declinations) could not be independently verified since astro.com's free tier does not expose houses without registration (see crossCheck).",
    },
    positions: [
      { body: 'sun', sign: 'Gemini', degree: 29, minute: 32, retrograde: false },
      { body: 'moon', sign: 'Taurus', degree: 24, minute: 6, retrograde: false },
      { body: 'mercury', sign: 'Cancer', degree: 24, minute: 23, retrograde: false },
      { body: 'venus', sign: 'Gemini', degree: 29, minute: 2, retrograde: false },
      { body: 'mars', sign: 'Taurus', degree: 0, minute: 23, retrograde: false },
      { body: 'jupiter', sign: 'Sagittarius', degree: 28, minute: 37, retrograde: true },
      { body: 'saturn', sign: 'Capricorn', degree: 16, minute: 18, retrograde: true },
      { body: 'uranus', sign: 'Leo', degree: 18, minute: 20, retrograde: false },
      { body: 'neptune', sign: 'Scorpio', degree: 6, minute: 33, retrograde: true },
      { body: 'pluto', sign: 'Virgo', degree: 3, minute: 55, retrograde: false },
    ],
    ascendant: { sign: 'Taurus', degree: 19, minute: 45 },
    midheaven: { sign: 'Sagittarius', degree: 19, minute: 1 },
    cusps: [
      { house: 1, sign: 'Taurus', degree: 19, minute: 45 },
      { house: 2, sign: 'Taurus', degree: 29, minute: 30 },
      { house: 3, sign: 'Gemini', degree: 9, minute: 16 },
      { house: 4, sign: 'Gemini', degree: 19, minute: 1 },
      { house: 5, sign: 'Leo', degree: 9, minute: 16 },
      { house: 6, sign: 'Virgo', degree: 29, minute: 30 },
      { house: 7, sign: 'Scorpio', degree: 19, minute: 45 },
      { house: 8, sign: 'Scorpio', degree: 29, minute: 30 },
      { house: 9, sign: 'Sagittarius', degree: 9, minute: 16 },
      { house: 10, sign: 'Sagittarius', degree: 19, minute: 1 },
      { house: 11, sign: 'Aquarius', degree: 9, minute: 16 },
      { house: 12, sign: 'Pisces', degree: 29, minute: 30 },
    ],
    aspects: [
      { bodyA: 'sun', bodyB: 'venus', type: 'conjunction', orbDegrees: 0.4833 },
      { bodyA: 'sun', bodyB: 'mars', type: 'sextile', orbDegrees: 0.85 },
      { bodyA: 'sun', bodyB: 'jupiter', type: 'opposition', orbDegrees: 0.9 },
      { bodyA: 'sun', bodyB: 'neptune', type: 'trine', orbDegrees: 7.0167 },
      { bodyA: 'sun', bodyB: 'pluto', type: 'sextile', orbDegrees: 4.3833 },
      { bodyA: 'moon', bodyB: 'mercury', type: 'sextile', orbDegrees: 0.2667 },
      { bodyA: 'moon', bodyB: 'saturn', type: 'trine', orbDegrees: 7.7833 },
      { bodyA: 'moon', bodyB: 'uranus', type: 'square', orbDegrees: 5.7667 },
      { bodyA: 'moon', bodyB: 'pluto', type: 'square', orbDegrees: 9.8167 },
      { bodyA: 'mercury', bodyB: 'mars', type: 'square', orbDegrees: 6 },
      { bodyA: 'venus', bodyB: 'mars', type: 'sextile', orbDegrees: 1.3333 },
      { bodyA: 'venus', bodyB: 'jupiter', type: 'opposition', orbDegrees: 0.4167 },
      { bodyA: 'mars', bodyB: 'jupiter', type: 'trine', orbDegrees: 1.75 },
      { bodyA: 'mars', bodyB: 'neptune', type: 'opposition', orbDegrees: 6.15 },
      { bodyA: 'mars', bodyB: 'pluto', type: 'trine', orbDegrees: 3.5167 },
      { bodyA: 'jupiter', bodyB: 'pluto', type: 'trine', orbDegrees: 5.2833 },
      { bodyA: 'neptune', bodyB: 'pluto', type: 'sextile', orbDegrees: 2.6333 },
    ],
    crossCheck: {
      site: 'astro.com',
      url: 'https://www.astro.com/cgi/ade.cgi?ract=xx68747470733a2f2f7777772e617374726f2e636f6d2f6367692f63686172742e6367693f&lang=e&btyp=w2gw (birth-data entry; result at /cgi/scus.cgi)',
      agrees: true,
      notes:
        "Same registration limitation as scenario 1: only Sun/Moon sign visible without an account. astro.com (atlas point 69°40'N, 18°58'E) showed Sun in Gemini, Moon in Taurus, matching astro-seek's sign placements. Could NOT verify whether astro.com's Placidus house computation shows any special handling for this polar/circumpolar case, since houses are gated behind free registration, which was not performed.",
    },
    knownDeviations: {
      fields: ['positions', 'houses'],
      reason:
        "astro-seek assumed Norway observed DST ('CEST') for this 1960-06-21 00:00 birth, resolving to UT 1960-06-20T22:00Z. Norway ran no DST between 1945 and 1980, so the historically correct offset is UTC+1 (CET) -- UT 1960-06-20T23:00Z -- which is what this package's geo-tz/luxon resolution gives. The resulting ~1 hour gap moves every body by an amount proportional to its speed -- negligible for the outer planets, but enough to push the Moon (our fastest body) off by roughly half a degree and Venus/Mercury by a few arcminutes, past this suite's tolerance -- so the whole `positions` degree-level comparison is skipped for this scenario (retrograde flags, which don't flip in an hour, are still checked). Every body matches within a couple of arcminutes once the correct UT is used, consistent with this fixture's other scenarios. Separately, and independently of the DST question, this scenario is inside the Arctic Circle at the summer solstice: astro-seek silently returned a full Placidus house set with no warning, while this package correctly detects Placidus is undefined here and falls back to Whole Sign (see issue #14) -- so a house-system comparison would not be meaningful regardless of the DST issue.",
    },
  },
  {
    label: 'paris-1885',
    input: {
      birthDate: '1885-09-23',
      birthTime: '07:45',
      birthTimeKnown: true,
      latitude: 48.8566,
      longitude: 2.3522,
      timezone: 'Europe/Paris',
    },
    source: {
      site: 'astro-seek.com',
      url: 'https://horoscopes.astro-seek.com/calculate-birth-chart-horoscope-online/?input_natal=1&send_calculation=1&narozeni_den=23&narozeni_mesic=9&narozeni_rok=1885&narozeni_hodina=07&narozeni_minuta=45&narozeni_sekunda=00&narozeni_city=Paris%2C+France&narozeni_mesto_hidden=Paris&narozeni_stat_hidden=FR&narozeni_podstat_kratky_hidden=&narozeni_tzid_id=354&narozeni_sirka_stupne=48&narozeni_sirka_minuty=51&narozeni_sirka_smer=0&narozeni_delka_stupne=2&narozeni_delka_minuty=21&narozeni_delka_smer=0&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&hid_fortune=1&hid_fortune_check=on&hid_vertex=1&hid_vertex_check=on&hid_chiron=1&hid_chiron_check=on&hid_lilith=1&hid_lilith_check=on&hid_uzel=1&hid_uzel_check=on&tolerance=1&aya=&tolerance_paral=0',
      houseSystem: 'Placidus',
      notes:
        "PRE-1900 / LMT VERIFICATION: astro-seek's autocomplete default (48°51'N, 2°21'E) exactly matched the given coordinates, no override needed. Site header explicitly reads: 'Date of Birth (local time): 23 September 1885 - 07:45:00 ( LMT )' and 'Universal Time (UT/GMT): 23 September 1885 - 07:35:36 (-0:09:24h)'. This is a genuine, longitude-derived Local Mean Time correction (2°21'E × 4 min/degree ≈ 9m24s ahead of UT), not a static modern CET (+1:00) offset — confirming astro-seek is applying true historical/LMT handling for this pre-standard-time-zone French date (France did not adopt GMT-based standard time until 1911). House system: Placidus system.",
    },
    positions: [
      { body: 'sun', sign: 'Libra', degree: 0, minute: 25, retrograde: false },
      { body: 'moon', sign: 'Pisces', degree: 18, minute: 34, retrograde: false },
      { body: 'mercury', sign: 'Virgo', degree: 13, minute: 39, retrograde: false },
      { body: 'venus', sign: 'Scorpio', degree: 7, minute: 2, retrograde: false },
      { body: 'mars', sign: 'Leo', degree: 3, minute: 54, retrograde: false },
      { body: 'jupiter', sign: 'Virgo', degree: 19, minute: 28, retrograde: false },
      { body: 'saturn', sign: 'Cancer', degree: 7, minute: 43, retrograde: false },
      { body: 'uranus', sign: 'Libra', degree: 3, minute: 8, retrograde: false },
      { body: 'neptune', sign: 'Taurus', degree: 25, minute: 25, retrograde: true },
      { body: 'pluto', sign: 'Gemini', degree: 3, minute: 2, retrograde: true },
    ],
    ascendant: { sign: 'Libra', degree: 20, minute: 45 },
    midheaven: { sign: 'Cancer', degree: 26, minute: 32 },
    cusps: [
      { house: 1, sign: 'Libra', degree: 20, minute: 45 },
      { house: 2, sign: 'Scorpio', degree: 17, minute: 21 },
      { house: 3, sign: 'Sagittarius', degree: 19, minute: 44 },
      { house: 4, sign: 'Capricorn', degree: 26, minute: 32 },
      { house: 5, sign: 'Pisces', degree: 0, minute: 52 },
      { house: 6, sign: 'Pisces', degree: 28, minute: 49 },
      { house: 7, sign: 'Aries', degree: 20, minute: 45 },
      { house: 8, sign: 'Taurus', degree: 17, minute: 21 },
      { house: 9, sign: 'Gemini', degree: 19, minute: 44 },
      { house: 10, sign: 'Cancer', degree: 26, minute: 32 },
      { house: 11, sign: 'Virgo', degree: 0, minute: 52 },
      { house: 12, sign: 'Virgo', degree: 28, minute: 49 },
    ],
    aspects: [
      { bodyA: 'sun', bodyB: 'mars', type: 'sextile', orbDegrees: 3.4833 },
      { bodyA: 'sun', bodyB: 'saturn', type: 'square', orbDegrees: 7.2833 },
      { bodyA: 'sun', bodyB: 'uranus', type: 'conjunction', orbDegrees: 2.7167 },
      { bodyA: 'sun', bodyB: 'neptune', type: 'trine', orbDegrees: 4.9833 },
      { bodyA: 'sun', bodyB: 'pluto', type: 'trine', orbDegrees: 2.6167 },
      { bodyA: 'moon', bodyB: 'mercury', type: 'opposition', orbDegrees: 4.9 },
      { bodyA: 'moon', bodyB: 'jupiter', type: 'opposition', orbDegrees: 0.8833 },
      { bodyA: 'mercury', bodyB: 'jupiter', type: 'conjunction', orbDegrees: 5.8 },
      { bodyA: 'venus', bodyB: 'mars', type: 'square', orbDegrees: 3.1333 },
      { bodyA: 'venus', bodyB: 'saturn', type: 'trine', orbDegrees: 0.6667 },
      { bodyA: 'mars', bodyB: 'uranus', type: 'sextile', orbDegrees: 0.75 },
      { bodyA: 'mars', bodyB: 'pluto', type: 'sextile', orbDegrees: 0.85 },
      { bodyA: 'jupiter', bodyB: 'neptune', type: 'trine', orbDegrees: 5.9333 },
      { bodyA: 'saturn', bodyB: 'uranus', type: 'square', orbDegrees: 4.5667 },
      { bodyA: 'uranus', bodyB: 'pluto', type: 'trine', orbDegrees: 0.1 },
    ],
    crossCheck: {
      site: 'astro.com',
      url: 'https://www.astro.com/cgi/ade.cgi?ract=xx68747470733a2f2f7777772e617374726f2e636f6d2f6367692f63686172742e6367693f&lang=e&btyp=w2gw (birth-data entry; result at /cgi/scus.cgi)',
      agrees: true,
      notes:
        "Same registration limitation: only sign-level data visible for free. astro.com (atlas point 48°52'N, 2°20'E, vs. 48°51'N/2°21'E used on astro-seek) showed Sun in Libra, Moon in Pisces, matching astro-seek's signs. Could not independently verify astro.com's LMT/historical-timezone handling for 1885 Paris, or compare exact degrees/houses, without registering an account.",
    },
  },
  {
    label: 'buenosaires-1920',
    input: {
      birthDate: '1920-12-01',
      birthTime: '18:20',
      birthTimeKnown: true,
      latitude: -34.6037,
      longitude: -58.3816,
      timezone: 'America/Argentina/Buenos_Aires',
    },
    source: {
      site: 'astro-seek.com',
      url: 'https://horoscopes.astro-seek.com/calculate-birth-chart-horoscope-online/?input_natal=1&send_calculation=1&narozeni_den=1&narozeni_mesic=12&narozeni_rok=1920&narozeni_hodina=18&narozeni_minuta=20&narozeni_sekunda=00&narozeni_city=Buenos+Aires%2C+Argentina&narozeni_mesto_hidden=Buenos+Aires&narozeni_stat_hidden=AR&narozeni_podstat_kratky_hidden=&narozeni_tzid_id=59&narozeni_sirka_stupne=34&narozeni_sirka_minuty=36&narozeni_sirka_smer=1&narozeni_delka_stupne=58&narozeni_delka_minuty=23&narozeni_delka_smer=1&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&hid_fortune=1&hid_fortune_check=on&hid_vertex=1&hid_vertex_check=on&hid_chiron=1&hid_chiron_check=on&hid_lilith=1&hid_lilith_check=on&hid_uzel=1&hid_uzel_check=on&tolerance=1&aya=&tolerance_paral=0',
      houseSystem: 'Placidus',
      notes:
        "Longitude overridden from autocomplete default 58°27'W to 58°23'W (nearest arcminute to -58.3816); latitude 34°36'S matched default. Site header confirmed local time 1 Dec 1920 18:20 (-04), UT 22:20. House system: Placidus system.",
    },
    positions: [
      { body: 'sun', sign: 'Sagittarius', degree: 9, minute: 27, retrograde: false },
      { body: 'moon', sign: 'Leo', degree: 29, minute: 45, retrograde: false },
      { body: 'mercury', sign: 'Scorpio', degree: 19, minute: 11, retrograde: false },
      { body: 'venus', sign: 'Capricorn', degree: 17, minute: 15, retrograde: false },
      { body: 'mars', sign: 'Aquarius', degree: 3, minute: 21, retrograde: false },
      { body: 'jupiter', sign: 'Virgo', degree: 17, minute: 14, retrograde: false },
      { body: 'saturn', sign: 'Virgo', degree: 23, minute: 47, retrograde: false },
      { body: 'uranus', sign: 'Pisces', degree: 1, minute: 55, retrograde: false },
      { body: 'neptune', sign: 'Leo', degree: 13, minute: 41, retrograde: true },
      { body: 'pluto', sign: 'Cancer', degree: 8, minute: 24, retrograde: true },
    ],
    ascendant: { sign: 'Gemini', degree: 3, minute: 47 },
    midheaven: { sign: 'Pisces', degree: 15, minute: 57 },
    cusps: [
      { house: 1, sign: 'Gemini', degree: 3, minute: 47 },
      { house: 2, sign: 'Cancer', degree: 5, minute: 4 },
      { house: 3, sign: 'Leo', degree: 10, minute: 24 },
      { house: 4, sign: 'Virgo', degree: 15, minute: 57 },
      { house: 5, sign: 'Libra', degree: 16, minute: 52 },
      { house: 6, sign: 'Scorpio', degree: 12, minute: 10 },
      { house: 7, sign: 'Sagittarius', degree: 3, minute: 47 },
      { house: 8, sign: 'Capricorn', degree: 5, minute: 4 },
      { house: 9, sign: 'Aquarius', degree: 10, minute: 24 },
      { house: 10, sign: 'Pisces', degree: 15, minute: 57 },
      { house: 11, sign: 'Aries', degree: 16, minute: 52 },
      { house: 12, sign: 'Taurus', degree: 12, minute: 10 },
    ],
    aspects: [
      { bodyA: 'sun', bodyB: 'moon', type: 'square', orbDegrees: 9.6833 },
      { bodyA: 'sun', bodyB: 'jupiter', type: 'square', orbDegrees: 7.7833 },
      { bodyA: 'sun', bodyB: 'uranus', type: 'square', orbDegrees: 7.5167 },
      { bodyA: 'sun', bodyB: 'neptune', type: 'trine', orbDegrees: 4.2333 },
      { bodyA: 'moon', bodyB: 'uranus', type: 'opposition', orbDegrees: 2.1667 },
      { bodyA: 'mercury', bodyB: 'venus', type: 'sextile', orbDegrees: 1.9167 },
      { bodyA: 'mercury', bodyB: 'jupiter', type: 'sextile', orbDegrees: 1.95 },
      { bodyA: 'mercury', bodyB: 'neptune', type: 'square', orbDegrees: 5.4833 },
      { bodyA: 'venus', bodyB: 'jupiter', type: 'trine', orbDegrees: 0.0167 },
      { bodyA: 'venus', bodyB: 'saturn', type: 'trine', orbDegrees: 6.5167 },
      { bodyA: 'jupiter', bodyB: 'saturn', type: 'conjunction', orbDegrees: 6.55 },
      { bodyA: 'uranus', bodyB: 'pluto', type: 'trine', orbDegrees: 6.4667 },
    ],
  },
  {
    label: 'newyork-1955',
    input: {
      birthDate: '1955-07-04',
      birthTime: '16:00',
      birthTimeKnown: true,
      latitude: 40.7128,
      longitude: -74.006,
      timezone: 'America/New_York',
    },
    source: {
      site: 'astro-seek.com',
      url: 'https://horoscopes.astro-seek.com/calculate-birth-chart-horoscope-online/?input_natal=1&send_calculation=1&narozeni_den=4&narozeni_mesic=7&narozeni_rok=1955&narozeni_hodina=16&narozeni_minuta=00&narozeni_sekunda=00&narozeni_city=New+York%2C+USA%2C+New+York&narozeni_mesto_hidden=New+York&narozeni_stat_hidden=US&narozeni_podstat_kratky_hidden=NY&narozeni_tzid_id=156&narozeni_sirka_stupne=40&narozeni_sirka_minuty=43&narozeni_sirka_smer=0&narozeni_delka_stupne=74&narozeni_delka_minuty=0&narozeni_delka_smer=1&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&hid_fortune=1&hid_fortune_check=on&hid_vertex=1&hid_vertex_check=on&hid_chiron=1&hid_chiron_check=on&hid_lilith=1&hid_lilith_check=on&hid_uzel=1&hid_uzel_check=on&tolerance=1&aya=&tolerance_paral=0',
      houseSystem: 'Placidus',
      notes:
        "Coordinates matched astro-seek's own city-picker default exactly (40°43'N, 74°00'W; the 'New York, USA, New York' autocomplete entry was selected specifically, distinguishing it from same-named towns in Iowa/Missouri/Florida/Kentucky/Texas/New Mexico also offered). Site header confirmed local time 4 July 1955 16:00 (EDT, DST), UT 20:00. House system: Placidus system.",
    },
    positions: [
      { body: 'sun', sign: 'Cancer', degree: 12, minute: 3, retrograde: false },
      { body: 'moon', sign: 'Capricorn', degree: 7, minute: 42, retrograde: false },
      { body: 'mercury', sign: 'Gemini', degree: 22, minute: 3, retrograde: false },
      { body: 'venus', sign: 'Gemini', degree: 26, minute: 7, retrograde: false },
      { body: 'mars', sign: 'Cancer', degree: 25, minute: 47, retrograde: false },
      { body: 'jupiter', sign: 'Leo', degree: 4, minute: 27, retrograde: false },
      { body: 'saturn', sign: 'Scorpio', degree: 14, minute: 40, retrograde: true },
      { body: 'uranus', sign: 'Cancer', degree: 26, minute: 57, retrograde: false },
      { body: 'neptune', sign: 'Libra', degree: 25, minute: 28, retrograde: true },
      { body: 'pluto', sign: 'Leo', degree: 25, minute: 5, retrograde: false },
    ],
    ascendant: { sign: 'Scorpio', degree: 15, minute: 42 },
    midheaven: { sign: 'Leo', degree: 25, minute: 47 },
    cusps: [
      { house: 1, sign: 'Scorpio', degree: 15, minute: 42 },
      { house: 2, sign: 'Sagittarius', degree: 15, minute: 17 },
      { house: 3, sign: 'Capricorn', degree: 19, minute: 39 },
      { house: 4, sign: 'Aquarius', degree: 25, minute: 47 },
      { house: 5, sign: 'Pisces', degree: 28, minute: 6 },
      { house: 6, sign: 'Aries', degree: 24, minute: 21 },
      { house: 7, sign: 'Taurus', degree: 15, minute: 42 },
      { house: 8, sign: 'Gemini', degree: 15, minute: 17 },
      { house: 9, sign: 'Cancer', degree: 19, minute: 39 },
      { house: 10, sign: 'Leo', degree: 25, minute: 47 },
      { house: 11, sign: 'Virgo', degree: 28, minute: 6 },
      { house: 12, sign: 'Libra', degree: 24, minute: 21 },
    ],
    aspects: [
      { bodyA: 'sun', bodyB: 'moon', type: 'opposition', orbDegrees: 4.35 },
      { bodyA: 'sun', bodyB: 'saturn', type: 'trine', orbDegrees: 2.6 },
      { bodyA: 'mercury', bodyB: 'venus', type: 'conjunction', orbDegrees: 4.05 },
      { bodyA: 'mercury', bodyB: 'neptune', type: 'trine', orbDegrees: 3.4 },
      { bodyA: 'mercury', bodyB: 'pluto', type: 'sextile', orbDegrees: 3.0167 },
      { bodyA: 'venus', bodyB: 'neptune', type: 'trine', orbDegrees: 0.65 },
      { bodyA: 'venus', bodyB: 'pluto', type: 'sextile', orbDegrees: 1.0333 },
      { bodyA: 'mars', bodyB: 'uranus', type: 'conjunction', orbDegrees: 1.1667 },
      { bodyA: 'mars', bodyB: 'neptune', type: 'square', orbDegrees: 0.3167 },
      { bodyA: 'uranus', bodyB: 'neptune', type: 'square', orbDegrees: 1.4833 },
      { bodyA: 'neptune', bodyB: 'pluto', type: 'sextile', orbDegrees: 0.3667 },
    ],
  },
  {
    label: 'ushuaia-2010',
    input: {
      birthDate: '2010-02-14',
      birthTime: '11:30',
      birthTimeKnown: true,
      latitude: -54.8019,
      longitude: -68.303,
      timezone: 'America/Argentina/Ushuaia',
    },
    source: {
      site: 'astro-seek.com',
      url: 'https://horoscopes.astro-seek.com/calculate-birth-chart-horoscope-online/?input_natal=1&send_calculation=1&narozeni_den=14&narozeni_mesic=2&narozeni_rok=2010&narozeni_hodina=11&narozeni_minuta=30&narozeni_sekunda=00&narozeni_city=Ushuaia%2C+Argentina&narozeni_mesto_hidden=Ushuaia&narozeni_stat_hidden=AR&narozeni_podstat_kratky_hidden=&narozeni_tzid_id=70&narozeni_sirka_stupne=54&narozeni_sirka_minuty=48&narozeni_sirka_smer=1&narozeni_delka_stupne=68&narozeni_delka_minuty=18&narozeni_delka_smer=1&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&hid_fortune=1&hid_fortune_check=on&hid_vertex=1&hid_vertex_check=on&hid_chiron=1&hid_chiron_check=on&hid_lilith=1&hid_lilith_check=on&hid_uzel=1&hid_uzel_check=on&tolerance=1&aya=&tolerance_paral=0',
      houseSystem: 'Placidus',
      notes:
        "Coordinates matched astro-seek's autocomplete default exactly (54°48'S, 68°18'W). Site header confirmed local time 14 Feb 2010 11:30 (-03), UT 14:30. House system: Placidus system. (Ushuaia is also a high-southern-latitude location, ~54.8°S, but well below the polar circle so no edge-case behavior expected or observed.)",
    },
    positions: [
      { body: 'sun', sign: 'Aquarius', degree: 25, minute: 47, retrograde: false },
      { body: 'moon', sign: 'Pisces', degree: 1, minute: 2, retrograde: false },
      { body: 'mercury', sign: 'Aquarius', degree: 6, minute: 6, retrograde: false },
      { body: 'venus', sign: 'Pisces', degree: 3, minute: 52, retrograde: false },
      { body: 'mars', sign: 'Leo', degree: 4, minute: 1, retrograde: true },
      { body: 'jupiter', sign: 'Pisces', degree: 6, minute: 23, retrograde: false },
      { body: 'saturn', sign: 'Libra', degree: 3, minute: 45, retrograde: true },
      { body: 'uranus', sign: 'Pisces', degree: 24, minute: 52, retrograde: false },
      { body: 'neptune', sign: 'Aquarius', degree: 26, minute: 8, retrograde: false },
      { body: 'pluto', sign: 'Capricorn', degree: 4, minute: 44, retrograde: false },
    ],
    ascendant: { sign: 'Aries', degree: 15, minute: 58 },
    midheaven: { sign: 'Capricorn', degree: 21, minute: 56 },
    cusps: [
      { house: 1, sign: 'Aries', degree: 15, minute: 58 },
      { house: 2, sign: 'Taurus', degree: 11, minute: 4 },
      { house: 3, sign: 'Gemini', degree: 13, minute: 12 },
      { house: 4, sign: 'Cancer', degree: 21, minute: 56 },
      { house: 5, sign: 'Leo', degree: 27, minute: 31 },
      { house: 6, sign: 'Virgo', degree: 25, minute: 8 },
      { house: 7, sign: 'Libra', degree: 15, minute: 58 },
      { house: 8, sign: 'Scorpio', degree: 11, minute: 4 },
      { house: 9, sign: 'Sagittarius', degree: 13, minute: 12 },
      { house: 10, sign: 'Capricorn', degree: 21, minute: 56 },
      { house: 11, sign: 'Aquarius', degree: 27, minute: 31 },
      { house: 12, sign: 'Pisces', degree: 25, minute: 8 },
    ],
    aspects: [
      { bodyA: 'sun', bodyB: 'moon', type: 'conjunction', orbDegrees: 5.25 },
      { bodyA: 'sun', bodyB: 'venus', type: 'conjunction', orbDegrees: 8.0833 },
      { bodyA: 'sun', bodyB: 'neptune', type: 'conjunction', orbDegrees: 0.35 },
      { bodyA: 'moon', bodyB: 'venus', type: 'conjunction', orbDegrees: 2.8167 },
      { bodyA: 'moon', bodyB: 'jupiter', type: 'conjunction', orbDegrees: 5.35 },
      { bodyA: 'moon', bodyB: 'neptune', type: 'conjunction', orbDegrees: 4.9 },
      { bodyA: 'moon', bodyB: 'pluto', type: 'sextile', orbDegrees: 3.6833 },
      { bodyA: 'mercury', bodyB: 'mars', type: 'opposition', orbDegrees: 2.0833 },
      { bodyA: 'mercury', bodyB: 'saturn', type: 'trine', orbDegrees: 2.3333 },
      { bodyA: 'venus', bodyB: 'jupiter', type: 'conjunction', orbDegrees: 2.5167 },
      { bodyA: 'venus', bodyB: 'pluto', type: 'sextile', orbDegrees: 0.85 },
      { bodyA: 'mars', bodyB: 'saturn', type: 'sextile', orbDegrees: 0.25 },
      { bodyA: 'jupiter', bodyB: 'pluto', type: 'sextile', orbDegrees: 1.65 },
      { bodyA: 'saturn', bodyB: 'pluto', type: 'square', orbDegrees: 0.9667 },
    ],
  },
  {
    label: 'tokyo-2005',
    input: {
      birthDate: '2005-08-08',
      birthTime: '03:20',
      birthTimeKnown: true,
      latitude: 35.6762,
      longitude: 139.6503,
      timezone: 'Asia/Tokyo',
    },
    source: {
      site: 'astro-seek.com',
      url: 'https://horoscopes.astro-seek.com/calculate-birth-chart-horoscope-online/?input_natal=1&send_calculation=1&narozeni_den=8&narozeni_mesic=8&narozeni_rok=2005&narozeni_hodina=03&narozeni_minuta=20&narozeni_sekunda=00&narozeni_city=Tokyo%2C+Japan&narozeni_mesto_hidden=Tokyo&narozeni_stat_hidden=JP&narozeni_podstat_kratky_hidden=&narozeni_tzid_id=275&narozeni_sirka_stupne=35&narozeni_sirka_minuty=41&narozeni_sirka_smer=0&narozeni_delka_stupne=139&narozeni_delka_minuty=39&narozeni_delka_smer=0&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&hid_fortune=1&hid_fortune_check=on&hid_vertex=1&hid_vertex_check=on&hid_chiron=1&hid_chiron_check=on&hid_lilith=1&hid_lilith_check=on&hid_uzel=1&hid_uzel_check=on&tolerance=1&aya=&tolerance_paral=0',
      houseSystem: 'Placidus',
      notes:
        "Longitude overridden from autocomplete default 139°42'E to 139°39'E (nearest arcminute to 139.6503); latitude 35°41'N matched default. Site header confirmed local time 8 Aug 2005 03:20 (JST), UT 7 Aug 2005 18:20. House system: Placidus system. Japan has no DST, so JST (+09:00) applies year-round.",
    },
    positions: [
      { body: 'sun', sign: 'Leo', degree: 15, minute: 19, retrograde: false },
      { body: 'moon', sign: 'Virgo', degree: 14, minute: 5, retrograde: false },
      { body: 'mercury', sign: 'Leo', degree: 12, minute: 17, retrograde: true },
      { body: 'venus', sign: 'Virgo', degree: 18, minute: 51, retrograde: false },
      { body: 'mars', sign: 'Taurus', degree: 5, minute: 55, retrograde: false },
      { body: 'jupiter', sign: 'Libra', degree: 14, minute: 19, retrograde: false },
      { body: 'saturn', sign: 'Leo', degree: 2, minute: 51, retrograde: false },
      { body: 'uranus', sign: 'Pisces', degree: 9, minute: 43, retrograde: true },
      { body: 'neptune', sign: 'Aquarius', degree: 16, minute: 13, retrograde: true },
      { body: 'pluto', sign: 'Sagittarius', degree: 21, minute: 59, retrograde: true },
    ],
    ascendant: { sign: 'Cancer', degree: 25, minute: 9 },
    midheaven: { sign: 'Aries', degree: 11, minute: 58 },
    cusps: [
      { house: 1, sign: 'Cancer', degree: 25, minute: 9 },
      { house: 2, sign: 'Leo', degree: 16, minute: 26 },
      { house: 3, sign: 'Virgo', degree: 11, minute: 20 },
      { house: 4, sign: 'Libra', degree: 11, minute: 58 },
      { house: 5, sign: 'Scorpio', degree: 17, minute: 44 },
      { house: 6, sign: 'Sagittarius', degree: 23, minute: 35 },
      { house: 7, sign: 'Capricorn', degree: 25, minute: 9 },
      { house: 8, sign: 'Aquarius', degree: 16, minute: 26 },
      { house: 9, sign: 'Pisces', degree: 11, minute: 20 },
      { house: 10, sign: 'Aries', degree: 11, minute: 58 },
      { house: 11, sign: 'Taurus', degree: 17, minute: 44 },
      { house: 12, sign: 'Gemini', degree: 23, minute: 35 },
    ],
    aspects: [
      { bodyA: 'sun', bodyB: 'mercury', type: 'conjunction', orbDegrees: 3.0333 },
      { bodyA: 'sun', bodyB: 'mars', type: 'square', orbDegrees: 9.4 },
      { bodyA: 'sun', bodyB: 'jupiter', type: 'sextile', orbDegrees: 1 },
      { bodyA: 'sun', bodyB: 'neptune', type: 'opposition', orbDegrees: 0.8833 },
      { bodyA: 'sun', bodyB: 'pluto', type: 'trine', orbDegrees: 6.65 },
      { bodyA: 'moon', bodyB: 'venus', type: 'conjunction', orbDegrees: 4.75 },
      { bodyA: 'moon', bodyB: 'mars', type: 'trine', orbDegrees: 8.1667 },
      { bodyA: 'moon', bodyB: 'uranus', type: 'opposition', orbDegrees: 4.3667 },
      { bodyA: 'moon', bodyB: 'pluto', type: 'square', orbDegrees: 7.8833 },
      { bodyA: 'mercury', bodyB: 'mars', type: 'square', orbDegrees: 6.35 },
      { bodyA: 'mercury', bodyB: 'jupiter', type: 'sextile', orbDegrees: 2.0167 },
      { bodyA: 'mercury', bodyB: 'neptune', type: 'opposition', orbDegrees: 3.9333 },
      { bodyA: 'venus', bodyB: 'pluto', type: 'square', orbDegrees: 3.1333 },
      { bodyA: 'mars', bodyB: 'saturn', type: 'square', orbDegrees: 3.05 },
      { bodyA: 'mars', bodyB: 'uranus', type: 'sextile', orbDegrees: 3.7833 },
    ],
  },
];
