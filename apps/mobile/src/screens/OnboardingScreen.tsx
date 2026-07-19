import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError, getProfile, updateProfile, type ProfileUpdateInput } from '../api/profileApi';
import { BirthPlaceSearchField, type BirthPlaceValue } from '../components/BirthPlaceSearchField';
import { useTranslation } from '../i18n/LocaleContext';
import { isSupportedLocale, SUPPORTED_LOCALES, type Locale } from '../i18n/translations';
import {
  nextStep,
  previousStep,
  stepProgress,
  validateStep,
  ONBOARDING_STEPS,
  type OnboardingData,
  type OnboardingStep,
} from '../onboarding/validation';

interface FormState {
  displayName: string;
  birthDate: string;
  birthTime: string;
  birthTimeKnown: boolean;
  birthPlaceName: string;
  birthPlaceLat: number | null;
  birthPlaceLng: number | null;
  birthPlaceTimezone: string;
  locale: Locale;
}

const EMPTY_FORM: FormState = {
  displayName: '',
  birthDate: '',
  birthTime: '',
  birthTimeKnown: false,
  birthPlaceName: '',
  birthPlaceLat: null,
  birthPlaceLng: null,
  birthPlaceTimezone: '',
  locale: 'en',
};

function toOnboardingData(form: FormState): OnboardingData {
  return {
    displayName: form.displayName,
    birthDate: form.birthDate,
    birthTime: form.birthTime,
    birthTimeKnown: form.birthTimeKnown,
    birthPlaceName: form.birthPlaceName,
    locale: form.locale,
  };
}

function toPatch(form: FormState): ProfileUpdateInput {
  return {
    displayName: form.displayName.trim() === '' ? null : form.displayName.trim(),
    locale: form.locale,
    birthDate: form.birthDate.trim() === '' ? null : form.birthDate.trim(),
    birthTime: form.birthTimeKnown && form.birthTime.trim() !== '' ? form.birthTime.trim() : null,
    birthTimeKnown: form.birthTimeKnown,
    birthPlaceName: form.birthPlaceName.trim() === '' ? null : form.birthPlaceName.trim(),
    birthPlaceLat: form.birthPlaceLat,
    birthPlaceLng: form.birthPlaceLng,
    birthPlaceTimezone:
      form.birthPlaceTimezone.trim() === '' ? null : form.birthPlaceTimezone.trim(),
  };
}

interface OnboardingScreenProps {
  /** Called once onboarding is completed (normally, or via "finish later"). */
  onComplete: () => void;
}

/**
 * Onboarding flow (#6): a step-by-step wizard — name -> birth date -> birth
 * time -> birth place -> language — with back navigation and an "I'll finish
 * this later" escape hatch on every step that saves a draft profile and exits
 * (the profile-edit screen, #7, is where the user completes it later).
 *
 * Loads any existing (draft) profile first, so re-entering onboarding after
 * "finish later" resumes with previously entered data rather than blank
 * fields. Each "Next" PATCHes the current form snapshot to `/profile`; the
 * final step (and "finish later") sets `completeOnboarding: true`, which is
 * what unlocks the rest of the app (see `profileService.ts`/`profileRoute.ts`
 * on the backend).
 */
export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { t, setLocale } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [step, setStep] = useState<OnboardingStep>('name');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    (async () => {
      try {
        const profile = await getProfile();
        setForm({
          displayName: profile.displayName ?? '',
          birthDate: profile.birthDate ?? '',
          birthTime: profile.birthTime?.slice(0, 5) ?? '',
          birthTimeKnown: profile.birthTimeKnown,
          birthPlaceName: profile.birthPlaceName ?? '',
          birthPlaceLat: profile.birthPlaceLat,
          birthPlaceLng: profile.birthPlaceLng,
          birthPlaceTimezone: profile.birthPlaceTimezone ?? '',
          locale: isSupportedLocale(profile.locale) ? profile.locale : 'en',
        });
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : t('profile.loadError'));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const persist = useCallback(
    async (next: FormState, completeOnboarding: boolean) => {
      setSaving(true);
      setSaveError(null);
      try {
        await updateProfile({ ...toPatch(next), completeOnboarding });
        return true;
      } catch (err) {
        setSaveError(err instanceof ApiError ? err.message : t('onboarding.saveError'));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [t],
  );

  const onNext = async () => {
    const validationError = validateStep(step, toOnboardingData(form), t);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    const upcoming = nextStep(step);
    const ok = await persist(form, upcoming === null);
    if (!ok) return;

    if (upcoming) setStep(upcoming);
    else onComplete();
  };

  const onBack = () => {
    const prev = previousStep(step);
    if (!prev) return;
    setSaveError(null);
    setStep(prev);
  };

  const onFinishLater = async () => {
    const ok = await persist(form, true);
    if (ok) onComplete();
  };

  const onSelectLocale = (code: Locale) => {
    update('locale', code);
    setLocale(code);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={GOLD} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{loadError}</Text>
      </View>
    );
  }

  const { position, total } = stepProgress(step);
  const isLastStep = nextStep(step) === null;
  const canGoBack = previousStep(step) !== null;

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        {ONBOARDING_STEPS.map((s, i) => (
          <View key={s} style={[styles.progressDot, i < position && styles.progressDotFilled]} />
        ))}
      </View>
      <Text style={styles.progressLabel}>
        {t('onboarding.progressHint')} {position}/{total}
      </Text>

      <View style={styles.content}>
        {step === 'name' ? (
          <>
            <Text style={styles.title}>{t('onboarding.step.name.title')}</Text>
            <TextInput
              style={styles.input}
              value={form.displayName}
              onChangeText={(v) => update('displayName', v)}
              placeholder={t('profile.name.placeholder')}
              placeholderTextColor={MUTED}
              autoFocus
            />
          </>
        ) : null}

        {step === 'birthDate' ? (
          <>
            <Text style={styles.title}>{t('onboarding.step.birthDate.title')}</Text>
            <TextInput
              style={styles.input}
              value={form.birthDate}
              onChangeText={(v) => update('birthDate', v)}
              placeholder={t('profile.birthDate.placeholder')}
              placeholderTextColor={MUTED}
              keyboardType="numbers-and-punctuation"
            />
          </>
        ) : null}

        {step === 'birthTime' ? (
          <>
            <Text style={styles.title}>{t('onboarding.step.birthTime.title')}</Text>
            <TextInput
              style={[styles.input, !form.birthTimeKnown && styles.inputDisabled]}
              value={form.birthTime}
              onChangeText={(v) => update('birthTime', v)}
              placeholder={t('profile.birthTime.placeholder')}
              placeholderTextColor={MUTED}
              editable={form.birthTimeKnown}
              keyboardType="numbers-and-punctuation"
            />
            <View style={styles.switchRow}>
              <Switch
                value={!form.birthTimeKnown}
                onValueChange={(unknown) => update('birthTimeKnown', !unknown)}
                trackColor={{ true: GOLD, false: '#3A3550' }}
              />
              <Text style={styles.switchLabel}>{t('profile.birthTimeUnknown.label')}</Text>
            </View>
            {!form.birthTimeKnown ? (
              <Text style={styles.hint}>{t('onboarding.step.birthTime.unknownExplain')}</Text>
            ) : null}
          </>
        ) : null}

        {step === 'birthPlace' ? (
          <>
            <Text style={styles.title}>{t('onboarding.step.birthPlace.title')}</Text>
            <BirthPlaceSearchField
              value={{
                name: form.birthPlaceName,
                lat: form.birthPlaceLat,
                lng: form.birthPlaceLng,
                timezone: form.birthPlaceTimezone,
              }}
              onChange={(v: BirthPlaceValue) =>
                setForm((prev) => ({
                  ...prev,
                  birthPlaceName: v.name,
                  birthPlaceLat: v.lat,
                  birthPlaceLng: v.lng,
                  birthPlaceTimezone: v.timezone,
                }))
              }
            />
          </>
        ) : null}

        {step === 'language' ? (
          <>
            <Text style={styles.title}>{t('onboarding.step.language.title')}</Text>
            <View style={styles.chipRow}>
              {SUPPORTED_LOCALES.map(({ code, label }) => (
                <Pressable
                  key={code}
                  accessibilityRole="button"
                  accessibilityState={{ selected: form.locale === code }}
                  onPress={() => onSelectLocale(code)}
                  style={[styles.chip, form.locale === code && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, form.locale === code && styles.chipTextSelected]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </View>

      {saveError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {saveError}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {canGoBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            onPress={onBack}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>{t('onboarding.back')}</Text>
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          onPress={onNext}
          style={({ pressed }) => [
            styles.nextButton,
            pressed && styles.nextButtonPressed,
            saving && styles.nextButtonDisabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#1a1206" />
          ) : (
            <Text style={styles.nextButtonText}>
              {isLastStep ? t('onboarding.finish') : t('onboarding.next')}
            </Text>
          )}
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" onPress={onFinishLater} disabled={saving}>
        <Text style={styles.finishLater}>{t('onboarding.finishLater')}</Text>
      </Pressable>
    </View>
  );
}

const GOLD = '#E4B95B';
const BG = '#0E0B14';
const MUTED = '#6E6A80';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, padding: 24, paddingTop: 64 },
  centered: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  progressRow: { flexDirection: 'row', gap: 6 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#2C273F' },
  progressDotFilled: { backgroundColor: GOLD },
  progressLabel: {
    color: MUTED,
    fontSize: 12,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  content: { marginTop: 28, flexGrow: 1 },
  title: { color: GOLD, fontSize: 24, fontWeight: '700', marginBottom: 20 },
  input: {
    backgroundColor: '#181329',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C273F',
    color: '#F4F1FA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputDisabled: { opacity: 0.4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  switchLabel: { color: '#B9B4C7', fontSize: 13, marginLeft: 10, flexShrink: 1 },
  hint: { color: MUTED, fontSize: 13, marginTop: 12, lineHeight: 18 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2C273F',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipSelected: { backgroundColor: GOLD, borderColor: GOLD },
  chipText: { color: '#B9B4C7', fontSize: 14 },
  chipTextSelected: { color: '#1a1206', fontWeight: '600' },
  error: { color: '#F2A2A2', fontSize: 14, marginTop: 16, textAlign: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24 },
  backButton: { flex: 1, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  backButtonText: { color: '#B9B4C7', fontSize: 15, fontWeight: '600' },
  nextButton: {
    flex: 2,
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  nextButtonPressed: { opacity: 0.85 },
  nextButtonDisabled: { opacity: 0.6 },
  nextButtonText: { color: '#1a1206', fontSize: 16, fontWeight: '600' },
  finishLater: {
    color: MUTED,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
    textDecorationLine: 'underline',
  },
});
