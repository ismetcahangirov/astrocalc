import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ApiError, getProfile, type Profile } from '../api/profileApi';
import { deleteSubject, listSubjects, type Subject } from '../api/subjectsApi';
import { useTranslation } from '../i18n/LocaleContext';

interface BirthPlaceish {
  birthDate: string | null;
  birthPlaceLat: number | null;
  birthPlaceLng: number | null;
}

/** Enough birth data to compute a chart (the backend requires date + coordinates). */
function chartReady(x: BirthPlaceish): boolean {
  return !!x.birthDate && x.birthPlaceLat != null && x.birthPlaceLng != null;
}

/**
 * Numerology needs strictly less than the chart does: a name and a birth *date*,
 * with no place or time, so a person with no coordinates can still have numbers.
 * (A subject's `name` is what the backend scores, standing in for `fullName`.)
 */
function numerologyReady(subject: Subject): boolean {
  return !!subject.birthDate && subject.name.trim() !== '';
}

/**
 * The Matrix needs less than either of the others: a birth *date* and nothing
 * else — no place, no time, and not even a name. So a person whose row offers
 * neither a chart nor numbers can still offer a Matrix.
 */
function matrixReady(subject: Subject): boolean {
  return !!subject.birthDate;
}

interface PeopleScreenProps {
  onOpenSelfChart: () => void;
  onOpenSubjectChart: (id: string, name: string) => void;
  onOpenSubjectNumerology?: (id: string, name: string) => void;
  onOpenSubjectMatrix?: (id: string, name: string) => void;
  onAddSubject: () => void;
  onEditSubject: (id: string) => void;
}

/**
 * People list (#s2): the user ("Me", from their profile) pinned at the top,
 * followed by their saved subjects. Tapping a chart-ready person opens their
 * natal chart; rows offer edit and delete. The self and subject rows read from
 * different backend resources but are presented as one list.
 */
export function PeopleScreen({
  onOpenSelfChart,
  onOpenSubjectChart,
  onOpenSubjectNumerology,
  onOpenSubjectMatrix,
  onAddSubject,
  onEditSubject,
}: PeopleScreenProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, s] = await Promise.all([getProfile(), listSubjects()]);
      setProfile(p);
      setSubjects(s);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('people.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Reload whenever the screen regains focus (e.g. returning from add/edit).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmDelete = (subject: Subject) => {
    Alert.alert(t('people.deleteConfirm.title'), t('people.deleteConfirm.message'), [
      { text: t('subject.cancel'), style: 'cancel' },
      {
        text: t('people.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSubject(subject.id);
            setSubjects((prev) => prev.filter((s) => s.id !== subject.id));
          } catch (err) {
            setError(err instanceof ApiError ? err.message : t('people.loadError'));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={GOLD} />
      </View>
    );
  }

  if (error && !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        <Pressable accessibilityRole="button" style={styles.retryButton} onPress={load}>
          <Text style={styles.retryButtonText}>{t('people.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const meName = profile?.displayName?.trim() || t('people.me');
  const meReady = profile ? chartReady(profile) : false;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('people.title')}</Text>
      <Text style={styles.subtitle}>{t('people.subtitle')}</Text>

      {/* Me — pinned */}
      <Pressable
        accessibilityRole="button"
        disabled={!meReady}
        onPress={onOpenSelfChart}
        style={({ pressed }) => [styles.row, pressed && meReady && styles.rowPressed]}
      >
        <View style={styles.rowMain}>
          <Text style={styles.rowName}>{meName}</Text>
          <Text style={styles.rowBadge}>{t('people.me')}</Text>
        </View>
        <Text style={meReady ? styles.rowAction : styles.rowMuted}>
          {meReady ? t('people.viewChart') : t('people.noBirthData')}
        </Text>
      </Pressable>

      {/* Saved subjects */}
      {subjects.map((subject) => {
        const ready = chartReady(subject);
        return (
          <View key={subject.id} style={styles.row}>
            <Pressable
              accessibilityRole="button"
              disabled={!ready}
              onPress={() => onOpenSubjectChart(subject.id, subject.name)}
              style={styles.rowMain}
            >
              <Text style={styles.rowName}>{subject.name}</Text>
              {ready ? (
                <Text style={styles.rowAction}>{t('people.viewChart')}</Text>
              ) : (
                <Text style={styles.rowMuted}>{t('people.noBirthData')}</Text>
              )}
            </Pressable>
            <View style={styles.rowButtons}>
              {/* Numbers joins edit/delete in the row's existing secondary-action
                  strip: the row body is already the "open the chart" tap target,
                  so a second destination belongs beside the other row actions. */}
              {onOpenSubjectNumerology && numerologyReady(subject) ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onOpenSubjectNumerology(subject.id, subject.name)}
                  hitSlop={8}
                >
                  <Text style={styles.numerologyText}>{t('people.viewNumbers')}</Text>
                </Pressable>
              ) : null}
              {onOpenSubjectMatrix && matrixReady(subject) ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onOpenSubjectMatrix(subject.id, subject.name)}
                  hitSlop={8}
                >
                  <Text style={styles.numerologyText}>{t('people.viewMatrix')}</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => onEditSubject(subject.id)}
                hitSlop={8}
              >
                <Text style={styles.editText}>{t('people.edit')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => confirmDelete(subject)}
                hitSlop={8}
              >
                <Text style={styles.deleteText}>{t('people.delete')}</Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      {subjects.length === 0 ? <Text style={styles.empty}>{t('people.empty')}</Text> : null}

      <Pressable
        accessibilityRole="button"
        onPress={onAddSubject}
        style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
      >
        <Text style={styles.addButtonText}>+ {t('people.add')}</Text>
      </Pressable>
    </ScrollView>
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
  title: { color: GOLD, fontSize: 28, fontWeight: '700', letterSpacing: 0.5 },
  subtitle: { color: '#B9B4C7', fontSize: 14, marginTop: 6, marginBottom: 24 },
  row: {
    backgroundColor: '#181329',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2C273F',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  rowPressed: { opacity: 0.85 },
  rowMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowName: { color: '#F4F1FA', fontSize: 16, fontWeight: '600', flexShrink: 1 },
  rowBadge: {
    color: '#1a1206',
    backgroundColor: GOLD,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rowAction: { color: GOLD, fontSize: 13, fontWeight: '600', marginTop: 6 },
  rowMuted: { color: MUTED, fontSize: 12, marginTop: 6 },
  rowButtons: { flexDirection: 'row', gap: 18, marginTop: 12 },
  numerologyText: { color: GOLD, fontSize: 13, fontWeight: '600' },
  editText: { color: '#B9B4C7', fontSize: 13, fontWeight: '600' },
  deleteText: { color: '#F2A2A2', fontSize: 13, fontWeight: '600' },
  empty: { color: MUTED, fontSize: 14, textAlign: 'center', marginVertical: 12 },
  addButton: {
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  addButtonPressed: { opacity: 0.7 },
  addButtonText: { color: GOLD, fontSize: 15, fontWeight: '700' },
  error: { color: '#F2A2A2', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  retryButton: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 10 },
  retryButtonText: { color: GOLD, fontSize: 15, fontWeight: '600' },
});
