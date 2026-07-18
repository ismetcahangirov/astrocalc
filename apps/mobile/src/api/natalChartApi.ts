import type { NatalChart } from '@astrocalc/calc-engine';
import { authedFetch, ApiError } from './httpClient';

export { ApiError } from './httpClient';

/**
 * Pro-only interpretation of a natal chart. This is the "valuable data" that,
 * per spec §5.1, lives on the backend only — it is never computed on-device and
 * is therefore `null` for free users and absent entirely in offline mode (issue
 * #20, AC #4). The engine's {@link NatalChart} deliberately has no equivalent
 * field. Its concrete shape lands with the interpretation-content epic; kept
 * intentionally open here so this client doesn't pin it down prematurely.
 */
export interface NatalChartInterpretation {
  /** Interpretation sections keyed by topic (e.g. `sun-in-sign`), Pro-gated server-side. */
  sections: Record<string, string>;
}

/** The backend's authoritative natal-chart response: the chart plus, for Pro users, its reading. */
export interface NatalChartResponse {
  chart: NatalChart;
  /** The Pro interpretation, or `null` when the user isn't entitled to it. */
  interpretation: NatalChartInterpretation | null;
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
 * Fetch the signed-in user's natal chart from the backend — the authoritative
 * result, including the Pro interpretation when entitled. Throws
 * {@link ApiError} with code `network_error` when the device is offline, which
 * is the caller's cue to compute the chart locally instead.
 */
export async function fetchNatalChart(): Promise<NatalChartResponse> {
  const res = await authedFetch('/natal-chart', { method: 'GET' });
  return parseJson<NatalChartResponse>(res, 'Could not load your chart. Please try again.');
}

/**
 * Push a chart computed on-device up to the backend so the server-side cache is
 * refreshed with the same result (issue #20, AC #3). Called opportunistically
 * once connectivity is restored; the backend recomputes/validates and caches, so
 * this is a best-effort "prime the cache", not a source of truth. Throws
 * `network_error` if still offline (the caller keeps the pending flag and
 * retries later).
 */
export async function syncNatalChart(chart: NatalChart): Promise<void> {
  const res = await authedFetch('/natal-chart/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chart }),
  });
  // A 2xx with no useful body is fine; only surface real failures.
  if (!res.ok) {
    await parseJson<{ ok: true }>(res, 'Could not sync your offline chart.');
  }
}
