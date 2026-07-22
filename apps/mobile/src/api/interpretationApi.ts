import type { DestinyMatrix, InterpretationLocale, NatalChart } from '@astrocalc/calc-engine';
import { authedFetch, ApiError } from './httpClient';
import {
  chakraReadingSubjects,
  orderChakraReadings,
  type ChakraReading,
} from '../matrix/chakraReading';

export { ApiError } from './httpClient';
export type { ChakraReading } from '../matrix/chakraReading';

/** One resolved interpretation row, as `/interpretations/for-chart` returns it. */
export interface InterpretationResult {
  category: 'planet-sign' | 'planet-house' | 'house' | 'angle' | 'aspect';
  subjectKey: string;
  content: string;
  locale: InterpretationLocale;
  /** `true` when the requested locale had no content and English was served instead. */
  isFallback: boolean;
}

/** The full natal-chart reading (#18): every planet-sign, planet-house, and aspect text. */
export interface ChartInterpretation {
  planetSign: InterpretationResult[];
  /** Empty when the chart has no houses (birth time unknown) — nothing to compose. */
  planetHouse: InterpretationResult[];
  /** The 12 generic house meanings — empty when the chart has no houses. */
  houses: InterpretationResult[];
  /** The Ascendant/Midheaven-in-sign meanings — empty when the chart has no houses. */
  angles: InterpretationResult[];
  aspects: InterpretationResult[];
}

type ApiEnvelope<T> = (T & { error?: never }) | { error: { code: string; message: string } } | null;

async function parseJson<T>(res: Response, fallbackMessage: string): Promise<T> {
  const data = (await res.json().catch(() => null)) as ApiEnvelope<T>;
  if (!res.ok || !data || 'error' in data) {
    const err = data && 'error' in data ? data.error : null;
    throw new ApiError(err?.code ?? 'unknown_error', err?.message ?? fallbackMessage);
  }
  return data;
}

/**
 * Trim a full {@link NatalChart} down to what `/interpretations/for-chart` needs —
 * just the fields the backend's `ComputedChartInput` reads, so this request never
 * ships more of the chart than the interpretation service actually consumes.
 */
function toChartPayload(chart: NatalChart) {
  return {
    positions: chart.positions.map((p) => ({ body: p.body, sign: p.sign, longitude: p.longitude })),
    cusps: chart.houses?.cusps,
    ascendantSign: chart.houses?.ascendant.sign,
    midheavenSign: chart.houses?.midheaven.sign,
    aspects: chart.aspects.map((a) => ({ bodyA: a.bodyA, bodyB: a.bodyB, type: a.type })),
  };
}

/**
 * Fetch the localized natal-chart reading for an already-computed chart (#18).
 * This is independent of the chart's own Pro-gated `interpretation` field
 * (`natalChartApi.ts`) — it calls the standalone `/interpretations` service,
 * which composes the subject list from the chart itself server-side, so this
 * client never needs to rebuild `planetSignSubjectKey`/`planetHouseSubjectKey`/
 * `aspectSubjectKey` combinations on-device.
 *
 * Throws {@link ApiError} with code `network_error` when offline — the same
 * signal `natalChartApi`/`isNetworkError` use, so a result screen can show a
 * "reconnect to see your reading" state without blocking the wheel, which
 * needs no network once the chart itself is loaded.
 */
export async function fetchChartInterpretation(
  chart: NatalChart,
  locale: InterpretationLocale,
): Promise<ChartInterpretation> {
  const res = await authedFetch('/interpretations/for-chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chart: toChartPayload(chart), locale }),
  });
  return parseJson<ChartInterpretation>(
    res,
    'Could not load your chart reading. Please try again.',
  );
}

/** The `POST /interpretations/batch` response shape — only the fields this client reads. */
interface BatchInterpretationResponse {
  results: InterpretationResult[];
}

/**
 * Fetch the seven chakra readings for a computed Matrix (#99).
 *
 * The chakra numbers are already on the (offline-capable) `DestinyMatrix`; this
 * turns them into text using the interpretation content the backend already
 * holds. It goes through the generic `/interpretations/batch` endpoint rather
 * than a bespoke `for-matrix` route — the only subjects a chakra reading needs
 * are the seven `chakra-*` keys, which batch resolves directly.
 *
 * Independent of loading the Matrix itself, and network-bound the same way
 * {@link fetchChartInterpretation} is: it throws {@link ApiError} `network_error`
 * when offline, the caller's cue to show a "needs a connection" note while still
 * rendering the numbers. Chakras the batch returns no content for are omitted.
 */
export async function fetchChakraReadings(
  matrix: DestinyMatrix,
  locale: InterpretationLocale,
): Promise<ChakraReading[]> {
  const subjects = chakraReadingSubjects(matrix).map(({ subjectKey }) => ({
    category: 'matrix' as const,
    subjectKey,
  }));
  const res = await authedFetch('/interpretations/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale, subjects }),
  });
  const { results } = await parseJson<BatchInterpretationResponse>(
    res,
    'Could not load your chakra reading. Please try again.',
  );
  return orderChakraReadings(matrix, new Map(results.map((r) => [r.subjectKey, r.content])));
}
