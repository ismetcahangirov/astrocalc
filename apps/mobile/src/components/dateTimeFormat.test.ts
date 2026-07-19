import { describe, expect, it } from 'vitest';
import {
  formatDisplayDate,
  formatIsoDate,
  formatTime,
  parseIsoDate,
  parseTime,
  timeToDate,
} from './dateTimeFormat';

describe('parseIsoDate', () => {
  it('parses a valid ISO date to local Y/M/D', () => {
    const d = parseIsoDate('1990-05-12');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(1990);
    expect(d!.getMonth()).toBe(4); // May (0-based)
    expect(d!.getDate()).toBe(12);
  });

  it('rejects malformed and out-of-range dates', () => {
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate('1990-5-12')).toBeNull();
    expect(parseIsoDate('1990-13-01')).toBeNull();
    expect(parseIsoDate('1990-02-30')).toBeNull(); // calendar overflow
    expect(parseIsoDate('not-a-date')).toBeNull();
  });
});

describe('formatIsoDate', () => {
  it('formats local calendar fields back to YYYY-MM-DD', () => {
    expect(formatIsoDate(new Date(1990, 4, 12, 12, 0, 0))).toBe('1990-05-12');
    expect(formatIsoDate(new Date(2001, 0, 3, 0, 0, 0))).toBe('2001-01-03');
  });

  it('round-trips with parseIsoDate', () => {
    expect(formatIsoDate(parseIsoDate('2023-11-09')!)).toBe('2023-11-09');
  });
});

describe('formatDisplayDate', () => {
  it('reformats ISO to DD.MM.YYYY', () => {
    expect(formatDisplayDate('1990-05-12')).toBe('12.05.1990');
  });

  it('returns the input unchanged when not a valid ISO date', () => {
    expect(formatDisplayDate('')).toBe('');
    expect(formatDisplayDate('whatever')).toBe('whatever');
  });
});

describe('parseTime', () => {
  it('parses valid HH:mm', () => {
    expect(parseTime('10:30')).toEqual({ hours: 10, minutes: 30 });
    expect(parseTime('00:00')).toEqual({ hours: 0, minutes: 0 });
    expect(parseTime('23:59')).toEqual({ hours: 23, minutes: 59 });
  });

  it('rejects malformed or out-of-range times', () => {
    expect(parseTime('')).toBeNull();
    expect(parseTime('9:30')).toBeNull();
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('10:60')).toBeNull();
  });
});

describe('formatTime', () => {
  it('formats local clock fields to HH:mm', () => {
    expect(formatTime(new Date(2000, 0, 1, 9, 5))).toBe('09:05');
    expect(formatTime(new Date(2000, 0, 1, 23, 59))).toBe('23:59');
  });
});

describe('timeToDate', () => {
  const base = new Date(2020, 5, 15, 8, 0, 0);

  it('applies HH:mm onto the base day', () => {
    const d = timeToDate('14:45', base);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(45);
    expect(d.getDate()).toBe(15);
  });

  it('keeps the base time when the value is empty or malformed', () => {
    expect(formatTime(timeToDate('', base))).toBe('08:00');
    expect(formatTime(timeToDate('nope', base))).toBe('08:00');
  });
});
