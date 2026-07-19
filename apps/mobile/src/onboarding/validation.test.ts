import { describe, expect, it } from 'vitest';
import type { TranslationKey } from '../i18n/translations';
import {
  ONBOARDING_STEPS,
  nextStep,
  previousStep,
  stepProgress,
  validateStep,
  type OnboardingData,
} from './validation';

const t = (key: TranslationKey) => key;

const VALID: OnboardingData = {
  displayName: 'Aysel',
  birthDate: '1995-04-12',
  birthTime: '14:30',
  birthTimeKnown: true,
  birthPlaceName: 'Baku',
  locale: 'en',
};

describe('validateStep', () => {
  it('requires a non-blank name', () => {
    expect(validateStep('name', { ...VALID, displayName: '  ' }, t)).toBe(
      'onboarding.name.required',
    );
    expect(validateStep('name', VALID, t)).toBeNull();
  });

  it('requires YYYY-MM-DD for birth date', () => {
    expect(validateStep('birthDate', { ...VALID, birthDate: '04/12/1995' }, t)).toBe(
      'profile.birthDate.invalid',
    );
    expect(validateStep('birthDate', VALID, t)).toBeNull();
  });

  it('requires HH:mm for birth time only when the user says they know it', () => {
    expect(validateStep('birthTime', { ...VALID, birthTime: 'bad' }, t)).toBe(
      'profile.birthTime.invalid',
    );
    expect(
      validateStep('birthTime', { ...VALID, birthTimeKnown: false, birthTime: 'bad' }, t),
    ).toBeNull();
    expect(validateStep('birthTime', VALID, t)).toBeNull();
  });

  it('requires a non-blank birth place', () => {
    expect(validateStep('birthPlace', { ...VALID, birthPlaceName: '' }, t)).toBe(
      'onboarding.birthPlace.required',
    );
    expect(validateStep('birthPlace', VALID, t)).toBeNull();
  });

  it('requires a locale', () => {
    expect(validateStep('language', { ...VALID, locale: '' }, t)).toBe(
      'onboarding.language.required',
    );
    expect(validateStep('language', VALID, t)).toBeNull();
  });
});

describe('step order', () => {
  it('walks name -> birthDate -> birthTime -> birthPlace -> language', () => {
    expect(ONBOARDING_STEPS).toEqual(['name', 'birthDate', 'birthTime', 'birthPlace', 'language']);
  });

  it('nextStep advances until the last step, then returns null', () => {
    expect(nextStep('name')).toBe('birthDate');
    expect(nextStep('birthPlace')).toBe('language');
    expect(nextStep('language')).toBeNull();
  });

  it('previousStep goes back until the first step, then returns null', () => {
    expect(previousStep('language')).toBe('birthPlace');
    expect(previousStep('birthDate')).toBe('name');
    expect(previousStep('name')).toBeNull();
  });

  it('stepProgress reports a 1-based position out of the total', () => {
    expect(stepProgress('name')).toEqual({ position: 1, total: 5 });
    expect(stepProgress('language')).toEqual({ position: 5, total: 5 });
  });
});
