import { describe, expect, it } from 'vitest';
import { composeFullName, displayNameOf, splitFullName } from './personName';

describe('composeFullName', () => {
  it('joins all three parts in order', () => {
    expect(
      composeFullName({ firstName: 'Aysel', lastName: 'Məmmədova', patronymic: 'Elçin qızı' }),
    ).toBe('Aysel Məmmədova Elçin qızı');
  });

  it('drops empty and whitespace-only parts', () => {
    expect(composeFullName({ firstName: 'Aysel', lastName: '', patronymic: '  ' })).toBe('Aysel');
    expect(composeFullName({ firstName: '  Aysel  ', lastName: null, patronymic: undefined })).toBe(
      'Aysel',
    );
  });

  it('returns null when nothing is filled in', () => {
    expect(composeFullName({ firstName: '', lastName: null, patronymic: '   ' })).toBeNull();
    expect(composeFullName({})).toBeNull();
  });
});

describe('splitFullName', () => {
  it('splits into first / surname / patronymic', () => {
    expect(splitFullName('Aysel Məmmədova Elçin qızı')).toEqual({
      firstName: 'Aysel',
      lastName: 'Məmmədova',
      patronymic: 'Elçin qızı',
    });
  });

  it('handles a one- or two-token name', () => {
    expect(splitFullName('Aysel')).toEqual({ firstName: 'Aysel', lastName: null, patronymic: null });
    expect(splitFullName('Aysel Məmmədova')).toEqual({
      firstName: 'Aysel',
      lastName: 'Məmmədova',
      patronymic: null,
    });
  });

  it('is empty for a blank or absent name', () => {
    expect(splitFullName('   ')).toEqual({ firstName: null, lastName: null, patronymic: null });
    expect(splitFullName(null)).toEqual({ firstName: null, lastName: null, patronymic: null });
  });

  it('round-trips a composed name', () => {
    const parts = { firstName: 'Aysel', lastName: 'Məmmədova', patronymic: 'Elçin' };
    expect(splitFullName(composeFullName(parts))).toEqual(parts);
  });
});

describe('displayNameOf', () => {
  it('is the trimmed first name', () => {
    expect(displayNameOf({ firstName: '  Aysel ', lastName: 'Məmmədova' })).toBe('Aysel');
  });

  it('is null without a first name', () => {
    expect(displayNameOf({ firstName: '', lastName: 'Məmmədova' })).toBeNull();
  });
});
