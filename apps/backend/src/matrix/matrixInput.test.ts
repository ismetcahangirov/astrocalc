import { describe, expect, it } from 'vitest';
import { IncompleteMatrixProfileError } from '../auth/errors';
import { matrixDataToInput } from './matrixInput';

describe('matrixDataToInput', () => {
  it('maps a birth date straight through', () => {
    expect(matrixDataToInput({ birthDate: '1990-05-12' })).toEqual({ birthDate: '1990-05-12' });
  });

  it('throws IncompleteMatrixProfileError naming birthDate when it is absent', () => {
    expect(() => matrixDataToInput({ birthDate: null })).toThrow(IncompleteMatrixProfileError);

    try {
      matrixDataToInput({ birthDate: null });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(IncompleteMatrixProfileError);
      expect((err as IncompleteMatrixProfileError).status).toBe(422);
      expect((err as IncompleteMatrixProfileError).code).toBe('incomplete_profile');
      expect((err as IncompleteMatrixProfileError).details).toEqual({ missing: ['birthDate'] });
    }
  });

  it('accepts data that carries fields the Matrix does not read', () => {
    // A `Subject` and a `Profile` both structurally satisfy `MatrixData` while
    // carrying much more; the extra fields must be ignored, not rejected, and
    // must not reach the engine input.
    const subject = {
      birthDate: '1990-05-12',
      name: 'Ada Lovelace',
      birthTime: null,
      birthPlaceLat: null,
      birthPlaceLng: null,
    };
    expect(matrixDataToInput(subject)).toEqual({ birthDate: '1990-05-12' });
  });

  it('leaves a malformed date for the engine to reject rather than pre-validating it', () => {
    // Presence is this function's only job. `parseIsoDate` in the calc-engine
    // rejects both malformed and impossible dates with a message naming the
    // offending value; duplicating that check here would report the same
    // failure with less context, and the two copies would drift.
    expect(matrixDataToInput({ birthDate: 'not-a-date' })).toEqual({ birthDate: 'not-a-date' });
  });
});
