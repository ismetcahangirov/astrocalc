import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { ChakraName } from '@astrocalc/calc-engine';
import { ApiError, getSubjectMatrix } from '../api/matrixApi';
import { isNetworkError } from '../api/httpClient';
import { fetchChakraReadings, type ChakraReading } from '../api/interpretationApi';
import { getProfile } from '../api/profileApi';
import { MissingMatrixDataError, type MatrixView } from '../offline/matrixService';
import { loadMatrix } from '../offline/matrixServiceWiring';
import { computeChakraFigureLayout, type ChakraNode } from '../matrix/chakraGeometry';
import { ChakraBodyChart } from '../matrix/ChakraBodyChart';
import { CHAKRA_LABELS } from '../matrix/matrixText';
import { useTranslation } from '../i18n/LocaleContext';

/** Mirrors `MatrixScreen`'s phases — `missing` is a one-tap fix, not an error. */
type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'missing' }
  | { phase: 'ready'; view: MatrixView };

function isMissingDataError(err: unknown): boolean {
  return (
    err instanceof MissingMatrixDataError ||
    (err instanceof ApiError && err.code === 'incomplete_profile')
  );
}

interface ChakraScreenProps {
  /** When set, shows this saved person's chakras (online only) instead of the user's own. */
  subjectId?: string;
  /** The person's name, shown as the title when viewing a subject. */
  subjectName?: string;
  /** Called when the user needs to go add their birth date. */
  onEditProfile?: () => void;
}

/**
 * Dedicated Chakra page (#101): the seven chakras of the Matrix health map drawn
 * as the familiar seated figure with a colour-coded disc on each body centre,
 * then a per-chakra breakdown and reading beneath.
 *
 * The chakra *numbers* are the same health map `MatrixScreen` tables — this page
 * is a second, more recognisable view of them, not a second calculation. It loads
 * the Matrix the same offline-capable way, and fetches the reading independently
 * (network-optional) exactly as `MatrixScreen`/`NatalChartScreen` do.
 */
export function ChakraScreen({ subjectId, subjectName, onEditProfile }: ChakraScreenProps = {}) {
  const { t, locale } = useTranslation();
  const { width } = useWindowDimensions();
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [readings, setReadings] = useState<ChakraReading[] | null>(null);
  const [readingError, setReadingError] = useState<string | null>(null);

  const chartSize = Math.min(width - 16, 440);

  const load = useCallback(async () => {
    setState({ phase: 'loading' });
    setReadings(null);
    setReadingError(null);

    let view: MatrixView;
    try {
      view = subjectId
        ? { matrix: (await getSubjectMatrix(subjectId)).matrix, source: 'backend' }
        : await loadMatrix(await getProfile());
      setState({ phase: 'ready', view });
    } catch (err) {
      if (isMissingDataError(err)) {
        setState({ phase: 'missing' });
        return;
      }
      setState({
        phase: 'error',
        message: err instanceof ApiError ? err.message : t('matrix.loadError'),
      });
      return;
    }

    // The reading is fetched separately and allowed to fail on its own — the
    // figure and numbers need no network once the Matrix is loaded.
    try {
      setReadings(await fetchChakraReadings(view.matrix, locale));
    } catch (err) {
      setReadingError(
        isNetworkError(err) ? t('chakra.readingUnavailableOffline') : t('chakra.readingError'),
      );
    }
  }, [t, subjectId, locale]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const layout = useMemo(() => {
    if (state.phase !== 'ready') return null;
    return computeChakraFigureLayout(state.view.matrix, chartSize);
  }, [state, chartSize]);

  const readingByChakra = useMemo(() => {
    const map = new Map<ChakraName, string>();
    for (const r of readings ?? []) map.set(r.chakra, r.content);
    return map;
  }, [readings]);

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
        <Text style={styles.notice}>{t('matrix.missingData')}</Text>
        {onEditProfile ? (
          <Pressable accessibilityRole="button" style={styles.retryButton} onPress={onEditProfile}>
            <Text style={styles.retryButtonText}>{t('matrix.missingDataCta')}</Text>
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
          <Text style={styles.retryButtonText}>{t('matrix.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const { view } = state;
  const names = CHAKRA_LABELS[locale];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{subjectName ?? t('chakra.title')}</Text>
      <Text style={styles.subTitle}>{t('chakra.subtitle')}</Text>

      {view.source === 'offline' ? (
        <Text style={styles.notice}>{t('chakra.offlineNotice')}</Text>
      ) : null}

      {layout ? (
        <View style={styles.canvasWrap}>
          <ChakraBodyChart layout={layout} />
        </View>
      ) : null}

      {readingError ? <Text style={styles.sectionNote}>{readingError}</Text> : null}

      {layout?.nodes.map((node: ChakraNode) => (
        <View key={node.chakra} style={styles.block}>
          <View style={styles.blockHeader}>
            <View style={[styles.dot, { backgroundColor: node.color }]} />
            <Text style={styles.chakraName}>{names[node.chakra]}</Text>
            <Text style={styles.chakraValue}>{node.emotional}</Text>
          </View>
          <Text style={styles.cells}>
            {t('matrix.physical')} {node.physical} · {t('matrix.energy')} {node.energy} ·{' '}
            {t('matrix.emotional')} {node.emotional}
          </Text>
          {readingByChakra.has(node.chakra) ? (
            <Text style={styles.paragraph}>{readingByChakra.get(node.chakra)}</Text>
          ) : null}
        </View>
      ))}
    </ScrollView>
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
  subTitle: { color: '#B9B4C7', fontSize: 14, lineHeight: 20, marginTop: 6 },
  notice: { color: GOLD, fontSize: 13, lineHeight: 18, marginTop: 10, textAlign: 'center' },
  canvasWrap: { alignItems: 'center', marginTop: 16, marginBottom: 4 },
  sectionNote: { color: '#6E6A80', fontSize: 12, lineHeight: 17, marginTop: 10 },
  block: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#221D33',
  },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  chakraName: { color: '#F4F1FA', fontSize: 16, fontWeight: '700', flex: 1 },
  chakraValue: { color: GOLD, fontSize: 16, fontWeight: '700' },
  cells: { color: '#8E8AA0', fontSize: 12.5, marginTop: 4 },
  paragraph: { color: '#B9B4C7', fontSize: 14, lineHeight: 21, marginTop: 8 },
  error: { color: '#F2A2A2', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  retryButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10 },
  retryButtonText: { color: GOLD, fontSize: 15, fontWeight: '600' },
});
