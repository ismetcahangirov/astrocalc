import { describe, expect, it } from 'vitest';
import { computeAncestralSquare } from './ancestral';
import { computeCoreSquare } from './core';
import { computePurposes } from './purposes';
import { isArcana } from './reduce';

function purposesFor(birthDate: string) {
  const core = computeCoreSquare(birthDate);
  return computePurposes(core, computeAncestralSquare(core));
}

describe('computePurposes', () => {
  it('builds sky from the bottom vertex, not from the centre', () => {
    // 1990-11-22: month 11, sum 7, centre 14. sky = 11+7 = 18.
    // Using the centre instead would give 11+14 = 25 -> 7 — a plausible-looking
    // wrong answer, and the confusion is easy to make because the centre also
    // sits on the vertical axis when the octagram is drawn.
    expect(purposesFor('1990-11-22').sky).toBe(18);
  });

  it('builds earth from the horizontal axis', () => {
    // day 22 + year 19 = 41 -> 5
    expect(purposesFor('1990-11-22').earth).toBe(5);
  });

  it('chains personal, social, spiritual and planetary in order', () => {
    const p = purposesFor('1990-11-22');
    expect(p.personal).toBe(5); // sky 18 + earth 5 = 23 -> 5
    expect(p.social).toBe(10); // paternal 14 + maternal 14 = 28 -> 10
    expect(p.spiritual).toBe(15); // personal 5 + social 10 = 15
    expect(p.planetary).toBe(7); // social 10 + spiritual 15 = 25 -> 7
  });

  it('never produces 1, 2 or 13 for the social purpose', () => {
    // A published structural constraint, and a genuinely independent check on
    // the social-purpose formula: it holds for `paternal + maternal` and would
    // be violated by most plausible mis-derivations.
    for (let year = 1900; year <= 2030; year++) {
      for (let month = 1; month <= 12; month++) {
        for (const day of [1, 9, 17, 28]) {
          const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const { social } = purposesFor(iso);
          expect([1, 2, 13], `${iso} -> social ${social}`).not.toContain(social);
        }
      }
    }
  });

  it('produces only valid arcana across an exhaustive sweep', () => {
    for (let year = 1900; year <= 2030; year++) {
      for (const [month, day] of [
        [2, 28],
        [7, 22],
        [11, 30],
      ] as const) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        for (const [name, value] of Object.entries(purposesFor(iso))) {
          expect(isArcana(value), `${iso} ${name} = ${value}`).toBe(true);
        }
      }
    }
  });
});
