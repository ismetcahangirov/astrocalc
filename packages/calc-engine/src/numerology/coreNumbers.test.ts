import { describe, expect, it } from 'vitest';
import { CalcEngineError } from '../errors';
import {
  expressionNumber,
  lifePathNumber,
  nameSums,
  personalityNumber,
  soulUrgeNumber,
} from './coreNumbers';

describe('lifePathNumber', () => {
  it('reduces month, day and year separately, then sums', () => {
    // 1990-03-07: month 3, day 7, year 1990 -> 19 -> 10 -> 1.
    // 3 + 7 + 1 = 11 -> master, preserved.
    expect(lifePathNumber('1990-03-07')).toEqual({
      value: 11,
      isMaster: true,
      karmicDebt: null,
    });
  });

  it('records karmic debt arising from the component sum', () => {
    // 1969-12-31: month 12 -> 3, day 31 -> 4, year 1969 -> 25 -> 7.
    // 3 + 4 + 7 = 14 -> debt 14 -> 5.
    expect(lifePathNumber('1969-12-31')).toEqual({
      value: 5,
      isMaster: false,
      karmicDebt: 14,
    });
  });

  it('reduces to a plain single digit when no master or debt is involved', () => {
    // 2000-01-02: month 1, day 2, year 2000 -> 2. 1 + 2 + 2 = 5.
    expect(lifePathNumber('2000-01-02')).toEqual({
      value: 5,
      isMaster: false,
      karmicDebt: null,
    });
  });

  it('does not leak a component-level karmic debt into the result', () => {
    // The year 1990 passes through 19 (a debt number) on its way to 1, but that
    // debt belongs to the component, not to the Life Path. Only a debt in the
    // final sum counts - see the 1969-12-31 case above.
    expect(lifePathNumber('1990-03-07').karmicDebt).toBeNull();
  });

  it('rejects a malformed date', () => {
    expect(() => lifePathNumber('07.03.1990')).toThrow(CalcEngineError);
  });
});

describe('expressionNumber', () => {
  it('values every letter of the full name', () => {
    // JOHN = J1 O6 H8 N5 = 20; SMITH = S1 M4 I9 T2 H8 = 24; total 44 -> 8.
    expect(expressionNumber('John Smith')).toEqual({
      value: 8,
      isMaster: false,
      karmicDebt: null,
    });
  });

  it('is unaffected by case, spacing and punctuation', () => {
    expect(expressionNumber('john  smith')).toEqual(expressionNumber('JOHN SMITH'));
  });

  it('gives an Azerbaijani name the same value as its romanization', () => {
    expect(expressionNumber('Çingiz')).toEqual(expressionNumber('Cingiz'));
  });

  it('rejects a name with no letters', () => {
    expect(() => expressionNumber('  ')).toThrow(CalcEngineError);
  });
});

describe('soulUrgeNumber', () => {
  it('values only the vowels', () => {
    // JOHN SMITH vowels: O6 I9 = 15 -> 6.
    expect(soulUrgeNumber('John Smith')).toEqual({
      value: 6,
      isMaster: false,
      karmicDebt: null,
    });
  });
});

describe('personalityNumber', () => {
  it('values only the consonants', () => {
    // JOHN SMITH consonants: J1 H8 N5 S1 M4 T2 H8 = 29 -> 11, master.
    expect(personalityNumber('John Smith')).toEqual({
      value: 11,
      isMaster: true,
      karmicDebt: null,
    });
  });
});

describe('nameSums', () => {
  it('partitions the letter sum into vowels and consonants', () => {
    // Not an identity of the reduced values - reduction is lossy - but the
    // underlying letter sums must partition exactly, which is what catches a
    // vowel/consonant classification bug.
    for (const name of ['Mehriban Yaqubova', 'John Smith', 'Kylie Ayla Yusif']) {
      const { letterSum, vowelSum, consonantSum } = nameSums(name);
      expect(vowelSum + consonantSum).toBe(letterSum);
    }
  });

  it('agrees with the three name-derived numbers', () => {
    const sums = nameSums('Mehriban Yaqubova');
    expect(expressionNumber('Mehriban Yaqubova').value).toBe(reduceForTest(sums.letterSum));
    expect(soulUrgeNumber('Mehriban Yaqubova').value).toBe(reduceForTest(sums.vowelSum));
    expect(personalityNumber('Mehriban Yaqubova').value).toBe(reduceForTest(sums.consonantSum));
  });
});

// Local helper so the test does not silently mirror the implementation's import.
function reduceForTest(sum: number): number {
  let n = sum;
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
    n = String(n)
      .split('')
      .reduce((total, d) => total + Number(d), 0);
  }
  return n;
}
