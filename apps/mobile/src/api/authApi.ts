import { config } from '../config';

export interface AuthUser {
  id: string;
  email: string;
  googleId: string | null;
}

export interface SignInResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
}

/** Error carrying the backend's machine-readable code + human message. */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Exchange a Google ID token for an AstroCalc session by calling the backend,
 * which verifies the token against Google's public keys and creates/opens the
 * account. Throws {@link ApiError} with the backend's `code`/`message` on
 * failure so the UI can show a clear message.
 */
export async function signInWithGoogle(idToken: string): Promise<SignInResponse> {
  let res: Response;
  try {
    res = await fetch(`${config.apiBaseUrl}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  } catch {
    throw new ApiError('network_error', 'Could not reach the server. Check your connection.');
  }

  const data = (await res.json().catch(() => null)) as
    (SignInResponse & { error?: never }) | { error: { code: string; message: string } } | null;

  if (!res.ok || !data || 'error' in data) {
    const err = data && 'error' in data ? data.error : null;
    throw new ApiError(
      err?.code ?? 'unknown_error',
      err?.message ?? 'Sign-in failed. Please try again.',
    );
  }

  return data;
}
