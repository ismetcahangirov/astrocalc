import { listInterpretationSubjects, SUPPORTED_LOCALES } from '@astrocalc/calc-engine';
import { describe, expect, it } from 'vitest';
import { generateSeedInterpretations } from './seedContent';

function rowId(row: { category: string; subjectKey: string; locale: string }): string {
  return `${row.category}:${row.subjectKey}:${row.locale}`;
}

describe('generateSeedInterpretations', () => {
  const rows = generateSeedInterpretations();
  const required = listInterpretationSubjects().flatMap((subject) =>
    SUPPORTED_LOCALES.map((locale) => ({ ...subject, locale })),
  );

  it('produces exactly one row per (category, subjectKey, locale) listInterpretationSubjects() requires', () => {
    const generatedIds = new Set(rows.map(rowId));
    const requiredIds = new Set(required.map(rowId));
    expect(generatedIds.size).toBe(rows.length); // no duplicates generated
    expect(generatedIds).toEqual(requiredIds);
  });

  it('has 2,600 rows: 650 subjects x 4 locales (465 astrology + 185 numerology)', () => {
    expect(required.length).toBe(650 * 4);
    expect(rows.length).toBe(650 * 4);
  });

  it('covers all 185 numerology subjects, 4 locales each', () => {
    const numerology = rows.filter((r) => r.category === 'numerology');
    expect(numerology.length).toBe(185 * 4);
    expect(new Set(numerology.map((r) => r.subjectKey)).size).toBe(185);
  });

  it('every row has substantial, non-placeholder content', () => {
    for (const row of rows) {
      expect(row.content.length).toBeGreaterThanOrEqual(40);
      expect(row.content.trim()).toBe(row.content);
    }
  });

  it('the four locales produce genuinely different text for the same subject', () => {
    const bySubject = new Map<string, Map<string, string>>();
    for (const row of rows) {
      const key = `${row.category}:${row.subjectKey}`;
      if (!bySubject.has(key)) bySubject.set(key, new Map());
      bySubject.get(key)!.set(row.locale, row.content);
    }
    for (const [, byLocale] of bySubject) {
      const contents = [...byLocale.values()];
      expect(new Set(contents).size).toBe(contents.length);
    }
  });

  it('produces a legible planet-sign example', () => {
    const row = rows.find(
      (r) => r.category === 'planet-sign' && r.subjectKey === 'sun-Aries' && r.locale === 'en',
    );
    expect(row?.content).toBe(
      'The Sun relates to your core identity, willpower, and vitality. ' +
        'Placed in Aries, this comes across as bold, direct, and quick to act.',
    );
  });

  it('produces a legible planet-house example', () => {
    const row = rows.find(
      (r) => r.category === 'planet-house' && r.subjectKey === 'moon-4' && r.locale === 'ru',
    );
    expect(row?.content).toBe(
      'Планета Луна связана с вашими эмоциональными инстинктами, внутренними потребностями ' +
        'и чувством безопасности. Дом 4: здесь это проявляется через дом, семью и ваши ' +
        'эмоциональные основы.',
    );
  });

  it('produces a legible aspect example, alphabetically ordered like aspectSubjectKey', () => {
    const row = rows.find(
      (r) => r.category === 'aspect' && r.subjectKey === 'trine-mars-venus' && r.locale === 'tr',
    );
    expect(row?.content).toContain('Mars ve Venüs bir üçgen oluşturur');
    expect(row?.content.startsWith('Mars')).toBe(true); // alphabetical, like the subjectKey itself
  });

  const numerologyRow = (subjectKey: string, locale: string) =>
    rows.find(
      (r) => r.category === 'numerology' && r.subjectKey === subjectKey && r.locale === locale,
    )?.content;

  it('produces a legible numerology core-four example', () => {
    expect(numerologyRow('life-path-1', 'en')).toBe(
      'Your Life Path number is 1. It marks the central direction your whole life is ' +
        'organized around, and here that shows up as independence, initiative, and the will to lead.',
    );
  });

  it('produces a challenge example where 0 is a genuine value', () => {
    expect(numerologyRow('challenge-1-0', 'en')).toBe(
      'Your first Challenge number is 0. It names the main inner obstacle of your early years, ' +
        'and the growth lies in learning to find your own footing when no single influence points the way.',
    );
  });

  it('produces a birthday example (compound day, RU)', () => {
    expect(numerologyRow('birthday-22', 'ru')).toBe(
      'Число Дня Рождения — 22. Оно указывает на особый талант, с которым вы уже родились. ' +
        'Это видение и основательность мастера-строителя.',
    );
  });

  it('reads the same number differently in different positions', () => {
    // Same value 7, same number-meaning phrase, but the position frame differs —
    // the whole point of writing per position rather than once per number.
    const firstPinnacle = numerologyRow('pinnacle-1-7', 'en');
    const fourthPinnacle = numerologyRow('pinnacle-4-7', 'en');
    const personalYear = numerologyRow('personal-year-7', 'en');
    expect(firstPinnacle).not.toBe(fourthPinnacle);
    expect(firstPinnacle).toContain('opening stage of life');
    expect(fourthPinnacle).toContain('final stage of life');
    // The shared number-meaning phrase is present in every position, though.
    for (const content of [firstPinnacle, fourthPinnacle, personalYear]) {
      expect(content).toContain('analysis, introspection, and a search for deeper truth');
    }
  });

  it('writes numerology text in all four locales for a subject, all different', () => {
    const byLocale = SUPPORTED_LOCALES.map((locale) => numerologyRow('soul-urge-11', locale));
    expect(byLocale.every((c) => typeof c === 'string' && c.length >= 40)).toBe(true);
    expect(new Set(byLocale).size).toBe(SUPPORTED_LOCALES.length);
  });
});
