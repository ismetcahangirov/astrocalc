import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ApiError, getSubjectNumerology } from '../api/numerologyApi';
import { getProfile } from '../api/profileApi';
import { MissingNumerologyDataError, type NumerologyView } from '../offline/numerologyService';
import { loadNumerology, localToday } from '../offline/numerologyServiceWiring';
import {
  formatNumerologyDetails,
  type NumerologyPeriodRow,
  type NumerologyRow,
} from '../numerology/numerologyText';
import { useTranslation } from '../i18n/LocaleContext';

/**
 * `'missing'` is deliberately its own phase rather than an `error` message: an
 * incomplete profile is a call to action with a one-tap fix, not a failure, and
 * rendering it in the red error style with a "try again" button would offer the
 * user the one thing that cannot help them.
 */
type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'missing' }
  | { phase: 'ready'; view: NumerologyView };

/** True for the two ways "this profile has no full name / birth date" reaches us. */
function isMissingDataError(err: unknown): boolean {
  return (
    err instanceof MissingNumerologyDataError ||
    (err instanceof ApiError && err.code === 'incomplete_profile')
  );
}

/**
 * Numerology result screen (#66): loads the user's numerology profile (backend
 * or offline-computed, via `loadNumerology`) and renders it as localized rows —
 * the core four, the extended and cycle numbers, and the Pinnacle/Challenge
 * periods with the one the user is currently living marked. The reading section
 * shows only its heading for now; the numerology interpretation content lands
 * with the interpretation-content epic, exactly as the natal chart did.
 */
interface NumerologyScreenProps {
  /** When set, shows this saved person's numbers (online only) instead of the user's own. */
  subjectId?: string;
  /** The person's name, shown as the title when viewing a subject. */
  subjectName?: string;
  /** Called when the user needs to go add their full name. */
  onEditProfile?: () => void;
}

export function NumerologyScreen({
  subjectId,
  subjectName,
  onEditProfile,
}: NumerologyScreenProps = {}) {
  const { t, locale } = useTranslation();
  const [state, setState] = useState<LoadState>({ phase: 'loading' });

  const load = useCallback(async () => {
    setState({ phase: 'loading' });

    // The device's local date, never the server's guess: the Personal Year/Month
    // numbers and the current-Pinnacle marker all turn over at local midnight.
    const today = localToday();

    try {
      // A saved subject's numbers are fetched from the backend only (no offline
      // path); the user's own keep their offline-capable loader.
      const view: NumerologyView = subjectId
        ? { profile: (await getSubjectNumerology(subjectId, today)).profile, source: 'backend' }
        : await loadNumerology(await getProfile(), today);
      setState({ phase: 'ready', view });
    } catch (err) {
      if (isMissingDataError(err)) {
        setState({ phase: 'missing' });
        return;
      }
      setState({
        phase: 'error',
        message: err instanceof ApiError ? err.message : t('numerology.loadError'),
      });
    }
  }, [t, subjectId]);

  // Reload on focus, not just on mount — the "add your full name" prompt pushes
  // the profile screen on top of this one, so coming back must re-ask rather
  // than redisplay the stale prompt. Cheap to redo, and correct for a result
  // that is deliberately never cached (see `numerologyService.ts`).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const details = useMemo(() => {
    if (state.phase !== 'ready') return null;
    return formatNumerologyDetails(state.view.profile, locale, {
      master: t('numerology.masterBadge'),
      karmicDebt: t('numerology.karmicDebtBadge'),
      pinnacle: t('numerology.pinnacle'),
      challenge: t('numerology.challenge'),
    });
  }, [state, locale, t]);

  if (state.phase === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={GOLD} />
      </View>
    );
  }

  if (state.phase === 'missing') {
    return (
      <View style={styles.centered}>
        <Text style={styles.notice}>{t('numerology.missingData')}</Text>
        {onEditProfile ? (
          <Pressable accessibilityRole="button" style={styles.retryButton} onPress={onEditProfile}>
            <Text style={styles.retryButtonText}>{t('numerology.missingDataCta')}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (state.phase === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{state.message}</Text>
        <Pressable accessibilityRole="button" style={styles.retryButton} onPress={load}>
          <Text style={styles.retryButtonText}>{t('numerology.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const { view } = state;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{subjectName ?? t('numerology.title')}</Text>
      <Text style={styles.subTitle}>{t('numerology.subtitle')}</Text>

      {view.source === 'offline' ? (
        <Text style={styles.notice}>{t('numerology.offlineNotice')}</Text>
      ) : null}

      {details ? (
        <>
          <Text style={styles.sectionTitle}>{t('numerology.coreTitle')}</Text>
          {details.core.map((row) => (
            <NumberRow key={row.key} row={row} />
          ))}

          <Text style={styles.sectionTitle}>{t('numerology.extendedTitle')}</Text>
          {details.extended.map((row) => (
            <NumberRow key={row.key} row={row} />
          ))}

          <Text style={styles.sectionTitle}>{t('numerology.cyclesTitle')}</Text>
          {details.cycles.map((row) => (
            <NumberRow key={row.key} row={row} />
          ))}

          <Text style={styles.sectionTitle}>{t('numerology.pinnaclesTitle')}</Text>
          {details.pinnacles.map((row) => (
            <PeriodRow key={row.key} row={row} currentLabel={t('numerology.currentBadge')} />
          ))}

          <Text style={styles.sectionTitle}>{t('numerology.challengesTitle')}</Text>
          {details.challenges.map((row) => (
            <PeriodRow key={row.key} row={row} currentLabel={t('numerology.currentBadge')} />
          ))}
        </>
      ) : null}

      <Text style={styles.sectionTitle}>{t('numerology.readingTitle')}</Text>
    </ScrollView>
  );
}

/** One labelled number, with its master / karmic-debt provenance when it has any. */
function NumberRow({ row }: { row: NumerologyRow }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailName}>{row.label}</Text>
      <Text style={styles.detailValue}>
        {row.value}
        {row.badge ? <Text style={styles.badge}> · {row.badge}</Text> : null}
      </Text>
    </View>
  );
}

/**
 * One Pinnacle or Challenge. The age range is what makes these periods worth
 * showing at all, so it is always printed, and the period the user is living is
 * marked in the accent colour — "which one am I in" has to read at a glance.
 */
function PeriodRow({ row, currentLabel }: { row: NumerologyPeriodRow; currentLabel: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={row.isCurrent ? styles.detailNameCurrent : styles.detailName}>
        {row.label}
        <Text style={styles.ageRange}> {row.ageRange}</Text>
        {row.isCurrent ? <Text style={styles.currentBadge}> · {currentLabel}</Text> : null}
      </Text>
      <Text style={styles.detailValue}>
        {row.value}
        {row.badge ? <Text style={styles.badge}> · {row.badge}</Text> : null}
      </Text>
    </View>
  );
}

const GOLD = '#E4B95B';
const BG = '#0E0B14';

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
  title: { color: GOLD, fontSize: 26, fontWeight: '700', letterSpacing: 0.5 },
  notice: { color: GOLD, fontSize: 13, lineHeight: 18, marginTop: 10, textAlign: 'center' },
  sectionTitle: {
    color: GOLD,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 22,
    marginBottom: 6,
  },
  subTitle: { color: '#B9B4C7', fontSize: 14, lineHeight: 20, marginTop: 6 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#221D33',
  },
  detailName: { color: '#F4F1FA', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  detailNameCurrent: { color: GOLD, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  detailValue: { color: '#B9B4C7', fontSize: 13, textAlign: 'right', flexShrink: 1 },
  ageRange: { color: '#6E6A80', fontSize: 12, fontWeight: '400' },
  badge: { color: '#6E6A80', fontSize: 12 },
  currentBadge: { color: GOLD, fontSize: 12, fontWeight: '700' },
  error: { color: '#F2A2A2', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  retryButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10 },
  retryButtonText: { color: GOLD, fontSize: 15, fontWeight: '600' },
});
