import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { NatalChart } from '@astrocalc/calc-engine';
import { ApiError, getProfile } from '../api/profileApi';
import { getSubjectChart } from '../api/subjectsApi';
import { isNetworkError } from '../api/httpClient';
import { fetchChartInterpretation, type ChartInterpretation } from '../api/interpretationApi';
import { computeWheelLayout, type WheelInput } from '../chart/geometry';
import { NatalChartWheel } from '../chart/NatalChartWheel';
import { MissingBirthDataError } from '../offline/natalChartService';
import { loadNatalChart } from '../offline/natalChartServiceWiring';
import { useTranslation } from '../i18n/LocaleContext';

/** What this screen actually reads from a loaded chart — a subset of `NatalChartView`. */
interface ChartView {
  chart: NatalChart;
  source: 'backend' | 'offline';
}

type LoadState =
  { phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'ready'; view: ChartView };

/** Map a computed chart to the pure `WheelInput` `computeWheelLayout()` expects. */
function toWheelInput(chart: NatalChart, size: number): WheelInput {
  return {
    size,
    planets: chart.positions.map((p) => ({
      body: p.body,
      longitude: p.longitude,
      retrograde: p.retrograde,
    })),
    houseCusps: chart.houses?.cusps ?? null,
    ascendantLongitude: chart.houses?.ascendant.longitude ?? null,
    aspects: chart.aspects.map((a) => ({ bodyA: a.bodyA, bodyB: a.bodyB, type: a.type })),
  };
}

/**
 * Natal-chart result screen (#17/#18): loads the user's chart (backend or
 * offline-computed, via `loadNatalChart`), renders it as the gold/dark Skia
 * wheel, and shows its localized interpretation text underneath. The wheel
 * and the reading fail independently — a reading fetch error (or being
 * offline) never blocks the wheel, which needs no network once the chart
 * itself is loaded.
 */
interface NatalChartScreenProps {
  /** When set, shows this saved person's chart (online only) instead of the user's own. */
  subjectId?: string;
  /** The person's name, shown as the title when viewing a subject. */
  subjectName?: string;
}

export function NatalChartScreen({ subjectId, subjectName }: NatalChartScreenProps = {}) {
  const { t, locale } = useTranslation();
  const { width } = useWindowDimensions();
  const wheelSize = Math.min(width - 48, 420);

  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [interpretation, setInterpretation] = useState<ChartInterpretation | null>(null);
  const [interpretationError, setInterpretationError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ phase: 'loading' });
    setInterpretation(null);
    setInterpretationError(null);

    try {
      // A saved subject's chart is fetched from the backend only (no offline
      // path); the user's own chart keeps its offline-capable loader.
      const view = subjectId
        ? { chart: (await getSubjectChart(subjectId)).chart, source: 'backend' as const }
        : await loadNatalChart(await getProfile());
      setState({ phase: 'ready', view });

      try {
        setInterpretation(await fetchChartInterpretation(view.chart, locale));
      } catch (err) {
        setInterpretationError(
          isNetworkError(err)
            ? t('natalChart.readingUnavailableOffline')
            : t('natalChart.readingError'),
        );
      }
    } catch (err) {
      const message =
        err instanceof MissingBirthDataError
          ? t('natalChart.incompleteProfile')
          : err instanceof ApiError
            ? err.message
            : t('natalChart.loadError');
      setState({ phase: 'error', message });
    }
  }, [locale, t, subjectId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const layout = useMemo(() => {
    if (state.phase !== 'ready') return null;
    return computeWheelLayout(toWheelInput(state.view.chart, wheelSize));
  }, [state, wheelSize]);

  if (state.phase === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={GOLD} />
      </View>
    );
  }

  if (state.phase === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{state.message}</Text>
        <Pressable accessibilityRole="button" style={styles.retryButton} onPress={load}>
          <Text style={styles.retryButtonText}>{t('natalChart.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const { view } = state;
  const readingRows = interpretation
    ? [...interpretation.planetSign, ...interpretation.planetHouse]
    : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{subjectName ?? t('natalChart.title')}</Text>

      {view.source === 'offline' ? (
        <Text style={styles.notice}>{t('natalChart.offlineNotice')}</Text>
      ) : null}
      {!view.chart.birthTimeKnown ? (
        <Text style={styles.notice}>{t('natalChart.housesUnavailable')}</Text>
      ) : null}

      {layout ? (
        <View style={styles.wheelWrap}>
          <NatalChartWheel layout={layout} />
        </View>
      ) : null}
      <Text style={styles.retrogradeHint}>{t('natalChart.retrogradeHint')}</Text>

      <Text style={styles.sectionTitle}>{t('natalChart.readingTitle')}</Text>
      {interpretationError ? <Text style={styles.error}>{interpretationError}</Text> : null}
      {readingRows.map((row) => (
        <Text key={`${row.category}-${row.subjectKey}`} style={styles.paragraph}>
          {row.content}
        </Text>
      ))}

      {interpretation && interpretation.aspects.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>{t('natalChart.aspectsTitle')}</Text>
          {interpretation.aspects.map((row) => (
            <Text key={row.subjectKey} style={styles.paragraph}>
              {row.content}
            </Text>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const GOLD = '#E4B95B';
const BG = '#0E0B14';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 24, paddingBottom: 48, alignItems: 'center' },
  centered: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: GOLD,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.5,
    alignSelf: 'flex-start',
  },
  notice: {
    color: GOLD,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  wheelWrap: { marginTop: 20, marginBottom: 8 },
  retrogradeHint: { color: '#6E6A80', fontSize: 11, marginBottom: 20 },
  sectionTitle: {
    color: GOLD,
    fontSize: 16,
    fontWeight: '700',
    alignSelf: 'flex-start',
    marginTop: 12,
    marginBottom: 10,
  },
  paragraph: {
    color: '#B9B4C7',
    fontSize: 14,
    lineHeight: 21,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  error: { color: '#F2A2A2', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  retryButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10 },
  retryButtonText: { color: GOLD, fontSize: 15, fontWeight: '600' },
});
