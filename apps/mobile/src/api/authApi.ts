import { config } from '../config';
import { ApiError } from './apiError';

export { ApiError } from './apiError';

export interface AuthUser {
  id: string;
  email: string;
  googleId: string | null;
}

export interface SignedInResponse {
  status: 'signed_in';
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
}

/**
 * Returned instead of a session when the Google account's email already
 * belongs to an existing account (#4) — signing up via another method first,
 * e.g. WhatsApp. Never auto-linked: the caller must sign in as that existing
 * account some other way, then confirm via {@link confirmAccountLink}.
 */
export interface LinkRequiredResponse {
  status: 'link_required';
  linkToken: string;
  maskedEmail: string;
}

export type GoogleSignInResponse = SignedInResponse | LinkRequiredResponse;

async function postAuth<T>(path: string, body: unknown, headers?: HeadersInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.apiBaseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('network_error', 'Could not reach the server. Check your connection.');
  }

  const data = (await res.json().catch(() => null)) as
    (T & { error?: never }) | { error: { code: string; message: string } } | null;

  if (!res.ok || !data || 'error' in data) {
    const err = data && 'error' in data ? data.error : null;
    throw new ApiError(
      err?.code ?? 'unknown_error',
      err?.message ?? 'Sign-in failed. Please try again.',
    );
  }

  return data;
}

/**
 * Exchange a Google ID token for an AstroCalc session by calling the backend,
 * which verifies the token against Google's public keys and creates/opens the
 * account. Throws {@link ApiError} with the backend's `code`/`message` on
 * failure so the UI can show a clear message. May return a `link_required`
 * outcome instead of a session — see {@link LinkRequiredResponse}.
 */
export async function signInWithGoogle(idToken: string): Promise<GoogleSignInResponse> {
  return postAuth<GoogleSignInResponse>('/auth/google', { idToken });
}

/**
 * Complete a pending account link (#4). Must be called with the access token
 * of a session already opened on the *existing* account the link token names
 * (e.g. right after a successful WhatsApp OTP sign-in) — the backend rejects
 * a mismatch.
 */
export async function confirmAccountLink(
  accessToken: string,
  linkToken: string,
): Promise<SignedInResponse> {
  return postAuth<SignedInResponse>(
    '/auth/link/confirm',
    { linkToken },
    {
      Authorization: `Bearer ${accessToken}`,
    },
  );
}
