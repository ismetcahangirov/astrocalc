import { TokenVerificationError } from './errors';
import type { GoogleProfile, GoogleTicketVerifier, VerifyGoogleToken } from './types';

/** Valid `iss` (issuer) claim values for Google-issued ID tokens. */
const VALID_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

export interface GoogleVerifierConfig {
  /** An `OAuth2Client` (or any structural match) used to check the signature. */
  client: GoogleTicketVerifier;
  /** Accepted OAuth client IDs — the token's `aud` must match one of these. */
  allowedClientIds: string[];
}

/**
 * Build a verifier for Google ID tokens.
 *
 * `client.verifyIdToken` (from `google-auth-library`) enforces the token
 * signature, `exp` (expiry) and `aud` (audience) against the public JWKS. On
 * top of that we re-check `iss`, `aud` and `email_verified` explicitly — the
 * acceptance criteria call these out, and defense-in-depth is cheap.
 */
export function createGoogleVerifier(config: GoogleVerifierConfig): VerifyGoogleToken {
  const { client, allowedClientIds } = config;
  if (allowedClientIds.length === 0) {
    throw new Error('createGoogleVerifier requires at least one allowed client id');
  }
  const allowed = new Set(allowedClientIds);

  return async function verify(idToken: string): Promise<GoogleProfile> {
    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: allowedClientIds });
      payload = ticket.getPayload();
    } catch (err) {
      // Library throws for bad signature, expired (`exp`) or mismatched `aud`.
      const detail = err instanceof Error ? err.message : 'unknown error';
      throw new TokenVerificationError(`Google token verification failed: ${detail}`);
    }

    if (!payload) {
      throw new TokenVerificationError('Google token verification failed: empty payload');
    }
    if (!payload.iss || !VALID_ISSUERS.has(payload.iss)) {
      throw new TokenVerificationError('Google token verification failed: untrusted issuer');
    }

    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.some((a) => a && allowed.has(a))) {
      throw new TokenVerificationError('Google token verification failed: audience mismatch');
    }
    if (!payload.sub) {
      throw new TokenVerificationError('Google token verification failed: missing subject');
    }
    if (!payload.email) {
      throw new TokenVerificationError('Google token verification failed: missing email');
    }
    if (payload.email_verified !== true) {
      throw new TokenVerificationError('Google token verification failed: email not verified');
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: true,
      name: payload.name ?? null,
      givenName: payload.given_name ?? null,
      familyName: payload.family_name ?? null,
      picture: payload.picture ?? null,
      locale: payload.locale ?? null,
    };
  };
}
