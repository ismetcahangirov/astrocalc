import { describe, expect, it } from 'vitest';
import { numerologyDataToInput } from './numerologyInput';

const REFERENCE_DATE = '2026-07-20';

describe('numerologyDataToInput', () => {
  it('maps a profile carrying a fullName', () => {
    const input = numerologyDataToInput(
      { fullName: 'Ada Lovelace', birthDate: '1990-05-12' },
      REFERENCE_DATE,
    );

    expect(input).toEqual({
      fullName: 'Ada Lovelace',
      birthDate: '1990-05-12',
      referenceDate: REFERENCE_DATE,
    });
  });

  it('maps a subject, whose `name` is treated as its birth name', () => {
    const input = numerologyDataToInput(
      { name: 'Grace Hopper', birthDate: '1906-12-09' },
      REFERENCE_DATE,
    );

    expect(input).toEqual({
      fullName: 'Grace Hopper',
      birthDate: '1906-12-09',
      referenceDate: REFERENCE_DATE,
    });
  });

  it('prefers fullName over name when both are present', () => {
    const input = numerologyDataToInput(
      { fullName: 'Augusta Ada Byron', name: 'Ada Lovelace', birthDate: '1990-05-12' },
      REFERENCE_DATE,
    );

    expect(input.fullName).toBe('Augusta Ada Byron');
  });

  it('refuses to fall back to displayName — a nickname would yield wrong-but-plausible numbers', () => {
    // The bug this guards against is silent: `displayName` ("Ada") sums to a
    // perfectly valid expression number that simply is not the user's.
    expect(() =>
      numerologyDataToInput(
        { displayName: 'Ada', birthDate: '1990-05-12' } as never,
        REFERENCE_DATE,
      ),
    ).toThrowError(expect.objectContaining({ code: 'incomplete_profile' }));

    expect(() =>
      numerologyDataToInput(
        { displayName: 'Ada', birthDate: '1990-05-12' } as never,
        REFERENCE_DATE,
      ),
    ).toThrowError(expect.objectContaining({ details: { missing: ['fullName'] } }));
  });

  it('reports a missing birthDate', () => {
    expect(() =>
      numerologyDataToInput({ fullName: 'Ada Lovelace', birthDate: null }, REFERENCE_DATE),
    ).toThrowError(expect.objectContaining({ details: { missing: ['birthDate'] } }));
  });

  it('reports both fields when both are missing', () => {
    expect(() => numerologyDataToInput({ birthDate: null }, REFERENCE_DATE)).toThrowError(
      expect.objectContaining({ details: { missing: ['fullName', 'birthDate'] } }),
    );
  });

  it('treats a whitespace-only name as missing', () => {
    expect(() =>
      numerologyDataToInput({ fullName: '   ', birthDate: '1990-05-12' }, REFERENCE_DATE),
    ).toThrowError(expect.objectContaining({ details: { missing: ['fullName'] } }));
  });

  it('throws a 422 incomplete_profile error the client can branch on', () => {
    expect(() => numerologyDataToInput({ birthDate: null }, REFERENCE_DATE)).toThrowError(
      expect.objectContaining({ code: 'incomplete_profile', status: 422 }),
    );
  });
});
