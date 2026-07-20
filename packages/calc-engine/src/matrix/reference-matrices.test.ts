import { describe, expect, it } from 'vitest';
import {
  CORROBORATED_MATRIX_CASES,
  REFERENCE_MATRIX_CASES,
} from '../__fixtures__/reference-matrices';
import { computeDestinyMatrix } from './index';

/**
 * Cross-validation of the whole assembled Matrix (#72).
 *
 * Every other suite in this module checks a function against its own formula,
 * which cannot catch a formula that is wrong in the same way in both places.
 * This one checks `computeDestinyMatrix()` end to end against expectations taken
 * from *outside* this codebase — two live reference calculators and an
 * independent open-source implementation.
 *
 * See `__fixtures__/reference-matrices.ts` for each case's full working, and its
 * header for why a failure here is a bug rather than a fixture to refresh.
 */
describe.each(REFERENCE_MATRIX_CASES)('reference matrix: $label', (fixture) => {
  const matrix = computeDestinyMatrix(fixture.input);

  it('matches the reference core square', () => {
    expect({
      day: matrix.core.day,
      month: matrix.core.month,
      year: matrix.core.year,
      sum: matrix.core.sum,
      centre: matrix.core.centre,
    }).toEqual(fixture.expected.core);
  });

  it('matches the reference ancestral square', () => {
    expect({
      nw: matrix.ancestral.paternalSpiritual.corner,
      ne: matrix.ancestral.maternalSpiritual.corner,
      se: matrix.ancestral.paternalMaterial.corner,
      sw: matrix.ancestral.maternalMaterial.corner,
    }).toEqual(fixture.expected.corners);
    expect(matrix.ancestral.centre).toBe(fixture.expected.ancestralCentre);
    expect(matrix.ancestral.paternalLine).toBe(fixture.expected.paternalLine);
    expect(matrix.ancestral.maternalLine).toBe(fixture.expected.maternalLine);
  });

  it('matches the reference purposes', () => {
    expect(matrix.purposes).toEqual(fixture.expected.purposes);
  });

  it('matches the reference money/relationship line', () => {
    const line = matrix.moneyAndRelationships;
    expect([line.entry, line.toEntry, line.core, line.toPartner, line.partner]).toEqual(
      fixture.expected.moneyAndRelationships,
    );
  });
});

/**
 * The second tier: five further dates agreed on by three more calculators,
 * asserting only the positions those calculators actually corroborated.
 */
describe.each(CORROBORATED_MATRIX_CASES)('corroborated matrix: $birthDate ($covers)', (fixture) => {
  const matrix = computeDestinyMatrix({ birthDate: fixture.birthDate });

  it('matches the corroborated core square', () => {
    expect({
      day: matrix.core.day,
      month: matrix.core.month,
      year: matrix.core.year,
      sum: matrix.core.sum,
      centre: matrix.core.centre,
    }).toEqual(fixture.core);
  });

  it('matches the corroborated corners, in TL/TR/BR/BL order', () => {
    expect([
      matrix.ancestral.paternalSpiritual.corner,
      matrix.ancestral.maternalSpiritual.corner,
      matrix.ancestral.paternalMaterial.corner,
      matrix.ancestral.maternalMaterial.corner,
    ]).toEqual(fixture.corners);
  });

  it('matches the corroborated purposes', () => {
    expect(matrix.purposes).toMatchObject(fixture.purposes);
  });
});
