import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ApiError, getSubjectNumerology } from '../api/numerologyApi';
import { fetchInterpretationMap } from '../api/interpretationApi';
import { isNetworkError } from '../api/httpClient';
import { getProfile } from '../api/profileApi';
import { MissingNumerologyDataError, type NumerologyView } from '../offline/numerologyService';
import { loadNumerology, localToday } from '../offline/numerologyServiceWiring';
import {
  formatNumerologyDetails,
  type NumerologyDetails,
  type NumerologyPeriodRow,
  type NumerologyRow,
} from '../numerology/numerologyText';
import { AccordionRow } from '../chart/AccordionRow';
import { HomeButton } from '../common/HomeButton';
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

/** Every row across every section — the flat list a batch interpretation fetch needs. */
function allRows(details: NumerologyDetails): (NumerologyRow | NumerologyPeriodRow)[] {
  return [
    ...details.core,
    ...details.extended,
    ...details.cycles,
    ...details.pinnacles,
    ...details.challenges,
  ];
}

/**
 * Numerology result screen (#66): loads the user's numerology profile (backend
 * or offline-computed, via `loadNumerology`) and renders it as localized rows —
 * the core four, the extended and cycle numbers, and the Pinnacle/Challenge
 * periods with the one the user is currently living marked. Every row taps
 * open, accordion-style, to reveal its (separately-fetched) meaning, only one
 * open at a time — the same pattern `NatalChartScreen` uses (#106).
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
  const [meaning, setMeaning] = useState<Map<string, string>>(new Map());
  const [readingError, setReadingError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ phase: 'loading' });
    setMeaning(new Map());
    setReadingError(null);

    // The device's local date, never the server's guess: the Personal Year/Month
    // numbers and the current-Pinnacle marker all turn over at local midnight.
    const today = localToday();

    let view: NumerologyView;
    try {
      // A saved subject's numbers are fetched from the backend only (no offline
      // path); the user's own keep their offline-capable loader.
      view = subjectId
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
      return;
    }

    // The reading is fetched separately and allowed to fail on its own — the
    // computed numbers need no network once the profile itself is loaded.
    try {
      const details = formatNumerologyDetails(view.profile, locale, {
        master: t('numerology.masterBadge'),
        karmicDebt: t('numerology.karmicDebtBadge'),
        pinnacle: t('numerology.pinnacle'),
        challenge: t('numerology.challenge'),
      });
      const subjects = allRows(details).map((row) => ({
        category: 'numerology' as const,
        subjectKey: row.subjectKey,
      }));
      setMeaning(await fetchInterpretationMap(subjects, locale));
    } catch (err) {
      setReadingError(
        isNetworkError(err)
          ? t('numerology.readingUnavailableOffline')
          : t('numerology.readingError'),
      );
    }
  }, [t, subjectId, locale]);

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

  const toggle = useCallback((key: string) => setOpenKey((cur) => (cur === key ? null : key)), []);

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

  // The meaning paragraph for a row's subjectKey, or a short note when the
  // reading hasn't loaded (offline / fetch error).
  const renderMeaning = (subjectKey: string) => {
    const content = meaning.get(subjectKey);
    if (!content) {
      return (
        <Text style={styles.rowNote}>{readingError ?? t('numerology.readingRowUnavailable')}</Text>
      );
    }
    return <Text style={styles.rowMeaning}>{content}</Text>;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <HomeButton />
        <Text style={styles.title}>{subjectName ?? t('numerology.title')}</Text>
      </View>
      <Text style={styles.subTitle}>{t('numerology.subtitle')}</Text>

      {view.source === 'offline' ? (
        <Text style={styles.notice}>{t('numerology.offlineNotice')}</Text>
      ) : null}

      {details ? (
        <>
          <Text style={styles.sectionTitle}>{t('numerology.coreTitle')}</Text>
          {details.core.map((row) => (
            <NumberRow
              key={row.key}
              row={row}
              openKey={openKey}
              onToggle={toggle}
              renderMeaning={renderMeaning}
            />
          ))}

          <Text style={styles.sectionTitle}>{t('numerology.extendedTitle')}</Text>
          {details.extended.map((row) => (
            <NumberRow
              key={row.key}
              row={row}
              openKey={openKey}
              onToggle={toggle}
              renderMeaning={renderMeaning}
            />
          ))}

          <Text style={styles.sectionTitle}>{t('numerology.cyclesTitle')}</Text>
          {details.cycles.map((row) => (
            <NumberRow
              key={row.key}
              row={row}
              openKey={openKey}
              onToggle={toggle}
              renderMeaning={renderMeaning}
            />
          ))}

          <Text style={styles.sectionTitle}>{t('numerology.pinnaclesTitle')}</Text>
          {details.pinnacles.map((row) => (
            <PeriodRow
              key={row.key}
              row={row}
              currentLabel={t('numerology.currentBadge')}
              openKey={openKey}
              onToggle={toggle}
              renderMeaning={renderMeaning}
            />
          ))}

          <Text style={styles.sectionTitle}>{t('numerology.challengesTitle')}</Text>
          {details.challenges.map((row) => (
            <PeriodRow
              key={row.key}
              row={row}
              currentLabel={t('numerology.currentBadge')}
              openKey={openKey}
              onToggle={toggle}
              renderMeaning={renderMeaning}
            />
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

/** One labelled number, with its master / karmic-debt provenance folded into the value. */
function NumberRow({
  row,
  openKey,
  onToggle,
  renderMeaning,
}: {
  row: NumerologyRow;
  openKey: string | null;
  onToggle: (key: string) => void;
  renderMeaning: (subjectKey: string) => ReactNode;
}) {
  const key = `num-${row.key}`;
  return (
    <AccordionRow
      name={row.label}
      value={row.badge ? `${row.value} · ${row.badge}` : row.value}
      expanded={openKey === key}
      onToggle={() => onToggle(key)}
    >
      {renderMeaning(row.subjectKey)}
    </AccordionRow>
  );
}

/**
 * One Pinnacle or Challenge. The age range is what makes these periods worth
 * showing at all, so it is always printed as a tag next to the label, and the
 * period the user is living is marked in the accent colour — "which one am I
 * in" has to read at a glance.
 */
function PeriodRow({
  row,
  currentLabel,
  openKey,
  onToggle,
  renderMeaning,
}: {
  row: NumerologyPeriodRow;
  currentLabel: string;
  openKey: string | null;
  onToggle: (key: string) => void;
  renderMeaning: (subjectKey: string) => ReactNode;
}) {
  const key = `num-${row.key}`;
  return (
    <AccordionRow
      name={row.label}
      tag={
        <Text style={styles.ageRange}>
          {' '}
          {row.ageRange}
          {row.isCurrent ? <Text style={styles.currentBadge}> · {currentLabel}</Text> : null}
        </Text>
      }
      value={row.badge ? `${row.value} · ${row.badge}` : row.value}
      expanded={openKey === key}
      onToggle={() => onToggle(key)}
    >
      {renderMeaning(row.subjectKey)}
    </AccordionRow>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  ageRange: { color: '#6E6A80', fontSize: 12, fontWeight: '400' },
  currentBadge: { color: GOLD, fontSize: 12, fontWeight: '700' },
  rowMeaning: { color: '#B9B4C7', fontSize: 13, lineHeight: 20, marginBottom: 8 },
  rowNote: { color: '#6E6A80', fontSize: 12, fontStyle: 'italic' },
  error: { color: '#F2A2A2', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  retryButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10 },
  retryButtonText: { color: GOLD, fontSize: 15, fontWeight: '600' },
});
