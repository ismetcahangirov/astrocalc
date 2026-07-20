import { describe, expect, it } from 'vitest';
import { computeAncestralSquare } from './ancestral';
import { computeCoreSquare } from './core';
import { isArcana, sumArcana } from './reduce';

/** 1990-11-22: day 22, month 11, year 19, sum 7, centre 14. */
const CORE = computeCoreSquare('1990-11-22');

describe('computeAncestralSquare', () => {
  it('builds each corner from the two cardinal points it sits between', () => {
    const square = computeAncestralSquare(CORE);
    expect(square.paternalSpiritual.corner).toBe(6); // NW = 22+11 = 33 -> 6
    expect(square.maternalSpiritual.corner).toBe(3); // NE = 11+19 = 30 -> 3
    expect(square.paternalMaterial.corner).toBe(8); // SE = 19+7  = 26 -> 8
    expect(square.maternalMaterial.corner).toBe(11); // SW = 7+22  = 29 -> 11
  });

  it('pairs OPPOSITE corners into the parental lines, not adjacent ones', () => {
    // The paternal line runs NW-SE and the maternal NE-SW. The corners' own
    // spiritual/material naming (top two spiritual, bottom two material) makes a
    // top/bottom split look natural, and one source does present that — so this
    // asserts the diagonal pairing explicitly.
    const square = computeAncestralSquare(CORE);
    expect(square.paternalLine).toBe(
      sumArcana(square.paternalSpiritual.corner, square.paternalMaterial.corner),
    );
    expect(square.maternalLine).toBe(
      sumArcana(square.maternalSpiritual.corner, square.maternalMaterial.corner),
    );
    expect(square.paternalLine).toBe(14); // 6 + 8
    expect(square.maternalLine).toBe(14); // 3 + 11
  });

  it('sums ALL FOUR corners into the ancestral centre, not just the upper two', () => {
    // The one real divergence in this block (method spec §3). Upper-two would
    // give 6 + 3 = 9; all four give 6+3+8+11 = 28 -> 10. Pinned down so the
    // rejected variant cannot be reintroduced as a "fix".
    const square = computeAncestralSquare(CORE);
    expect(square.centre).toBe(10);
    expect(square.centre).not.toBe(9);
  });

  it('sums the corners FLAT, where the social purpose reduces its pairs first', () => {
    // A genuine order-of-reduction trap, surfaced by cross-checking against
    // reference calculators. Both values are "the four corners added up", but
    // they are not the same number:
    //   ancestral centre = reduce(16 + 5 + 9 + 20)              = reduce(50) = 5
    //   social purpose   = reduce(reduce(16+9) + reduce(5+20))  = reduce(7+7) = 14
    // The paternal/maternal lines are reduced before being summed; the centre is
    // not. Collapsing either into the other would look like a harmless
    // simplification and would silently corrupt one of the two.
    const core = computeCoreSquare('1990-04-12');
    const square = computeAncestralSquare(core);

    expect(square.centre).toBe(5);
    expect(sumArcana(square.paternalLine, square.maternalLine)).toBe(14);
  });

  it('derives the inner point from the ancestral centre and the middle from both', () => {
    const square = computeAncestralSquare(CORE);
    const nw = square.paternalSpiritual;
    // inner = corner + ancestralCentre = 6 + 10 = 16
    expect(nw.inner).toBe(16);
    // middle = corner + inner = 6 + 16 = 22
    expect(nw.middle).toBe(22);
  });

  it('joins the personal and ancestral centres', () => {
    // 14 + 10 = 24 -> 6
    expect(computeAncestralSquare(CORE).personalAncestral).toBe(6);
  });

  it('produces only valid arcana across an exhaustive sweep', () => {
    for (let year = 1900; year <= 2030; year += 1) {
      for (const [month, day] of [
        [1, 1],
        [6, 22],
        [12, 31],
      ] as const) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const square = computeAncestralSquare(computeCoreSquare(iso));
        const values = [
          square.centre,
          square.personalAncestral,
          square.paternalLine,
          square.maternalLine,
          ...[
            square.paternalSpiritual,
            square.paternalMaterial,
            square.maternalSpiritual,
            square.maternalMaterial,
          ].flatMap((c) => [c.corner, c.middle, c.inner]),
        ];
        for (const value of values) {
          expect(isArcana(value), `${iso} -> ${value}`).toBe(true);
        }
      }
    }
  });
});
