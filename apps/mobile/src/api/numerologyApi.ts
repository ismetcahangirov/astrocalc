import type { NumerologyProfile } from '@astrocalc/calc-engine';
import { authedFetch, ApiError } from './httpClient';

export { ApiError } from './httpClient';

/**
 * The backend's numerology response: the computed profile plus, eventually, its
 * Pro reading. `interpretation` is `null` today — the numerology interpretation
 * content lands with the interpretation-content epic — but the field is already
 * on the wire so the client doesn't need a shape change when it arrives. Like
 * the natal chart's reading, it is backend-only and never computed on-device.
 */
export interface NumerologyResponse {
  profile: NumerologyProfile;
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
 * Fetch the signed-in user's numerology profile from the backend.
 *
 * `referenceDate` (`YYYY-MM-DD`) is **required**, not optional: the Personal
 * Year/Month numbers and the current-Pinnacle marker all turn over on a date
 * boundary, and "today" is a question only the device can answer — the server
 * would have to guess with its own UTC date. The client supplies its local date
 * so a user just past midnight sees today's numbers, not yesterday's.
 *
 * Throws {@link ApiError} with code `network_error` when the device is offline
 * (the caller's cue to compute locally) or `incomplete_profile` when the profile
 * has no full name or birth date.
 */
export async function fetchNumerology(referenceDate: string): Promise<NumerologyResponse> {
  const res = await authedFetch(`/numerology?referenceDate=${encodeURIComponent(referenceDate)}`, {
    method: 'GET',
  });
  return parseJson<NumerologyResponse>(res, 'Could not load your numbers. Please try again.');
}

/** Fetch a saved person's numerology profile from the backend (online only). */
export async function getSubjectNumerology(
  id: string,
  referenceDate: string,
): Promise<NumerologyResponse> {
  const res = await authedFetch(
    `/subjects/${id}/numerology?referenceDate=${encodeURIComponent(referenceDate)}`,
    { method: 'GET' },
  );
  return parseJson<NumerologyResponse>(res, 'Could not load these numbers. Please try again.');
}
