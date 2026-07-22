import type {
  NumerologyNumber,
  NumerologyNumberKind,
  NumerologyProfile,
} from '@astrocalc/calc-engine';
import { numerologySubjectKey } from '@astrocalc/calc-engine';
import type { Locale } from '../i18n/translations';

/**
 * Turns a computed {@link NumerologyProfile} into localized, human-readable rows
 * for the on-screen numerology breakdown — the core numbers, the extended and
 * cycle numbers, and the two four-part life cycles — shown above the
 * (separately-fetched) interpretation text.
 *
 * Like `chart/chartText.ts`, this uses **names**, never symbols: the list is
 * rendered with React Native `Text` in the system font. Pure and locale-driven,
 * so it unit-tests without React.
 */

/** Row labels for the fixed set of numbers, per locale. */
const NUMBER_LABELS: Record<
  Locale,
  {
    lifePath: string;
    expression: string;
    soulUrge: string;
    personality: string;
    birthday: string;
    maturity: string;
    personalYear: string;
    personalMonth: string;
  }
> = {
  en: {
    lifePath: 'Life Path',
    expression: 'Expression',
    soulUrge: 'Soul Urge',
    personality: 'Personality',
    birthday: 'Birthday',
    maturity: 'Maturity',
    personalYear: 'Personal Year',
    personalMonth: 'Personal Month',
  },
  az: {
    lifePath: 'Həyat Yolu',
    expression: 'İfadə',
    soulUrge: 'Ruh Arzusu',
    personality: 'Şəxsiyyət',
    birthday: 'Doğum Günü',
    maturity: 'Yetkinlik',
    personalYear: 'Şəxsi İl',
    personalMonth: 'Şəxsi Ay',
  },
};

/** Maps each `NUMBER_LABELS` key to its `numerologySubjectKey` kind. */
const NUMBER_KEY_TO_KIND: Record<keyof typeof NUMBER_LABELS.en, NumerologyNumberKind> = {
  lifePath: 'life-path',
  expression: 'expression',
  soulUrge: 'soul-urge',
  personality: 'personality',
  birthday: 'birthday',
  maturity: 'maturity',
  personalYear: 'personal-year',
  personalMonth: 'personal-month',
};

export interface NumerologyRow {
  key: string;
  label: string;
  /** The number, as a string. */
  value: string;
  /** Localized "master number" / "karmic debt 19", or null. */
  badge: string | null;
  /** Interpretation key for this number, e.g. `life-path-11`. */
  subjectKey: string;
}

export interface NumerologyPeriodRow {
  key: string;
  label: string;
  value: string;
  /**
   * Localized "master number" / "karmic debt 13", or null — same provenance the
   * core rows carry. Always `null` for Challenges, which are plain 0–8
   * subtractions with no master or karmic-debt concept; that is an absence in
   * the domain, not an omission here.
   */
  badge: string | null;
  /** e.g. `0–34`, or `53+` for the open-ended final period. */
  ageRange: string;
  isCurrent: boolean;
  /** Interpretation key for this period, e.g. `pinnacle-1-6`. */
  subjectKey: string;
}

export interface NumerologyDetails {
  core: NumerologyRow[];
  extended: NumerologyRow[];
  cycles: NumerologyRow[];
  pinnacles: NumerologyPeriodRow[];
  challenges: NumerologyPeriodRow[];
}

/**
 * The already-translated strings the formatter needs. Passed in rather than
 * pulled from `t()` — the same trick `formatChartDetails` uses — so this module
 * stays pure and free of the i18n runtime.
 */
export interface NumerologyLabels {
  /** Badge for an unreduced master number, e.g. `'master number'`. */
  master: string;
  /**
   * Badge *template* for a karmic debt: the formatter appends the debt number,
   * so `'karmic debt'` becomes `'karmic debt 19'`.
   */
  karmicDebt: string;
  /** Period name for the Pinnacles, numbered by the formatter: `'Pinnacle 1'`. */
  pinnacle: string;
  /** Period name for the Challenges, numbered by the formatter: `'Challenge 1'`. */
  challenge: string;
}

/**
 * The badge a number carries, or `null`. Master and karmic debt are mutually
 * exclusive in practice — a master number is never reduced, so nothing was
 * passed through on the way down — and master wins if both were ever set.
 */
function badgeFor(number: NumerologyNumber, labels: NumerologyLabels): string | null {
  if (number.isMaster) return labels.master;
  if (number.karmicDebt != null) return `${labels.karmicDebt} ${number.karmicDebt}`;
  return null;
}

/** `0`/`34` → `0–34`; an absent end age → `53+`. */
function formatAgeRange(startAge: number, endAge: number | null): string {
  return endAge == null ? `${startAge}+` : `${startAge}–${endAge}`;
}

/** Build the localized detail rows for a numerology profile. */
export function formatNumerologyDetails(
  profile: NumerologyProfile,
  locale: Locale,
  labels: NumerologyLabels,
): NumerologyDetails {
  const names = NUMBER_LABELS[locale];

  const row = (key: keyof typeof NUMBER_LABELS.en, number: NumerologyNumber): NumerologyRow => ({
    key,
    label: names[key],
    value: String(number.value),
    badge: badgeFor(number, labels),
    subjectKey: numerologySubjectKey(NUMBER_KEY_TO_KIND[key], number.value),
  });

  /** A number with no master/karmic-debt provenance to report (birthday, cycles). */
  const plainRow = (key: keyof typeof NUMBER_LABELS.en, value: number): NumerologyRow => ({
    key,
    label: names[key],
    value: String(value),
    badge: null,
    subjectKey: numerologySubjectKey(NUMBER_KEY_TO_KIND[key], value),
  });

  return {
    core: [
      row('lifePath', profile.lifePath),
      row('expression', profile.expression),
      row('soulUrge', profile.soulUrge),
      row('personality', profile.personality),
    ],
    extended: [plainRow('birthday', profile.birthday), row('maturity', profile.maturity)],
    cycles: [
      plainRow('personalYear', profile.personalYear),
      plainRow('personalMonth', profile.personalMonth),
    ],
    pinnacles: profile.pinnacles.map((p) => ({
      key: `pinnacle-${p.index}`,
      label: `${labels.pinnacle} ${p.index}`,
      value: String(p.number.value),
      badge: badgeFor(p.number, labels),
      ageRange: formatAgeRange(p.startAge, p.endAge),
      isCurrent: p.index === profile.currentPinnacle,
      subjectKey: numerologySubjectKey(`pinnacle-${p.index}`, p.number.value),
    })),
    challenges: profile.challenges.map((c) => ({
      key: `challenge-${c.index}`,
      label: `${labels.challenge} ${c.index}`,
      value: String(c.value),
      // Challenges are plain 0–8 values: no master numbers, no karmic debt.
      badge: null,
      ageRange: formatAgeRange(c.startAge, c.endAge),
      isCurrent: c.index === profile.currentChallenge,
      subjectKey: numerologySubjectKey(`challenge-${c.index}`, c.value),
    })),
  };
}
