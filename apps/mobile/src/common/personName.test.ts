import { describe, expect, it } from 'vitest';
import { composeFullName, partsFromRecord, splitFullName } from './personName';

describe('composeFullName', () => {
  it('joins the parts, dropping empties', () => {
    expect(composeFullName({ firstName: 'Aysel', lastName: '', patronymic: 'Elçin qızı' })).toBe(
      'Aysel Elçin qızı',
    );
    expect(composeFullName({ firstName: '  ', lastName: '', patronymic: '' })).toBe('');
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

  it('is all-empty for a blank name', () => {
    expect(splitFullName('  ')).toEqual({ firstName: '', lastName: '', patronymic: '' });
  });
});

describe('partsFromRecord', () => {
  it('prefers the stored parts', () => {
    expect(
      partsFromRecord({
        firstName: 'Aysel',
        lastName: 'Məmmədova',
        patronymic: null,
        name: 'ignored legacy',
      }),
    ).toEqual({ firstName: 'Aysel', lastName: 'Məmmədova', patronymic: '' });
  });

  it('falls back to splitting a legacy name when no part is stored', () => {
    expect(partsFromRecord({ firstName: null, lastName: null, name: 'Aysel Məmmədova' })).toEqual({
      firstName: 'Aysel',
      lastName: 'Məmmədova',
      patronymic: '',
    });
    expect(partsFromRecord({ fullName: 'Aysel Məmmədova Elçin' })).toEqual({
      firstName: 'Aysel',
      lastName: 'Məmmədova',
      patronymic: 'Elçin',
    });
  });
});
