import type { TranslationKey } from '../i18n/translations';

export type OnboardingStep = 'name' | 'birthDate' | 'birthTime' | 'birthPlace' | 'language';

/** Fixed order per #6's acceptance criteria: name -> birth date -> birth time -> birth place -> language. */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  'name',
  'birthDate',
  'birthTime',
  'birthPlace',
  'language',
];

export interface OnboardingData {
  displayName: string;
  birthDate: string;
  birthTime: string;
  birthTimeKnown: boolean;
  birthPlaceName: string;
  locale: string;
}

const BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BIRTH_TIME_RE = /^\d{2}:\d{2}$/;

/**
 * Per-step validation, mirroring the profile-edit screen's client-side mirror
 * of the backend's PATCH validation (#7). Returns `null` when the step is
 * valid, otherwise a translated error message.
 */
export function validateStep(
  step: OnboardingStep,
  data: OnboardingData,
  t: (key: TranslationKey) => string,
): string | null {
  switch (step) {
    case 'name':
      return data.displayName.trim() === '' ? t('onboarding.name.required') : null;
    case 'birthDate':
      return BIRTH_DATE_RE.test(data.birthDate.trim()) ? null : t('profile.birthDate.invalid');
    case 'birthTime':
      // "I don't know" is a valid answer — only validate the format when the
      // user says they know their birth time.
      if (!data.birthTimeKnown) return null;
      return BIRTH_TIME_RE.test(data.birthTime.trim()) ? null : t('profile.birthTime.invalid');
    case 'birthPlace':
      return data.birthPlaceName.trim() === '' ? t('onboarding.birthPlace.required') : null;
    case 'language':
      return data.locale.trim() === '' ? t('onboarding.language.required') : null;
  }
}

/** The step after `step`, or `null` once past the last step. */
export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const idx = ONBOARDING_STEPS.indexOf(step);
  return idx < ONBOARDING_STEPS.length - 1 ? ONBOARDING_STEPS[idx + 1] : null;
}

/** The step before `step`, or `null` on the first step. */
export function previousStep(step: OnboardingStep): OnboardingStep | null {
  const idx = ONBOARDING_STEPS.indexOf(step);
  return idx > 0 ? ONBOARDING_STEPS[idx - 1] : null;
}

/** 1-based position for a "Step X of N" progress indicator. */
export function stepProgress(step: OnboardingStep): { position: number; total: number } {
  return { position: ONBOARDING_STEPS.indexOf(step) + 1, total: ONBOARDING_STEPS.length };
}
