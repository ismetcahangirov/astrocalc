import { describe, expect, it } from 'vitest';
import { azUpperCase, normalizeAzSearchKey } from './azLocale';

describe('azUpperCase', () => {
  it('uppercases dotted lowercase i to dotted İ (not ASCII I)', () => {
    expect(azUpperCase('i')).toBe('İ');
  });

  it('uppercases dotless ı to ASCII I', () => {
    expect(azUpperCase('ı')).toBe('I');
  });

  it('reproduces the classic "dotless i" bug when NOT locale-aware, and fixes it when it is', () => {
    const stored = 'İmişli'; // real Azerbaijan rayon, correctly spelled with dotted İ
    const query = 'imişli'; // user typing on a plain keyboard

    // Naive, locale-unaware folding: the leading İ survives unchanged while the
    // query's lowercase i defaults to ASCII I — the two never compare equal.
    expect(stored.toUpperCase()).not.toBe(query.toUpperCase());

    // Locale-aware folding maps both leading letters to İ, so they match.
    expect(azUpperCase(stored)).toBe(azUpperCase(query));
  });
});

describe('normalizeAzSearchKey', () => {
  it('trims and collapses internal whitespace', () => {
    expect(normalizeAzSearchKey('  Bakı   şəhəri  ')).toBe('BAKI ŞƏHƏRİ');
  });

  it('produces the same key for case variants of the same Azerbaijani name', () => {
    expect(normalizeAzSearchKey('Naxçıvan')).toBe(normalizeAzSearchKey('NAXÇIVAN'));
    expect(normalizeAzSearchKey('Şəki')).toBe(normalizeAzSearchKey('şəki'));
  });
});
