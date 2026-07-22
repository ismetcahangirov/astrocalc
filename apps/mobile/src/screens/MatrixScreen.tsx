import { useCallback, useMemo, useState, type ReactNode } from 'react';
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
import { ApiError, getSubjectMatrix } from '../api/matrixApi';
import { fetchInterpretationMap } from '../api/interpretationApi';
import { isNetworkError } from '../api/httpClient';
import { getProfile } from '../api/profileApi';
import { MissingMatrixDataError, type MatrixView } from '../offline/matrixService';
import { loadMatrix } from '../offline/matrixServiceWiring';
import { computeOctagramLayout } from '../matrix/geometry';
import { OctagramChart } from '../matrix/OctagramChart';
import {
  formatMatrixDetails,
  type MatrixChakraRow,
  type MatrixDetails,
  type MatrixRow,
} from '../matrix/matrixText';
import { AccordionRow } from '../chart/AccordionRow';
import { useTranslation } from '../i18n/LocaleContext';

/**
 * `'missing'` is deliberately its own phase rather than an `error` message: a
 * profile with no birth date is a call to action with a one-tap fix, not a
 * failure, and rendering it in the red error style with a "try again" button
 * would offer the user the one thing that cannot help them. (Same reasoning as
 * `NumerologyScreen`.)
 */
type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'missing' }
  | { phase: 'ready'; view: MatrixView };

/** True for the two ways "this profile has no birth date" reaches us. */
function isMissingDataError(err: unknown): boolean {
  return (
    err instanceof MissingMatrixDataError ||
    (err instanceof ApiError && err.code === 'incomplete_profile')
  );
}

/** Every row across every section that carries a reading — health excludes the summary. */
function allRows(details: MatrixDetails): (MatrixRow | MatrixChakraRow)[] {
  return [
    ...details.core,
    ...details.ancestral,
    ...details.purposes,
    ...details.moneyAndRelationships,
    ...details.health,
  ];
}

interface MatrixScreenProps {
  /** When set, shows this saved person's Matrix (online only) instead of the user's own. */
  subjectId?: string;
  /** The person's name, shown as the title when viewing a subject. */
  subjectName?: string;
  /** Called when the user needs to go add their birth date. */
  onEditProfile?: () => void;
}

/**
 * Matrix of Destiny result screen (#75): loads the Matrix (backend or
 * offline-computed, via `loadMatrix`), draws the octagram, and renders the full
 * written breakdown beneath it. Every position (core, ancestral, purposes,
 * money/relationships, chakras) taps open, accordion-style, to reveal its
 * (separately-fetched) meaning — only one row open at a time, same pattern as
 * `NatalChartScreen`/`NumerologyScreen` (#106).
 *
 * The breakdown is not a fallback for the figure — it is the primary way to read
 * the result. An octagram tells a first-time viewer nothing about which point is
 * which, and several positions (the purposes, the money/relationship line, the
 * chakra map) have no agreed place on the figure at all, so they exist only
 * below it.
 */
export function MatrixScreen({ subjectId, subjectName, onEditProfile }: MatrixScreenProps = {}) {
  const { t, locale } = useTranslation();
  const { width } = useWindowDimensions();
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [meaning, setMeaning] = useState<Map<string, string>>(new Map());
  const [readingError, setReadingError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const octagramSize = Math.min(width - 48, 420);

  const load = useCallback(async () => {
    setState({ phase: 'loading' });
    setMeaning(new Map());
    setReadingError(null);

    let view: MatrixView;
    try {
      // A saved subject's Matrix is fetched from the backend only (no offline
      // path); the user's own keeps its offline-capable loader.
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
      const details = formatMatrixDetails(view.matrix, locale);
      const subjects = allRows(details).map((row) => ({
        category: 'matrix' as const,
        subjectKey: row.subjectKey!,
      }));
      setMeaning(await fetchInterpretationMap(subjects, locale));
    } catch (err) {
      setReadingError(
        isNetworkError(err) ? t('matrix.readingUnavailableOffline') : t('matrix.readingError'),
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
    return computeOctagramLayout(state.view.matrix, octagramSize);
  }, [state, octagramSize]);

  const details = useMemo(() => {
    if (state.phase !== 'ready') return null;
    return formatMatrixDetails(state.view.matrix, locale);
  }, [state, locale]);

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

  const renderMeaning = (subjectKey: string | undefined) => {
    const content = subjectKey ? meaning.get(subjectKey) : undefined;
    if (!content) {
      return <Text style={styles.rowNote}>{readingError ?? t('matrix.readingRowUnavailable')}</Text>;
    }
    return <Text style={styles.rowMeaning}>{content}</Text>;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{subjectName ?? t('matrix.title')}</Text>
      <Text style={styles.subTitle}>{t('matrix.subtitle')}</Text>

      {view.source === 'offline' ? (
        <Text style={styles.notice}>{t('matrix.offlineNotice')}</Text>
      ) : null}

      {layout ? (
        <View style={styles.canvasWrap}>
          <OctagramChart
            layout={layout}
            maleLineLabel={t('matrix.maleLine')}
            femaleLineLabel={t('matrix.femaleLine')}
          />
        </View>
      ) : null}

      {details ? (
        <>
          <Text style={styles.sectionTitle}>{t('matrix.coreTitle')}</Text>
          {details.core.map((row) => (
            <ValueRow key={row.key} row={row} openKey={openKey} onToggle={toggle} renderMeaning={renderMeaning} />
          ))}

          <Text style={styles.sectionTitle}>{t('matrix.ancestralTitle')}</Text>
          {details.ancestral.map((row) => (
            <ValueRow key={row.key} row={row} openKey={openKey} onToggle={toggle} renderMeaning={renderMeaning} />
          ))}

          <Text style={styles.sectionTitle}>{t('matrix.purposesTitle')}</Text>
          {details.purposes.map((row) => (
            <ValueRow key={row.key} row={row} openKey={openKey} onToggle={toggle} renderMeaning={renderMeaning} />
          ))}

          <Text style={styles.sectionTitle}>{t('matrix.moneyTitle')}</Text>
          {/* Both readings share these five arcana — see `lines.ts`. Saying so
              here keeps a user from reading the section as money-only. */}
          <Text style={styles.sectionNote}>{t('matrix.moneyNote')}</Text>
          {details.moneyAndRelationships.map((row) => (
            <ValueRow key={row.key} row={row} openKey={openKey} onToggle={toggle} renderMeaning={renderMeaning} />
          ))}

          <Text style={styles.sectionTitle}>{t('matrix.healthTitle')}</Text>
          <View style={styles.chakraHeader}>
            <Text style={styles.chakraHeaderName} />
            <Text style={styles.chakraHeaderCell}>{t('matrix.physical')}</Text>
            <Text style={styles.chakraHeaderCell}>{t('matrix.energy')}</Text>
            <Text style={styles.chakraHeaderCell}>{t('matrix.emotional')}</Text>
          </View>
          {details.health.map((row) => (
            <ChakraLine key={row.key} row={row} openKey={openKey} onToggle={toggle} renderMeaning={renderMeaning} />
          ))}
          {/* The summary row totals each column and has no reading — it stays a
              plain, non-expandable row so it reads as a total, not an eighth chakra. */}
          <View style={styles.chakraRow}>
            <View style={[styles.summaryRow, styles.chakraRowInner]}>
              <Text style={styles.summaryName}>{details.healthSummary.label}</Text>
              <Text style={styles.chakraCell}>{details.healthSummary.physical}</Text>
              <Text style={styles.chakraCell}>{details.healthSummary.energy}</Text>
              <Text style={styles.chakraCell}>{details.healthSummary.emotional}</Text>
            </View>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

/** One labelled arcana, expandable to its meaning. */
function ValueRow({
  row,
  openKey,
  onToggle,
  renderMeaning,
}: {
  row: MatrixRow;
  openKey: string | null;
  onToggle: (key: string) => void;
  renderMeaning: (subjectKey: string | undefined) => ReactNode;
}) {
  const key = `mtx-${row.key}`;
  return (
    <AccordionRow name={row.label} value={row.value} expanded={openKey === key} onToggle={() => onToggle(key)}>
      {renderMeaning(row.subjectKey)}
    </AccordionRow>
  );
}

/** One chakra row: three numbers under the physical/energy/emotional columns, expandable. */
function ChakraLine({
  row,
  openKey,
  onToggle,
  renderMeaning,
}: {
  row: MatrixChakraRow;
  openKey: string | null;
  onToggle: (key: string) => void;
  renderMeaning: (subjectKey: string | undefined) => ReactNode;
}) {
  const key = `mtx-chakra-${row.key}`;
  return (
    <AccordionRow
      name={row.label}
      value={`${row.physical} / ${row.energy} / ${row.emotional}`}
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
  title: { color: GOLD, fontSize: 26, fontWeight: '700', letterSpacing: 0.5 },
  subTitle: { color: '#B9B4C7', fontSize: 14, lineHeight: 20, marginTop: 6 },
  notice: { color: GOLD, fontSize: 13, lineHeight: 18, marginTop: 10, textAlign: 'center' },
  canvasWrap: { alignItems: 'center', marginTop: 20 },
  sectionTitle: { color: GOLD, fontSize: 16, fontWeight: '700', marginTop: 22, marginBottom: 6 },
  sectionNote: { color: '#6E6A80', fontSize: 12, lineHeight: 17, marginBottom: 6 },
  chakraHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 4 },
  chakraHeaderName: { flex: 1 },
  chakraHeaderCell: { color: '#6E6A80', fontSize: 11, width: 52, textAlign: 'center' },
  chakraRow: { alignSelf: 'stretch' },
  chakraRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  chakraCell: { color: GOLD, fontSize: 14, width: 52, textAlign: 'center' },
  summaryRow: { borderTopWidth: 1, borderTopColor: '#3A3352', marginTop: 2 },
  summaryName: { color: GOLD, fontSize: 14, fontWeight: '700', flex: 1 },
  rowMeaning: { color: '#B9B4C7', fontSize: 13, lineHeight: 20, marginBottom: 8 },
  rowNote: { color: '#6E6A80', fontSize: 12, fontStyle: 'italic' },
  error: { color: '#F2A2A2', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  retryButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10 },
  retryButtonText: { color: GOLD, fontSize: 15, fontWeight: '600' },
});
