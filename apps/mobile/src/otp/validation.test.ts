import { describe, expect, it } from 'vitest';
import { formatCountdown, isValidCode, isValidPhone, normalizePhoneInput } from './validation';

describe('normalizePhoneInput', () => {
  it('strips spaces, dashes, parens and dots', () => {
    expect(normalizePhoneInput(' +1 (555) 123-4567 ')).toBe('+15551234567');
    expect(normalizePhoneInput('+994.50.123.45.67')).toBe('+994501234567');
  });
});

describe('isValidPhone', () => {
  it('accepts a plausible E.164 number, formatted or not', () => {
    expect(isValidPhone('+15551234567')).toBe(true);
    expect(isValidPhone('+1 (555) 123-4567')).toBe(true);
  });

  it('rejects numbers missing the leading +', () => {
    expect(isValidPhone('15551234567')).toBe(false);
  });

  it('rejects a leading zero after the country-code +', () => {
    expect(isValidPhone('+0123456789')).toBe(false);
  });

  it('rejects numbers that are too short or too long', () => {
    expect(isValidPhone('+1234567')).toBe(false);
    expect(isValidPhone('+1234567890123456')).toBe(false);
  });
});

describe('isValidCode', () => {
  it('accepts exactly `length` digits', () => {
    expect(isValidCode('123456', 6)).toBe(true);
  });

  it('rejects the wrong length', () => {
    expect(isValidCode('12345', 6)).toBe(false);
    expect(isValidCode('1234567', 6)).toBe(false);
  });

  it('rejects non-digit characters', () => {
    expect(isValidCode('12a456', 6)).toBe(false);
  });

  it('tolerates surrounding whitespace', () => {
    expect(isValidCode('  123456  ', 6)).toBe(true);
  });
});

describe('formatCountdown', () => {
  it('formats seconds as m:ss', () => {
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(5)).toBe('0:05');
    expect(formatCountdown(125)).toBe('2:05');
  });

  it('clamps negative values to zero', () => {
    expect(formatCountdown(-5)).toBe('0:00');
  });

  it('rounds up fractional seconds', () => {
    expect(formatCountdown(4.2)).toBe('0:05');
  });
});
