# Numerology/Matrix/Chakra Detail Accordions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every detail row on the Numerology, Matrix, and Chakra screens a single-open accordion that reveals its seeded interpretation meaning on tap, exactly like the Natal Chart screen shipped in PR #107.

**Architecture:** Reuse `AccordionRow` (`apps/mobile/src/chart/AccordionRow.tsx`) unmodified except for one backward-compatible optional `leading` slot needed only by the Chakra screen's colour dot. Each pure `*Text.ts` formatter attaches an `interpretation` `subjectKey` to every row it already produces, using the existing `numerologySubjectKey`/`matrixSubjectKey` builders from `@astrocalc/calc-engine`. Each screen fetches its interpretation content in one `POST /interpretations/batch` call via a new shared `fetchInterpretationMap` helper, builds a `Map<subjectKey, content>`, and renders every row through `AccordionRow` with a `renderMeaning(subjectKey)` helper mirroring `NatalChartScreen`. No backend, calc-engine, or seed changes — content already exists.

**Tech Stack:** React Native / Expo Router, TypeScript, vitest (mobile pure-`.ts` tests only).

---

## Task 0: Branch setup

**Files:** none (git/GitHub only)

- [ ] **Step 1: Sync main**

```bash
git checkout main && git pull origin main
```

- [ ] **Step 2: Create the tracking issue**

```bash
gh issue create \
  --title "Expandable accordion meanings on Numerology, Matrix, and Chakra screens" \
  --label mobile \
  --body "Extend the accordion-meaning pattern shipped for the Natal Chart screen (#106/#107) to the Numerology, Matrix, and Chakra screens: every detail row becomes a single-open accordion revealing its seeded interpretation. Mobile-only — content already seeded (numerology 185 subjects, matrix 682 subjects incl. chakras)."
```

Record the printed issue number — call it `<N>` below.

- [ ] **Step 3: Branch**

```bash
git checkout -b feat/<N>-accordions-numerology-matrix-chakra
```

---

## Task 1: Extend `AccordionRow` with an optional `leading` slot

**Files:**
- Modify: `apps/mobile/src/chart/AccordionRow.tsx`

Only the Chakra screen needs this (to keep its coloured dot). It is purely additive — `name`, `value`, `tag`, `expanded`, `onToggle`, `children` are unchanged, so `NatalChartScreen` needs no edits.

- [ ] **Step 1: Add the prop and render it**

Edit the `AccordionRowProps` interface and the header markup:

```tsx
interface AccordionRowProps {
  name: string;
  value: string;
  /** Small tag rendered after the name, e.g. a retrograde "R". */
  tag?: ReactNode;
  /** Optional element rendered before the name, e.g. a coloured dot. */
  leading?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  /** The meaning content revealed when expanded. */
  children: ReactNode;
}
```

```tsx
export function AccordionRow({
  name,
  value,
  tag,
  leading,
  expanded,
  onToggle,
  children,
}: AccordionRowProps) {
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          onToggle();
        }}
        style={styles.header}
      >
        <View style={styles.left}>
          {leading}
          <Text style={styles.name}>
            {name}
            {tag}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.value}>{value}</Text>
          <Text style={styles.caret}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}
```

Add a `left` style (flex row so a leading dot sits before the name, still shrinking correctly) and give `name` `flexShrink: 1` inside it — it already has that. Add to the `StyleSheet.create` call:

```tsx
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
```

- [ ] **Step 2: Typecheck**

```bash
npm --workspace @astrocalc/mobile run typecheck
```

Expected: clean (no existing caller passes `leading`, so nothing else changes).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/chart/AccordionRow.tsx
git commit -m "$(cat <<'EOF'
feat: add optional leading slot to AccordionRow

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Shared `fetchInterpretationMap` helper

**Files:**
- Modify: `apps/mobile/src/api/interpretationApi.ts`

- [ ] **Step 1: Add the function**

Append to `apps/mobile/src/api/interpretationApi.ts` (after `fetchChakraReadings`, reusing the already-defined `BatchInterpretationResponse` and `parseJson`):

```ts
/**
 * Fetch a batch of numerology or matrix interpretations and collapse them into
 * a `subjectKey → content` map — the shape every accordion screen's
 * `renderMeaning` helper looks up from. Subject keys are unique within a
 * category and each screen only ever asks for one category per call, so a
 * flat map (no category namespacing) is enough.
 *
 * Throws {@link ApiError} with code `network_error` when offline, exactly like
 * {@link fetchChartInterpretation} and {@link fetchChakraReadings} — the
 * caller's cue to show a "needs a connection" note while still rendering the
 * computed numbers.
 */
export async function fetchInterpretationMap(
  subjects: { category: 'numerology' | 'matrix'; subjectKey: string }[],
  locale: InterpretationLocale,
): Promise<Map<string, string>> {
  const res = await authedFetch('/interpretations/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale, subjects }),
  });
  const { results } = await parseJson<BatchInterpretationResponse>(
    res,
    'Could not load your reading. Please try again.',
  );
  return new Map(results.map((r) => [r.subjectKey, r.content]));
}
```

- [ ] **Step 2: Typecheck**

```bash
npm --workspace @astrocalc/mobile run typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/api/interpretationApi.ts
git commit -m "$(cat <<'EOF'
feat: add fetchInterpretationMap batch-interpretation helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `numerologyText.ts` — attach `subjectKey` to every row

**Files:**
- Modify: `apps/mobile/src/numerology/numerologyText.ts`
- Test: `apps/mobile/src/numerology/numerologyText.test.ts`

- [ ] **Step 1: Write the failing test assertions**

Add to `apps/mobile/src/numerology/numerologyText.test.ts`, inside a new `describe` block at the end of the file:

```ts
describe('formatNumerologyDetails — interpretation subject keys', () => {
  it('attaches the right subjectKey to core, cycle, pinnacle and challenge rows', () => {
    const { core, cycles, pinnacles, challenges } = formatNumerologyDetails(
      makeProfile(),
      'en',
      EN_LABELS,
    );

    expect(core.find((r) => r.key === 'lifePath')!.subjectKey).toBe('life-path-11');
    expect(cycles.find((r) => r.key === 'personalYear')!.subjectKey).toBe('personal-year-5');
    expect(pinnacles[0]!.subjectKey).toBe('pinnacle-1-6');
    expect(challenges[0]!.subjectKey).toBe('challenge-1-2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm --workspace @astrocalc/mobile run test -- numerologyText
```

Expected: FAIL — `subjectKey` is `undefined` (property doesn't exist yet).

- [ ] **Step 3: Implement**

In `apps/mobile/src/numerology/numerologyText.ts`, add the import and the kind maps, then wire them through `row`/`plainRow`/`pinnacles`/`challenges`:

```ts
import type { NumerologyNumber, NumerologyNumberKind, NumerologyProfile } from '@astrocalc/calc-engine';
import { numerologySubjectKey } from '@astrocalc/calc-engine';
import type { Locale } from '../i18n/translations';
```

Add, near `NUMBER_LABELS`:

```ts
/** Maps each `NUMBER_LABELS` key to its `numerologySubjectKey` kind. */
const NUMBER_KEY_TO_KIND: Record<keyof typeof NUMBER_LABELS.en, NumerologyNumberKind> = {
  lifePath: 'life-path',
  expression: 'expression',
  soulUrge: 'soul-urge',
  personality: 'personality',
  birthday: 'birthday',
  maturity: 'maturity',
  personalYear: 'personal-year',
  personalMonth: 'personal-month',
};
```

Update the two row interfaces:

```ts
export interface NumerologyRow {
  key: string;
  label: string;
  /** The number, as a string. */
  value: string;
  /** Localized "master number" / "karmic debt 19", or null. */
  badge: string | null;
  /** Interpretation key for this number, e.g. `life-path-11`. */
  subjectKey: string;
}

export interface NumerologyPeriodRow {
  key: string;
  label: string;
  value: string;
  /**
   * Localized "master number" / "karmic debt 13", or null — same provenance the
   * core rows carry. Always `null` for Challenges, which are plain 0–8
   * subtractions with no master or karmic-debt concept; that is an absence in
   * the domain, not an omission here.
   */
  badge: string | null;
  /** e.g. `0–34`, or `53+` for the open-ended final period. */
  ageRange: string;
  isCurrent: boolean;
  /** Interpretation key for this period, e.g. `pinnacle-1-6`. */
  subjectKey: string;
}
```

Update `formatNumerologyDetails`'s `row`/`plainRow` closures and the pinnacles/challenges maps:

```ts
  const row = (key: keyof typeof names, number: NumerologyNumber): NumerologyRow => ({
    key,
    label: names[key],
    value: String(number.value),
    badge: badgeFor(number, labels),
    subjectKey: numerologySubjectKey(NUMBER_KEY_TO_KIND[key], number.value),
  });

  /** A number with no master/karmic-debt provenance to report (birthday, cycles). */
  const plainRow = (key: keyof typeof names, value: number): NumerologyRow => ({
    key,
    label: names[key],
    value: String(value),
    badge: null,
    subjectKey: numerologySubjectKey(NUMBER_KEY_TO_KIND[key], value),
  });
```

```ts
    pinnacles: profile.pinnacles.map((p) => ({
      key: `pinnacle-${p.index}`,
      label: `${labels.pinnacle} ${p.index}`,
      value: String(p.number.value),
      badge: badgeFor(p.number, labels),
      ageRange: formatAgeRange(p.startAge, p.endAge),
      isCurrent: p.index === profile.currentPinnacle,
      subjectKey: numerologySubjectKey(`pinnacle-${p.index}`, p.number.value),
    })),
    challenges: profile.challenges.map((c) => ({
      key: `challenge-${c.index}`,
      label: `${labels.challenge} ${c.index}`,
      value: String(c.value),
      // Challenges are plain 0–8 values: no master numbers, no karmic debt.
      badge: null,
      ageRange: formatAgeRange(c.startAge, c.endAge),
      isCurrent: c.index === profile.currentChallenge,
      subjectKey: numerologySubjectKey(`challenge-${c.index}`, c.value),
    })),
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm --workspace @astrocalc/mobile run test -- numerologyText
```

Expected: PASS, all existing + new assertions green.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/numerology/numerologyText.ts apps/mobile/src/numerology/numerologyText.test.ts
git commit -m "$(cat <<'EOF'
feat: attach interpretation subjectKey to numerology rows

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `NumerologyScreen.tsx` — wire accordions

**Files:**
- Modify: `apps/mobile/src/screens/NumerologyScreen.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts` (new keys, done together since the screen references them immediately)

- [ ] **Step 1: Add translation keys**

In `apps/mobile/src/i18n/translations.ts`, `en` block, replace the single `'numerology.readingTitle': 'Your Reading',` line with:

```ts
  'numerology.readingError': "Couldn't load your reading. Please try again.",
  'numerology.readingUnavailableOffline': 'Your reading needs an internet connection.',
  'numerology.readingRowUnavailable': 'Connect to the internet to see this reading.',
```

(Keep `'numerology.readingTitle'` itself in place — it becomes unused but is harmless, per the shared instructions.)

In the `az` block, replace `'numerology.readingTitle': 'Sizin Şərhiniz',`'s neighbourhood by adding, right after it:

```ts
  'numerology.readingError': 'Şərhiniz yüklənmədi. Yenidən cəhd edin.',
  'numerology.readingUnavailableOffline': 'Şərhiniz üçün internet bağlantısı lazımdır.',
  'numerology.readingRowUnavailable': 'Bu açıqlamanı görmək üçün internetə qoşulun.',
```

- [ ] **Step 2: Rewrite the screen**

Replace the full contents of `apps/mobile/src/screens/NumerologyScreen.tsx` with:

```tsx
import { useCallback, useMemo, useState } from 'react';
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
        isNetworkError(err) ? t('numerology.readingUnavailableOffline') : t('numerology.readingError'),
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
      <Text style={styles.title}>{subjectName ?? t('numerology.title')}</Text>
      <Text style={styles.subTitle}>{t('numerology.subtitle')}</Text>

      {view.source === 'offline' ? (
        <Text style={styles.notice}>{t('numerology.offlineNotice')}</Text>
      ) : null}

      {details ? (
        <>
          <Text style={styles.sectionTitle}>{t('numerology.coreTitle')}</Text>
          {details.core.map((row) => (
            <NumberRow key={row.key} row={row} openKey={openKey} onToggle={toggle} renderMeaning={renderMeaning} />
          ))}

          <Text style={styles.sectionTitle}>{t('numerology.extendedTitle')}</Text>
          {details.extended.map((row) => (
            <NumberRow key={row.key} row={row} openKey={openKey} onToggle={toggle} renderMeaning={renderMeaning} />
          ))}

          <Text style={styles.sectionTitle}>{t('numerology.cyclesTitle')}</Text>
          {details.cycles.map((row) => (
            <NumberRow key={row.key} row={row} openKey={openKey} onToggle={toggle} renderMeaning={renderMeaning} />
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
  renderMeaning: (subjectKey: string) => React.ReactNode;
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
  renderMeaning: (subjectKey: string) => React.ReactNode;
}) {
  const key = `num-${row.key}`;
  return (
    <AccordionRow
      name={row.label}
      tag={
        <Text style={row.isCurrent ? styles.currentBadge : styles.ageRange}>
          {' '}
          {row.ageRange}
          {row.isCurrent ? ` · ${currentLabel}` : ''}
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
```

- [ ] **Step 3: Typecheck**

```bash
npm --workspace @astrocalc/mobile run typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/screens/NumerologyScreen.tsx apps/mobile/src/i18n/translations.ts
git commit -m "$(cat <<'EOF'
feat: numerology detail rows are expandable accordions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `matrixText.ts` — attach `subjectKey` to every row

**Files:**
- Modify: `apps/mobile/src/matrix/matrixText.ts`
- Test: `apps/mobile/src/matrix/matrixText.test.ts`

- [ ] **Step 1: Write the failing test assertions**

Add to `apps/mobile/src/matrix/matrixText.test.ts`, in a new `describe` block at the end:

```ts
describe('formatMatrixDetails — interpretation subject keys', () => {
  it('attaches the right subjectKey to core, purpose, line and chakra rows', () => {
    const details = formatMatrixDetails(MATRIX, 'en');

    const centre = details.core.find((r) => r.key === 'centre')!;
    expect(centre.subjectKey).toBe(`comfort-zone-${centre.value}`);

    const personal = details.purposes.find((r) => r.key === 'personal')!;
    expect(personal.subjectKey).toBe(`personal-purpose-${personal.value}`);

    const entry = details.moneyAndRelationships.find((r) => r.key === 'entry')!;
    expect(entry.subjectKey).toBe(`line-entry-${entry.value}`);

    const anahata = details.health.find((r) => r.key === 'anahata')!;
    expect(anahata.subjectKey).toBe(`chakra-anahata-${anahata.emotional}`);

    expect(details.healthSummary.subjectKey).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm --workspace @astrocalc/mobile run test -- matrixText
```

Expected: FAIL — `subjectKey` is `undefined`.

- [ ] **Step 3: Implement**

In `apps/mobile/src/matrix/matrixText.ts`, add the import:

```ts
import { matrixSubjectKey, type ChakraName, type DestinyMatrix, type MatrixSubjectKind } from '@astrocalc/calc-engine';
import type { Locale } from '../i18n/translations';
```

Add, near `POSITION_LABELS`:

```ts
/** Maps each `LabelSet` key to its `matrixSubjectKey` kind. */
const POSITION_KEY_TO_KIND: Record<keyof LabelSet, MatrixSubjectKind> = {
  day: 'day',
  month: 'month',
  year: 'year',
  sum: 'karmic-tail',
  centre: 'comfort-zone',
  paternalSpiritual: 'paternal-spiritual',
  paternalMaterial: 'paternal-material',
  maternalSpiritual: 'maternal-spiritual',
  maternalMaterial: 'maternal-material',
  ancestralCentre: 'ancestral-centre',
  paternalLine: 'paternal-line',
  maternalLine: 'maternal-line',
  sky: 'sky',
  earth: 'earth',
  personal: 'personal-purpose',
  social: 'social-purpose',
  spiritual: 'spiritual-purpose',
  planetary: 'planetary-purpose',
  entry: 'line-entry',
  toEntry: 'line-toward-entry',
  lineCore: 'line-core',
  toPartner: 'line-toward-partner',
  partner: 'line-partner',
};
```

Update `MatrixRow` and `MatrixChakraRow`:

```ts
/** One labelled arcana. */
export interface MatrixRow {
  key: string;
  label: string;
  /** The arcana, as a string. */
  value: string;
  /** Interpretation key for this position, e.g. `comfort-zone-14`. */
  subjectKey: string;
}

/** One chakra row of the health map. */
export interface MatrixChakraRow {
  key: string;
  label: string;
  physical: string;
  energy: string;
  emotional: string;
  /** Interpretation key for this chakra, e.g. `chakra-anahata-12`. Absent for the summary row. */
  subjectKey?: string;
}
```

Update `formatMatrixDetails`'s `row` closure and the `health`/`healthSummary` builders:

```ts
  const row = (key: keyof LabelSet, value: number): MatrixRow => ({
    key,
    label: names[key],
    value: String(value),
    subjectKey: matrixSubjectKey(POSITION_KEY_TO_KIND[key], value),
  });
```

```ts
    health: matrix.health.map((r) => ({
      key: r.chakra,
      label: chakras[r.chakra],
      physical: String(r.physical),
      energy: String(r.energy),
      emotional: String(r.emotional),
      subjectKey: matrixSubjectKey(`chakra-${r.chakra}`, r.emotional),
    })),
    healthSummary: {
      key: 'summary',
      label: SUMMARY_LABEL[locale],
      physical: String(matrix.healthSummary.physical),
      energy: String(matrix.healthSummary.energy),
      emotional: String(matrix.healthSummary.emotional),
    },
```

(`ChakraName` import stays used via `matrix.health`'s row type; no separate cast needed — the same `\`chakra-${r.chakra}\`` pattern is already proven in `chakraReading.ts`.)

- [ ] **Step 4: Run test to verify it passes**

```bash
npm --workspace @astrocalc/mobile run test -- matrixText
```

Expected: PASS, all existing + new assertions green.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/matrix/matrixText.ts apps/mobile/src/matrix/matrixText.test.ts
git commit -m "$(cat <<'EOF'
feat: attach interpretation subjectKey to matrix rows

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `MatrixScreen.tsx` — wire accordions

**Files:**
- Modify: `apps/mobile/src/screens/MatrixScreen.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts` (new keys)

- [ ] **Step 1: Add translation keys**

`en` block — replace `'matrix.readingTitle': 'Your Reading',` by adding right after it:

```ts
  'matrix.readingError': "Couldn't load your reading. Please try again.",
  'matrix.readingUnavailableOffline': 'Your reading needs an internet connection.',
  'matrix.readingRowUnavailable': 'Connect to the internet to see this reading.',
```

`az` block — after `'matrix.readingTitle': 'Sizin Şərhiniz',`:

```ts
  'matrix.readingError': 'Şərhiniz yüklənmədi. Yenidən cəhd edin.',
  'matrix.readingUnavailableOffline': 'Şərhiniz üçün internet bağlantısı lazımdır.',
  'matrix.readingRowUnavailable': 'Bu açıqlamanı görmək üçün internetə qoşulun.',
```

- [ ] **Step 2: Rewrite the screen**

Replace the full contents of `apps/mobile/src/screens/MatrixScreen.tsx` with:

```tsx
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
  renderMeaning: (subjectKey: string | undefined) => React.ReactNode;
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
  renderMeaning: (subjectKey: string | undefined) => React.ReactNode;
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
```

Note: the chakra row's `value` is compacted to `physical / energy / emotional` as a single string because `AccordionRow.value` only accepts one string — the three-column header above still labels what each number is.

- [ ] **Step 3: Typecheck**

```bash
npm --workspace @astrocalc/mobile run typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/screens/MatrixScreen.tsx apps/mobile/src/i18n/translations.ts
git commit -m "$(cat <<'EOF'
feat: matrix detail rows are expandable accordions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `ChakraScreen.tsx` — convert chakra blocks to accordions

**Files:**
- Modify: `apps/mobile/src/screens/ChakraScreen.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts` (one new key)

- [ ] **Step 1: Add translation key**

`en` block, right after `'chakra.readingError': ...`:

```ts
  'chakra.readingRowUnavailable': 'Connect to the internet to see this reading.',
```

`az` block, right after `'chakra.readingError': ...`:

```ts
  'chakra.readingRowUnavailable': 'Bu açıqlamanı görmək üçün internetə qoşulun.',
```

- [ ] **Step 2: Rewrite the render section**

In `apps/mobile/src/screens/ChakraScreen.tsx`, add the `AccordionRow` import and an `openKey`/`toggle` pair, then replace the per-chakra block. Full diff:

Add to the imports:

```tsx
import { AccordionRow } from '../chart/AccordionRow';
```

Add state right after the existing `readingError` state:

```tsx
  const [openKey, setOpenKey] = useState<string | null>(null);
```

Add the toggle callback near `readingByChakra`:

```tsx
  const toggle = useCallback((key: string) => setOpenKey((cur) => (cur === key ? null : key)), []);
```

Replace the render block:

```tsx
      {readingError ? <Text style={styles.sectionNote}>{readingError}</Text> : null}

      {layout?.nodes.map((node: ChakraNode) => (
        <AccordionRow
          key={node.chakra}
          name={names[node.chakra]}
          value={`${node.physical} / ${node.energy} / ${node.emotional}`}
          leading={<View style={[styles.dot, { backgroundColor: node.color }]} />}
          expanded={openKey === node.chakra}
          onToggle={() => toggle(node.chakra)}
        >
          <Text style={styles.cells}>
            {t('matrix.physical')} {node.physical} · {t('matrix.energy')} {node.energy} ·{' '}
            {t('matrix.emotional')} {node.emotional}
          </Text>
          <Text style={styles.paragraph}>
            {readingByChakra.get(node.chakra) ?? readingError ?? t('chakra.readingRowUnavailable')}
          </Text>
        </AccordionRow>
      ))}
```

Remove the now-unused `block`/`blockHeader`/`chakraName`/`chakraValue` styles and keep `dot`, `cells`, `paragraph`, `sectionNote`. The resulting `styles` object:

```tsx
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
  dot: { width: 14, height: 14, borderRadius: 7 },
  cells: { color: '#8E8AA0', fontSize: 12.5, marginBottom: 6 },
  paragraph: { color: '#B9B4C7', fontSize: 14, lineHeight: 21 },
  error: { color: '#F2A2A2', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  retryButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10 },
  retryButtonText: { color: GOLD, fontSize: 15, fontWeight: '600' },
});
```

Also add `useCallback` to the existing `import { useCallback, useMemo, useState } from 'react';` line — it is already imported, so no change needed there.

- [ ] **Step 3: Typecheck**

```bash
npm --workspace @astrocalc/mobile run typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/screens/ChakraScreen.tsx apps/mobile/src/i18n/translations.ts
git commit -m "$(cat <<'EOF'
feat: chakra blocks are expandable accordions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Full verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

```bash
npm --workspace @astrocalc/mobile run typecheck
```

Expected: clean.

- [ ] **Step 2: Mobile tests**

```bash
npm --workspace @astrocalc/mobile run test
```

Expected: all green, including the new `numerologyText`/`matrixText` assertions.

- [ ] **Step 3: Format check**

```bash
npm run format:check
```

Expected: `All matched files use Prettier code style!`. If not, run:

```bash
npx prettier --write apps/mobile/src/chart/AccordionRow.tsx apps/mobile/src/api/interpretationApi.ts apps/mobile/src/numerology/numerologyText.ts apps/mobile/src/numerology/numerologyText.test.ts apps/mobile/src/matrix/matrixText.ts apps/mobile/src/matrix/matrixText.test.ts apps/mobile/src/screens/NumerologyScreen.tsx apps/mobile/src/screens/MatrixScreen.tsx apps/mobile/src/screens/ChakraScreen.tsx apps/mobile/src/i18n/translations.ts
```

then re-run `npm run format:check` and commit any formatting fixes.

- [ ] **Step 4: Confirm no stray scaffolding**

```bash
git status
```

Expected: no untracked `.eslintrc.js`, no diff in `apps/mobile/package.json` / root `package-lock.json` beyond what this feature intentionally touches (it shouldn't touch either). If any appear:

```bash
git checkout -- apps/mobile/package.json package-lock.json
rm -f apps/mobile/.eslintrc.js
```

- [ ] **Step 5: Manual on-device check**

Using the project's "run app" notes (Metro + backend + adb reverse), open Numerology, Matrix, and Chakra screens and confirm: tapping a row expands its meaning, tapping another row closes the first, and (with the device offline) rows show the "needs internet" note instead of a wrong/blank message.

---

## Task 9: Backlog entry

**Files:**
- Modify: `BACKLOG.md`

- [ ] **Step 1: Add the entry**

Add a new bullet under today's date heading (create the `## 2026-07-22` heading if the day's heading from the natal-chart entry is still current, otherwise reuse it — check the top of the file first) in `BACKLOG.md`, above the natal-chart entry, following the file's existing style:

```markdown
- Numerology, Matrix, and Chakra detail rows are now expandable accordions —
  mobile (#<N>). Extends the pattern shipped for the Natal Chart screen
  (#106/#107) to the remaining three result screens: every row (numerology's
  core/extended/cycle numbers and Pinnacle/Challenge periods; the Matrix's
  core square, ancestral square, purposes, money/relationship line, and
  seven-chakra health map; the Chakra page's per-chakra blocks) taps open,
  accordion-style, to reveal its seeded meaning, with only one row open at a
  time. Mobile-only — the interpretation content already existed (numerology
  185 subjects, matrix 682 subjects including the chakras), so no backend,
  calc-engine, or seed changes were needed. `numerologyText.ts`/`matrixText.ts`
  now attach each row's `numerologySubjectKey`/`matrixSubjectKey` alongside its
  computed value; a new `fetchInterpretationMap` helper
  (`interpretationApi.ts`) wraps the existing `/interpretations/batch`
  endpoint into a `subjectKey → content` map, mirroring `fetchChakraReadings`.
  `AccordionRow` gained one backward-compatible optional `leading` slot so the
  Chakra page keeps its coloured dot. The now-redundant empty "Your Reading"
  headings on all three screens were removed — their content lives in the
  accordions. Mobile tests green (+ new `numerologyText`/`matrixText`
  subjectKey assertions); tsc + prettier clean.
```

- [ ] **Step 2: Commit**

```bash
git add BACKLOG.md
git commit -m "$(cat <<'EOF'
docs: log numerology/matrix/chakra accordion work in BACKLOG

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Open the PR

**Files:** none (GitHub only)

- [ ] **Step 1: Push**

```bash
git push -u origin feat/<N>-accordions-numerology-matrix-chakra
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create \
  --title "Expandable accordion meanings on Numerology, Matrix, and Chakra screens" \
  --label mobile \
  --body "$(cat <<'EOF'
## Summary
- Every detail row on the Numerology, Matrix, and Chakra screens is now a single-open accordion revealing its seeded interpretation, matching the pattern shipped for the Natal Chart screen in #106/#107.
- Mobile-only: `numerologyText.ts`/`matrixText.ts` attach each row's `numerologySubjectKey`/`matrixSubjectKey`; a new `fetchInterpretationMap` helper batches the fetch via the existing `/interpretations/batch` endpoint; `AccordionRow` gained one backward-compatible optional `leading` slot for the Chakra page's coloured dot.
- Closes #<N>.

## Test plan
- [x] `npm --workspace @astrocalc/mobile run typecheck`
- [x] `npm --workspace @astrocalc/mobile run test`
- [x] `npm run format:check`
- [ ] Manual on-device check: tap-to-expand, single-open, offline note

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Confirm CI**

```bash
gh pr checks --watch
```

Expected: all green before requesting merge.

---

## Self-Review Notes

- **Spec coverage:** shared helper (Task 2), AccordionRow leading slot (Task 1), all three screens' subjectKey wiring + rendering (Tasks 3–7), translation keys (Tasks 4/6/7), reading-title removal (Tasks 4/6 — natural consequence of the rewritten screens, which drop the trailing `readingTitle` `<Text>`), verification checklist (Task 8), BACKLOG (Task 9), PR (Task 10). Covered.
- **Placeholder scan:** every step above contains literal code, not descriptions. None found.
- **Type consistency:** `NumerologyRow`/`NumerologyPeriodRow`/`MatrixRow`/`MatrixChakraRow` field names (`subjectKey`) are consistent between the formatter tasks (3, 5) and the screen tasks (4, 6) that consume them. `AccordionRow`'s new `leading` prop (Task 1) matches its one use in Task 7.
