import { useEffect, useState, type ReactNode } from 'react';
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
  createSubject,
  getSubject,
  updateSubject,
  type SubjectInput,
} from '../api/subjectsApi';
import { BirthPlaceSearchField, type BirthPlaceValue } from '../components/BirthPlaceSearchField';
import { partsFromRecord } from '../common/personName';
import { DateTimeField } from '../components/DateTimeField';
import { useTranslation } from '../i18n/LocaleContext';

interface FormState {
  firstName: string;
  lastName: string;
  patronymic: string;
  birthDate: string;
  birthTime: string;
  birthTimeKnown: boolean;
  birthPlaceName: string;
  birthPlaceLat: number | null;
  birthPlaceLng: number | null;
}

const EMPTY: FormState = {
  firstName: '',
  lastName: '',
  patronymic: '',
  birthDate: '',
  birthTime: '',
  birthTimeKnown: false,
  birthPlaceName: '',
  birthPlaceLat: null,
  birthPlaceLng: null,
};

const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

function toInput(form: FormState): SubjectInput {
  return {
    firstName: form.firstName.trim(),
    lastName: orNull(form.lastName),
    patronymic: orNull(form.patronymic),
    birthDate: form.birthDate.trim() === '' ? null : form.birthDate.trim(),
    birthTime: form.birthTimeKnown && form.birthTime.trim() !== '' ? form.birthTime.trim() : null,
    birthTimeKnown: form.birthTimeKnown,
    birthPlaceName: form.birthPlaceName.trim() === '' ? null : form.birthPlaceName.trim(),
    birthPlaceLat: form.birthPlaceLat,
    birthPlaceLng: form.birthPlaceLng,
  };
}

interface SubjectFormScreenProps {
  /** When set, the screen edits that subject; otherwise it creates a new one. */
  subjectId?: string;
  onDone: () => void;
  onCancel: () => void;
}

/**
 * Add/edit a saved person (#s2). Reuses the same birth-data entry components as
 * onboarding and the profile screen — modal date/time pickers and the map-backed
 * place field — so a subject's data is captured as accurately as the user's own,
 * and the backend derives its timezone on save.
 */
export function SubjectFormScreen({ subjectId, onDone, onCancel }: SubjectFormScreenProps) {
  const { t } = useTranslation();
  const editing = subjectId != null;
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    if (!subjectId) return;
    (async () => {
      try {
        const s = await getSubject(subjectId);
        setForm({
          ...partsFromRecord(s),
          birthDate: s.birthDate ?? '',
          birthTime: s.birthTime?.slice(0, 5) ?? '',
          birthTimeKnown: s.birthTimeKnown,
          birthPlaceName: s.birthPlaceName ?? '',
          birthPlaceLat: s.birthPlaceLat,
          birthPlaceLng: s.birthPlaceLng,
        });
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : t('subject.loadError'));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSave = async () => {
    if (form.firstName.trim() === '') {
      setError(t('name.first.required'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (subjectId) await updateSubject(subjectId, toInput(form));
      else await createSubject(toInput(form));
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('subject.saveError'));
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

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{loadError}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t(editing ? 'subject.titleEdit' : 'subject.titleCreate')}</Text>

      <Field label={t('name.first.label')}>
        <TextInput
          style={styles.input}
          value={form.firstName}
          onChangeText={(v) => update('firstName', v)}
          placeholder={t('name.first.placeholder')}
          placeholderTextColor={MUTED}
        />
      </Field>

      <Field label={t('name.last.label')}>
        <TextInput
          style={styles.input}
          value={form.lastName}
          onChangeText={(v) => update('lastName', v)}
          placeholder={t('name.last.placeholder')}
          placeholderTextColor={MUTED}
        />
      </Field>

      <Field label={t('name.patronymic.label')}>
        <TextInput
          style={styles.input}
          value={form.patronymic}
          onChangeText={(v) => update('patronymic', v)}
          placeholder={t('name.patronymic.placeholder')}
          placeholderTextColor={MUTED}
        />
      </Field>

      <Field label={t('profile.birthDate.label')}>
        <DateTimeField
          mode="date"
          value={form.birthDate}
          onChange={(v) => update('birthDate', v)}
          placeholder={t('birthDate.select')}
        />
      </Field>

      <Field label={t('profile.birthTime.label')}>
        <DateTimeField
          mode="time"
          value={form.birthTime}
          onChange={(v) => update('birthTime', v)}
          placeholder={t('birthTime.select')}
          disabled={!form.birthTimeKnown}
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
            lat: form.birthPlaceLat,
            lng: form.birthPlaceLng,
            timezone: '',
          }}
          onChange={(v: BirthPlaceValue) =>
            setForm((prev) => ({
              ...prev,
              birthPlaceName: v.name,
              birthPlaceLat: v.lat,
              birthPlaceLng: v.lng,
            }))
          }
        />
      </Field>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
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
          <Text style={styles.saveButtonText}>{t('subject.save')}</Text>
        )}
      </Pressable>

      <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancelLink}>
        <Text style={styles.cancelLinkText}>{t('subject.cancel')}</Text>
      </Pressable>
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
  content: { padding: 24, paddingTop: 56, paddingBottom: 48 },
  centered: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: GOLD, fontSize: 26, fontWeight: '700', letterSpacing: 0.5, marginBottom: 24 },
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
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  switchLabel: { color: '#B9B4C7', fontSize: 13, marginLeft: 10, flexShrink: 1 },
  error: { color: '#F2A2A2', fontSize: 14, marginBottom: 16, textAlign: 'center' },
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
  cancelLink: { marginTop: 20, alignItems: 'center', paddingVertical: 8 },
  cancelLinkText: { color: '#B9B4C7', fontSize: 14, fontWeight: '600' },
});
