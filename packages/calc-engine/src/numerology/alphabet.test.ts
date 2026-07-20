import { describe, expect, it } from 'vitest';
import { CalcEngineError } from '../errors';
import { letterValue, nameLetters, romanize, splitVowelsAndConsonants } from './alphabet';

describe('romanize', () => {
  it('folds Azerbaijani diacritics to their base Latin letter', () => {
    expect(romanize('Əliyev Çingiz')).toBe('ELIYEV CINGIZ');
    expect(romanize('Gülşən Öztürk')).toBe('GULSEN OZTURK');
    expect(romanize('Ağayev')).toBe('AGAYEV');
  });

  it('folds Turkish dotted and dotless I to the same letter', () => {
    expect(romanize('İsmayıl')).toBe('ISMAYIL');
  });

  it('transliterates Cyrillic to Latin', () => {
    expect(romanize('Иванов')).toBe('IVANOV');
    expect(romanize('Щербак')).toBe('SHCHERBAK');
  });

  it('uppercases and preserves separators for later stripping', () => {
    expect(romanize("anna-maria o'neil")).toBe("ANNA-MARIA O'NEIL");
  });
});

describe('nameLetters', () => {
  it('keeps only A-Z, dropping spaces, hyphens, apostrophes and digits', () => {
    expect(nameLetters("Anna-Maria O'Neil 3rd")).toEqual('ANNAMARIAONEILRD'.split(''));
  });

  it('rejects a name with no usable letters', () => {
    expect(() => nameLetters('   ')).toThrow(CalcEngineError);
    expect(() => nameLetters('123')).toThrow(CalcEngineError);
  });
});

describe('letterValue', () => {
  it('maps letters by the Pythagorean table', () => {
    expect([letterValue('A'), letterValue('J'), letterValue('S')]).toEqual([1, 1, 1]);
    expect([letterValue('I'), letterValue('R')]).toEqual([9, 9]);
    expect(letterValue('H')).toBe(8);
  });

  it('covers all 26 letters with values in 1-9', () => {
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(65 + i);
      const value = letterValue(letter);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(9);
    }
  });

  it('rejects a non-letter', () => {
    expect(() => letterValue('1')).toThrow(CalcEngineError);
    expect(() => letterValue('a')).toThrow(CalcEngineError);
  });
});

describe('splitVowelsAndConsonants', () => {
  it('treats AEIOU as vowels', () => {
    const { vowels, consonants } = splitVowelsAndConsonants('MARIA'.split(''));
    expect(vowels).toEqual(['A', 'I', 'A']);
    expect(consonants).toEqual(['M', 'R']);
  });

  it('counts Y as a vowel when it is not adjacent to another vowel', () => {
    // KYLIE: Y sits between K and L, both consonants.
    expect(splitVowelsAndConsonants('KYLIE'.split('')).vowels).toEqual(['Y', 'I', 'E']);
  });

  it('counts Y as a consonant when it is adjacent to a vowel', () => {
    // AYLA: Y follows the vowel A.
    expect(splitVowelsAndConsonants('AYLA'.split('')).consonants).toEqual(['Y', 'L']);
    // YUSIF: Y precedes the vowel U.
    expect(splitVowelsAndConsonants('YUSIF'.split('')).consonants).toEqual(['Y', 'S', 'F']);
  });

  it('partitions every letter into exactly one bucket', () => {
    const letters = 'MEHRIBANYAGUBOVA'.split('');
    const { vowels, consonants } = splitVowelsAndConsonants(letters);
    expect(vowels.length + consonants.length).toBe(letters.length);
  });

  it('handles an empty list', () => {
    expect(splitVowelsAndConsonants([])).toEqual({ vowels: [], consonants: [] });
  });
});
