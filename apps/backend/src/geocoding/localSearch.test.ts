import { describe, expect, it } from 'vitest';
import { searchAzCities } from './localSearch';

describe('searchAzCities', () => {
  it('finds an exact-name match', () => {
    const results = searchAzCities('Bakı');
    expect(results[0]).toMatchObject({ id: 'baku', name: 'Bakı', source: 'az-local' });
  });

  it('matches case-insensitively using Azerbaijani locale rules (dotless-i safe)', () => {
    const results = searchAzCities('imişli'); // lowercase ASCII i, real name starts with dotted İ
    expect(results.some((r) => r.id === 'imishli')).toBe(true);
  });

  it('matches common English aliases/transliterations', () => {
    const results = searchAzCities('Sheki');
    expect(results.some((r) => r.id === 'shaki')).toBe(true);
  });

  it('ranks exact/prefix matches above mere substring matches', () => {
    const results = searchAzCities('Qax'); // exact for Qax, but also a substring of nothing else relevant
    expect(results[0]?.id).toBe('qakh');
  });

  it('returns an empty array for a query with no match (manual fallback territory)', () => {
    expect(searchAzCities('Zzzznotaplace')).toEqual([]);
  });

  it('returns an empty array for a blank query', () => {
    expect(searchAzCities('   ')).toEqual([]);
  });

  it('respects the limit', () => {
    const results = searchAzCities('a', 3); // "a" substring-matches many AZ names
    expect(results.length).toBeLessThanOrEqual(3);
  });
});
