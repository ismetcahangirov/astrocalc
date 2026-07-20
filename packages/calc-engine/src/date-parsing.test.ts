import { describe, expect, it } from 'vitest';
import { CalcEngineError } from './errors';
import { parseIsoDate } from './date-parsing';

describe('parseIsoDate', () => {
  it('parses a well-formed date into numeric parts', () => {
    expect(parseIsoDate('1990-03-07')).toEqual({ year: 1990, month: 3, day: 7 });
  });

  it('rejects a malformed or out-of-range date', () => {
    for (const bad of ['1990-3-7', '07.03.1990', '1990-13-01', '1990-02-30', '']) {
      expect(() => parseIsoDate(bad)).toThrow(CalcEngineError);
    }
  });

  it('accepts a real leap day and rejects a fake one', () => {
    expect(parseIsoDate('2024-02-29').day).toBe(29);
    expect(() => parseIsoDate('2023-02-29')).toThrow(CalcEngineError);
  });

  it('applies the full Gregorian leap rule at century boundaries', () => {
    expect(parseIsoDate('2000-02-29').day).toBe(29);
    expect(() => parseIsoDate('1900-02-29')).toThrow(CalcEngineError);
  });

  it('rejects day zero and month zero', () => {
    expect(() => parseIsoDate('1990-00-10')).toThrow(CalcEngineError);
    expect(() => parseIsoDate('1990-03-00')).toThrow(CalcEngineError);
  });
});
