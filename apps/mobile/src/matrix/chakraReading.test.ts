import { describe, expect, it } from 'vitest';
import { computeDestinyMatrix, CHAKRA_ORDER } from '@astrocalc/calc-engine';
import { chakraReadingSubjects, orderChakraReadings } from './chakraReading';

/** 1990-11-22: day 22, month 11 → Sahasrara physical 22, energy 11, emotional 6. */
const MATRIX = computeDestinyMatrix({ birthDate: '1990-11-22' });

describe('chakraReadingSubjects', () => {
  it('produces one subject per chakra, crown to root', () => {
    expect(chakraReadingSubjects(MATRIX).map((s) => s.chakra)).toEqual([...CHAKRA_ORDER]);
  });

  it('keys each chakra on its emotional (synthesis) cell, not physical or energy', () => {
    const subjects = chakraReadingSubjects(MATRIX);
    for (let i = 0; i < subjects.length; i++) {
      const row = MATRIX.health[i]!;
      expect(subjects[i]!.subjectKey).toBe(`chakra-${row.chakra}-${row.emotional}`);
    }
  });

  it('reads Sahasrara from its emotional arcana (6), not physical (22) or energy (11)', () => {
    // A concrete guard that "emotional" is the cell chosen — all three differ here.
    const sahasrara = chakraReadingSubjects(MATRIX).find((s) => s.chakra === 'sahasrara')!;
    expect(sahasrara.subjectKey).toBe('chakra-sahasrara-6');
  });
});

describe('orderChakraReadings', () => {
  it('matches fetched text back to chakras in health-map order', () => {
    const subjects = chakraReadingSubjects(MATRIX);
    const content = new Map(subjects.map((s) => [s.subjectKey, `text-${s.subjectKey}`]));

    const readings = orderChakraReadings(MATRIX, content);

    expect(readings.map((r) => r.chakra)).toEqual([...CHAKRA_ORDER]);
    for (const [i, subject] of subjects.entries()) {
      // Keyed by subjectKey (not index) so a date where two chakras share an
      // emotional arcana — and therefore one reading — still asserts correctly.
      expect(readings[i]!.content).toBe(`text-${subject.subjectKey}`);
    }
  });

  it('drops chakras the batch returned no content for, keeping the rest in order', () => {
    const subjects = chakraReadingSubjects(MATRIX);
    const content = new Map(subjects.map((s) => [s.subjectKey, `text-${s.subjectKey}`]));
    const missingKey = subjects[2]!.subjectKey;
    content.delete(missingKey);

    const readings = orderChakraReadings(MATRIX, content);

    const expected = subjects.filter((s) => content.has(s.subjectKey));
    expect(readings.map((r) => r.chakra)).toEqual(expected.map((s) => s.chakra));
  });

  it('returns nothing when no content is available', () => {
    expect(orderChakraReadings(MATRIX, new Map())).toEqual([]);
  });
});
