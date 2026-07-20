import { describe, expect, it } from 'vitest';
import { computeDestinyMatrix, CHAKRA_ORDER } from '@astrocalc/calc-engine';
import { formatMatrixDetails } from './matrixText';
import type { Locale } from '../i18n/translations';

/** 1990-11-22: day 22, month 11, year 19, sum 7, centre 14; corners 6/3/8/11. */
const MATRIX = computeDestinyMatrix({ birthDate: '1990-11-22' });
const LOCALES: Locale[] = ['en', 'az'];

describe('formatMatrixDetails', () => {
  it('renders the core square in figure order with its arcana', () => {
    const details = formatMatrixDetails(MATRIX, 'en');
    expect(details.core.map((r) => [r.key, r.value])).toEqual([
      ['day', '22'],
      ['month', '11'],
      ['year', '19'],
      ['sum', '7'],
      ['centre', '14'],
    ]);
  });

  it('renders the ancestral square, both parental lines and the ancestral centre', () => {
    const details = formatMatrixDetails(MATRIX, 'en');
    const byKey = Object.fromEntries(details.ancestral.map((r) => [r.key, r.value]));

    expect(byKey.paternalSpiritual).toBe('6'); // NW
    expect(byKey.maternalSpiritual).toBe('3'); // NE
    expect(byKey.paternalMaterial).toBe('8'); // SE
    expect(byKey.maternalMaterial).toBe('11'); // SW
    expect(byKey.paternalLine).toBe('14');
    expect(byKey.maternalLine).toBe('14');
    expect(byKey.ancestralCentre).toBe('10');
  });

  it('renders all six purposes', () => {
    const details = formatMatrixDetails(MATRIX, 'en');
    expect(details.purposes.map((r) => r.key)).toEqual([
      'sky',
      'earth',
      'personal',
      'social',
      'spiritual',
      'planetary',
    ]);
    expect(details.purposes.find((r) => r.key === 'spiritual')!.value).toBe('15');
  });

  it('renders the money/relationship line in LINE order, not struct order', () => {
    // The list should read along the line as it is drawn — entry at one end,
    // partner at the other, core in the middle — so a reader can follow it.
    const details = formatMatrixDetails(MATRIX, 'en');
    expect(details.moneyAndRelationships.map((r) => r.key)).toEqual([
      'entry',
      'toEntry',
      'lineCore',
      'toPartner',
      'partner',
    ]);
    expect(details.moneyAndRelationships.map((r) => r.value)).toEqual(['21', '3', '9', '15', '6']);
  });

  it('renders all seven chakras crown to root with three cells each', () => {
    const details = formatMatrixDetails(MATRIX, 'en');
    expect(details.health.map((r) => r.key)).toEqual([...CHAKRA_ORDER]);
    for (const row of details.health) {
      for (const cell of [row.physical, row.energy, row.emotional]) {
        expect(cell).toMatch(/^\d{1,2}$/);
      }
    }
  });

  it.each(LOCALES)('gives every row a non-empty label in %s', (locale) => {
    const details = formatMatrixDetails(MATRIX, locale);
    const rows = [
      ...details.core,
      ...details.ancestral,
      ...details.purposes,
      ...details.moneyAndRelationships,
      ...details.health,
    ];
    for (const row of rows) {
      expect(row.label.trim(), `${locale} ${row.key}`).not.toBe('');
    }
  });

  it('actually translates rather than falling back to English', () => {
    const en = formatMatrixDetails(MATRIX, 'en');
    const az = formatMatrixDetails(MATRIX, 'az');
    expect(az.core[0]!.label).not.toBe(en.core[0]!.label);
    expect(az.purposes[0]!.label).not.toBe(en.purposes[0]!.label);
  });

  it('keeps values locale-independent', () => {
    // Only labels are localized; an arcana is a number in every language.
    const en = formatMatrixDetails(MATRIX, 'en');
    const az = formatMatrixDetails(MATRIX, 'az');
    expect(az.core.map((r) => r.value)).toEqual(en.core.map((r) => r.value));
  });

  it.each(LOCALES)('gives every row a unique key in %s', (locale) => {
    const details = formatMatrixDetails(MATRIX, locale);
    for (const group of [
      details.core,
      details.ancestral,
      details.purposes,
      details.moneyAndRelationships,
      details.health,
    ]) {
      const keys = group.map((r) => r.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});
