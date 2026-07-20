import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ApiError,
  getProfile,
  updateProfile,
  type Profile,
  type ProfileUpdateInput,
} from '../api/profileApi';
import { BirthPlaceSearchField, type BirthPlaceValue } from '../components/BirthPlaceSearchField';
import { DateTimeField } from '../components/DateTimeField';
import { useTranslation } from '../i18n/LocaleContext';
import {
  isSupportedLocale,
  SUPPORTED_LOCALES,
  type Locale,
  type TranslationKey,
} from '../i18n/translations';

const BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BIRTH_TIME_RE = /^\d{2}:\d{2}$/;
const URL_RE = /^https?:\/\/\S+$/i;

interface FormState {
  fullName: string;
  displayName: string;
  avatarUrl: string;
  locale: Locale;
  birthDate: string;
  birthTime: string;
  birthTimeKnown: boolean;
  birthPlaceName: string;
  birthPlaceLat: string;
  birthPlaceLng: string;
  birthPlaceTimezone: string;
}

function toForm(profile: Profile): FormState {
  return {
    fullName: profile.fullName ?? '',
    displayName: profile.displayName ?? '',
    avatarUrl: profile.avatarUrl ?? '',
    locale: isSupportedLocale(profile.locale) ? profile.locale : 'en',
    birthDate: profile.birthDate ?? '',
    birthTime: profile.birthTime?.slice(0, 5) ?? '',
    birthTimeKnown: profile.birthTimeKnown,
    birthPlaceName: profile.birthPlaceName ?? '',
    birthPlaceLat: profile.birthPlaceLat != null ? String(profile.birthPlaceLat) : '',
    birthPlaceLng: profile.birthPlaceLng != null ? String(profile.birthPlaceLng) : '',
    birthPlaceTimezone: profile.birthPlaceTimezone ?? '',
  };
}

const BIRTH_FIELDS = [
  'birthDate',
  'birthTime',
  'birthTimeKnown',
  'birthPlaceName',
  'birthPlaceLat',
  'birthPlaceLng',
  'birthPlaceTimezone',
] as const satisfies readonly (keyof FormState)[];

function birthDataChanged(before: FormState, after: FormState): boolean {
  return BIRTH_FIELDS.some((field) => before[field] !== after[field]);
}

function toPatch(form: FormState): ProfileUpdateInput {
  const num = (s: string) => (s.trim() === '' ? null : Number(s));
  return {
    // Cleared to null rather than '' — the backend rejects an empty string, and
    // null is what "no full name yet" means to the numerology service.
    fullName: form.fullName.trim() === '' ? null : form.fullName.trim(),
    displayName: form.displayName.trim() === '' ? null : form.displayName.trim(),
    avatarUrl: form.avatarUrl.trim() === '' ? null : form.avatarUrl.trim(),
    locale: form.locale,
    birthDate: form.birthDate.trim() === '' ? null : form.birthDate.trim(),
    birthTime: form.birthTimeKnown && form.birthTime.trim() !== '' ? form.birthTime.trim() : null,
    birthTimeKnown: form.birthTimeKnown,
    birthPlaceName: form.birthPlaceName.trim() === '' ? null : form.birthPlaceName.trim(),
    birthPlaceLat: num(form.birthPlaceLat),
    birthPlaceLng: num(form.birthPlaceLng),
    birthPlaceTimezone:
      form.birthPlaceTimezone.trim() === '' ? null : form.birthPlaceTimezone.trim(),
  };
}

/** Client-side mirror of the backend's PATCH validation, so bad input is caught before the round trip. */
/** Mirrors the backend's `fullName` ceiling, so an over-long name fails inline. */
const FULL_NAME_MAX = 200;

function validate(form: FormState, t: (key: TranslationKey) => string): string | null {
  if (form.fullName.trim().length > FULL_NAME_MAX) {
    return t('numerology.fullNameTooLong');
  }
  if (form.avatarUrl.trim() !== '' && !URL_RE.test(form.avatarUrl.trim())) {
    return t('profile.avatarUrl.invalid');
  }
  if (form.birthDate.trim() !== '' && !BIRTH_DATE_RE.test(form.birthDate.trim())) {
    return t('profile.birthDate.invalid');
  }
  if (
    form.birthTimeKnown &&
    form.birthTime.trim() !== '' &&
    !BIRTH_TIME_RE.test(form.birthTime.trim())
  ) {
    return t('profile.birthTime.invalid');
  }
  return null;
}

/**
 * Profile creation/edit screen (#7). Lets the user re-edit every onboarding
 * field (name, avatar, birth date/time/place, language) at any time. Saving
 * always PATCHes the full form to `/profile`; when a birth-relevant field
 * changed, the backend invalidates the cached natal chart/matrix (see
 * `profileService.ts` on the backend — EPIC 3 / #19 dependency) and this
 * screen shows a notice that the chart will be recalculated.
 *
 * Picking a language updates the app-wide `LocaleProvider` immediately (see
 * `LocaleContext.tsx`), independent of the save round trip.
 */
interface ProfileScreenProps {
  /** Called to navigate to account deletion / data export (#9), when offered. */
  onManageAccount?: () => void;
  /** Called to navigate to the natal-chart result screen (#17/#18), when offered. */
  onViewChart?: () => void;
  /** Called to navigate to the numerology result screen (#66), when offered. */
  onViewNumerology?: () => void;
  /** Called to navigate to the People list (#s2), when offered. */
  onViewPeople?: () => void;
}

export function ProfileScreen({
  onManageAccount,
  onViewChart,
  onViewNumerology,
  onViewPeople,
}: ProfileScreenProps = {}) {
  const { t, setLocale } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isNewProfile, setIsNewProfile] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [baseline, setBaseline] = useState<FormState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const profile = await getProfile();
      const next = toForm(profile);
      setForm(next);
      setBaseline(next);
      setIsNewProfile(!profile.onboardingCompletedAt);
      setLocale(next.locale);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : t('profile.loadError'));
    } finally {
      setLoading(false);
    }
  }, [setLocale, t]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  };

  const onSelectLocale = (code: Locale) => {
    update('locale', code);
    setLocale(code); // applies immediately, ahead of Save
  };

  const onSave = async () => {
    if (!form || !baseline) return;
    const validationError = validate(form, t);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateProfile(toPatch(form));
      const next = toForm(updated);
      setForm(next);
      setBaseline(next);
      setIsNewProfile(!updated.onboardingCompletedAt);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={GOLD} />
      </View>
    );
  }

  if (loadError || !form || !baseline) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{loadError ?? t('profile.loadError')}</Text>
        <Pressable style={styles.retryButton} onPress={load}>
          <Text style={styles.retryButtonText}>{t('profile.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const changedBirthData = birthDataChanged(baseline, form);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>
        {isNewProfile ? t('profile.titleCreate') : t('profile.titleEdit')}
      </Text>
      <Text style={styles.subtitle}>
        {isNewProfile ? t('profile.subtitleCreate') : t('profile.subtitleEdit')}
      </Text>

      <Field label={t('numerology.fullNameLabel')}>
        <TextInput
          style={styles.input}
          value={form.fullName}
          onChangeText={(v) => update('fullName', v)}
          placeholder={t('numerology.fullNameLabel')}
          placeholderTextColor={MUTED}
          testID="profile-fullName"
        />
        <Text style={styles.hint}>{t('numerology.fullNameHint')}</Text>
      </Field>

      <Field label={t('profile.name.label')}>
        <TextInput
          style={styles.input}
          value={form.displayName}
          onChangeText={(v) => update('displayName', v)}
          placeholder={t('profile.name.placeholder')}
          placeholderTextColor={MUTED}
        />
      </Field>

      <Field label={t('profile.avatarUrl.label')}>
        <TextInput
          style={styles.input}
          value={form.avatarUrl}
          onChangeText={(v) => update('avatarUrl', v)}
          placeholder={t('profile.avatarUrl.placeholder')}
          placeholderTextColor={MUTED}
          autoCapitalize="none"
          keyboardType="url"
        />
      </Field>

      <Field label={t('profile.language.label')}>
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
      </Field>

      <Field label={t('profile.birthDate.label')}>
        <DateTimeField
          mode="date"
          value={form.birthDate}
          onChange={(v) => update('birthDate', v)}
          placeholder={t('birthDate.select')}
          testID="profile-birthDate"
        />
      </Field>

      <Field label={t('profile.birthTime.label')}>
        <DateTimeField
          mode="time"
          value={form.birthTime}
          onChange={(v) => update('birthTime', v)}
          placeholder={t('birthTime.select')}
          disabled={!form.birthTimeKnown}
          testID="profile-birthTime"
        />
        <View style={styles.switchRow}>
          <Switch
            value={!form.birthTimeKnown}
            onValueChange={(unknown) => update('birthTimeKnown', !unknown)}
            trackColor={{ true: GOLD, false: '#3A3550' }}
          />
          <Text style={styles.switchLabel}>{t('profile.birthTimeUnknown.label')}</Text>
        </View>
      </Field>

      <Field label={t('profile.birthPlace.label')}>
        <BirthPlaceSearchField
          value={{
            name: form.birthPlaceName,
            lat: form.birthPlaceLat.trim() === '' ? null : Number(form.birthPlaceLat),
            lng: form.birthPlaceLng.trim() === '' ? null : Number(form.birthPlaceLng),
            timezone: form.birthPlaceTimezone,
          }}
          onChange={(v: BirthPlaceValue) => {
            update('birthPlaceName', v.name);
            update('birthPlaceLat', v.lat != null ? String(v.lat) : '');
            update('birthPlaceLng', v.lng != null ? String(v.lng) : '');
            update('birthPlaceTimezone', v.timezone);
          }}
        />
      </Field>

      {changedBirthData ? (
        <Text style={styles.notice}>{t('profile.birthDataChangedNotice')}</Text>
      ) : null}
      {saveError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {saveError}
        </Text>
      ) : null}
      {saved ? <Text style={styles.success}>{t('profile.saved')}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: saving }}
        disabled={saving}
        onPress={onSave}
        style={({ pressed }) => [
          styles.saveButton,
          pressed && styles.saveButtonPressed,
          saving && styles.saveButtonDisabled,
        ]}
      >
        {saving ? (
          <ActivityIndicator color="#1a1206" />
        ) : (
          <Text style={styles.saveButtonText}>{t('profile.save')}</Text>
        )}
      </Pressable>

      {onViewChart ? (
        <Pressable
          accessibilityRole="button"
          onPress={onViewChart}
          style={styles.manageAccountLink}
        >
          <Text style={styles.manageAccountLinkText}>{t('profile.viewChart')}</Text>
        </Pressable>
      ) : null}

      {onViewNumerology ? (
        <Pressable
          accessibilityRole="button"
          onPress={onViewNumerology}
          style={styles.manageAccountLink}
        >
          <Text style={styles.manageAccountLinkText}>{t('numerology.title')}</Text>
        </Pressable>
      ) : null}

      {onViewPeople ? (
        <Pressable
          accessibilityRole="button"
          onPress={onViewPeople}
          style={styles.manageAccountLink}
        >
          <Text style={styles.manageAccountLinkText}>{t('people.link')}</Text>
        </Pressable>
      ) : null}

      {onManageAccount ? (
        <Pressable
          accessibilityRole="button"
          onPress={onManageAccount}
          style={styles.manageAccountLink}
        >
          <Text style={styles.manageAccountLinkText}>{t('account.manageLink')}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const GOLD = '#E4B95B';
const BG = '#0E0B14';
const MUTED = '#6E6A80';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 24, paddingBottom: 48 },
  centered: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: GOLD, fontSize: 28, fontWeight: '700', letterSpacing: 0.5 },
  subtitle: { color: '#B9B4C7', fontSize: 14, marginTop: 6, marginBottom: 28 },
  field: { marginBottom: 20 },
  label: {
    color: '#B9B4C7',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
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
  hint: { color: MUTED, fontSize: 13, marginTop: 8, lineHeight: 18 },
  inputDisabled: { opacity: 0.4 },
  inputSpaced: { marginTop: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  switchLabel: { color: '#B9B4C7', fontSize: 13, marginLeft: 10, flexShrink: 1 },
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
  notice: { color: GOLD, fontSize: 13, marginBottom: 16, lineHeight: 18 },
  error: { color: '#F2A2A2', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  success: { color: '#8FD19E', fontSize: 14, marginBottom: 16 },
  saveButton: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  saveButtonPressed: { opacity: 0.85 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#1a1206', fontSize: 16, fontWeight: '600' },
  retryButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10 },
  retryButtonText: { color: GOLD, fontSize: 15, fontWeight: '600' },
  manageAccountLink: { marginTop: 24, alignItems: 'center', paddingVertical: 8 },
  manageAccountLinkText: { color: '#B9B4C7', fontSize: 14, fontWeight: '600' },
});
