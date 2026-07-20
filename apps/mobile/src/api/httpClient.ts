import { config } from '../config';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '../auth/tokenStorage';
import { ApiError } from './authApi';

export { ApiError } from './authApi';

const SIGN_IN_AGAIN = 'You need to sign in again.';
const UNREACHABLE = 'Could not reach the server. Check your connection.';

/**
 * The refresh currently in flight, shared by every request that finds its
 * access token expired. Refresh tokens are rotated *and* replay-protected by
 * the backend (`sessionService.refresh`), so a second concurrent refresh would
 * present a token the first one already spent — which reads as a stolen-token
 * replay and revokes the whole session. One refresh at a time, always.
 */
let inFlightRefresh: Promise<string> | null = null;

/**
 * Authenticated `fetch` against the backend. Attaches the stored bearer token,
 * transparently refreshes it when it has expired, and normalises the failure
 * modes callers care about into {@link ApiError}:
 *
 * - `unauthorized` — there is no usable session; the app must route to sign-in;
 * - `network_error` — the request never reached the server. This is the signal
 *   the offline layer keys on to fall back to on-device calculation (issue #20),
 *   so it must stay distinct from HTTP error responses (which do reach the
 *   server and are surfaced by the caller after inspecting the body);
 * - `server_error` — the refresh endpoint itself is broken. Not the user's
 *   session's fault, so the session survives.
 *
 * Access tokens live 15 minutes, so without the refresh step every screen fails
 * after a short idle period and the user is thrown back to the login screen
 * (issue #86). Refresh is attempted **once** per request: a retry that is still
 * rejected is handed to the caller as-is rather than looping.
 *
 * `init.body` must be replayable (a string or nothing) — every caller in the app
 * passes `JSON.stringify(...)`, never a stream.
 */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new ApiError('unauthorized', SIGN_IN_AGAIN);

  const response = await send(path, init, accessToken);
  if (response.status !== 401) return response;

  return send(path, init, await refreshAccessToken(accessToken));
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

async function send(path: string, init: RequestInit, accessToken: string): Promise<Response> {
  try {
    return await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new ApiError('network_error', UNREACHABLE);
  }
}

/**
 * Trade the stored refresh token for a fresh access token, joining the refresh
 * already in flight if there is one.
 *
 * `expiredToken` is the token whose 401 triggered this call. If the stored
 * access token has moved on since, a concurrent request already refreshed and
 * this one only needs to retry — spending another refresh token would be pure
 * waste, and one rotation more than necessary.
 */
async function refreshAccessToken(expiredToken: string): Promise<string> {
  const current = await getAccessToken();
  if (current && current !== expiredToken) return current;

  inFlightRefresh ??= requestNewTokens().finally(() => {
    inFlightRefresh = null;
  });

  return inFlightRefresh;
}

async function requestNewTokens(): Promise<string> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw await endSession();

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Being offline is not a rejected session — keep the tokens so the user is
    // still signed in when connectivity comes back.
    throw new ApiError('network_error', UNREACHABLE);
  }

  if (response.status >= 500) {
    throw new ApiError('server_error', 'Something went wrong. Please try again.');
  }

  const tokens = await readTokens(response);
  if (!tokens) throw await endSession();

  await saveTokens(tokens.accessToken, tokens.refreshToken);
  return tokens.accessToken;
}

/**
 * The rotated pair from `POST /auth/refresh`, or null if the backend refused
 * the refresh token (expired, revoked, or replayed) or answered with a body we
 * cannot use — both mean this session is over.
 */
async function readTokens(
  response: Response,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  if (!response.ok) return null;

  const body = (await response.json().catch(() => null)) as Partial<{
    accessToken: unknown;
    refreshToken: unknown;
  }> | null;

  return typeof body?.accessToken === 'string' && typeof body.refreshToken === 'string'
    ? { accessToken: body.accessToken, refreshToken: body.refreshToken }
    : null;
}

/** Drop the dead session and produce the error that routes the app to sign-in. */
async function endSession(): Promise<ApiError> {
  await clearTokens();
  return new ApiError('unauthorized', SIGN_IN_AGAIN);
}
