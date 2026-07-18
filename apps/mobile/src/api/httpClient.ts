import { config } from '../config';
import { getAccessToken } from '../auth/tokenStorage';
import { ApiError } from './authApi';

export { ApiError } from './authApi';

/**
 * Authenticated `fetch` against the backend. Attaches the stored bearer token
 * and normalises the two failure modes callers care about into {@link ApiError}:
 *
 * - `unauthorized` — no session token is available (the user must sign in);
 * - `network_error` — the request never reached the server. This is the signal
 *   the offline layer keys on to fall back to on-device calculation (issue #20),
 *   so it must stay distinct from HTTP error responses (which do reach the
 *   server and are surfaced by the caller after inspecting the body).
 */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new ApiError('unauthorized', 'You need to sign in again.');

  try {
    return await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new ApiError('network_error', 'Could not reach the server. Check your connection.');
  }
}

/**
 * Whether an error means "the device could not reach the backend" — i.e. we are
 * offline. Distinguished from every other {@link ApiError} (auth failures, HTTP
 * error responses) so the offline path only triggers on genuine loss of
 * connectivity, never on a real server-side rejection.
 */
export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'network_error';
}
