import type { DestinyMatrix } from '@astrocalc/calc-engine';
import { authedFetch, ApiError } from './httpClient';

export { ApiError } from './httpClient';

/**
 * The backend's Matrix of Destiny response: the computed arcana plus,
 * eventually, its Pro reading. `interpretation` is `null` today — the Matrix
 * interpretation content lands with the interpretation-content epic — but the
 * field is already on the wire so the client doesn't need a shape change when
 * it arrives. Like the natal chart's and numerology's readings, it is
 * backend-only and never computed on-device.
 */
export interface MatrixResponse {
  matrix: DestinyMatrix;
  interpretation: null;
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
 * Fetch the signed-in user's Matrix of Destiny from the backend.
 *
 * Takes no arguments, and that is a real difference from `fetchNumerology`
 * rather than an omission: numerology needs the device's local date because its
 * Personal Year/Month numbers turn over at midnight, whereas every Matrix
 * arcana is derived from the birth date alone. There is no "as of" question to
 * ask here, so asking one would only invite a caller to pass a date that
 * silently does nothing.
 *
 * Throws {@link ApiError} with code `network_error` when the device is offline
 * (the caller's cue to compute locally) or `incomplete_profile` when the
 * profile has no birth date.
 */
export async function fetchMatrix(): Promise<MatrixResponse> {
  const res = await authedFetch('/matrix', { method: 'GET' });
  return parseJson<MatrixResponse>(res, 'Could not load your Matrix. Please try again.');
}

/** Fetch a saved person's Matrix from the backend (online only). */
export async function getSubjectMatrix(id: string): Promise<MatrixResponse> {
  const res = await authedFetch(`/subjects/${id}/matrix`, { method: 'GET' });
  return parseJson<MatrixResponse>(res, 'Could not load this Matrix. Please try again.');
}
