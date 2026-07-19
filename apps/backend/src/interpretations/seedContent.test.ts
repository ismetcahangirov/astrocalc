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

  it('has 1,860 rows: 465 subjects x 4 locales', () => {
    expect(required.length).toBe(465 * 4);
    expect(rows.length).toBe(465 * 4);
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
});
