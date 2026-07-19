import jwt from 'jsonwebtoken';
import { AccountLinkTokenError } from './errors';

export interface AccountLinkTokenConfig {
  secret: string;
  /** How long the link offer stays valid, e.g. 600 (10 minutes). */
  ttlSeconds: number;
  /** Injectable clock (epoch ms) for `iat`/`exp` and verification — defaults to `Date.now`. */
  now?: () => number;
}

/** What a Google sign-in that matched an existing account's email needs to carry forward. */
export interface AccountLinkClaims {
  /** The existing account the caller must confirm linking to. */
  candidateUserId: string;
  /** The verified Google identity waiting to be attached. */
  googleId: string;
  email: string;
}

export interface AccountLinkTokenService {
  issue(claims: AccountLinkClaims): string;
  verify(token: string): AccountLinkClaims;
}

const TOKEN_TYPE = 'account_link';

/**
 * Short-lived, single-purpose token bridging the two requests of the
 * account-linking flow (#4): `POST /auth/google` mints one when it finds a
 * same-email account instead of auto-linking; `POST /auth/link/confirm`
 * verifies it once the user has proven ownership of that existing account by
 * signing in some other way. Deliberately separate from `tokens.ts`'s
 * access/refresh tokens — a different secret and a much shorter TTL, since
 * this token asserts something narrower ("this Google identity may be linked
 * to this user") than a session does.
 */
export function createAccountLinkTokenService(
  config: AccountLinkTokenConfig,
): AccountLinkTokenService {
  const now = config.now ?? Date.now;

  return {
    issue(claims) {
      const iat = Math.floor(now() / 1000);
      return jwt.sign({ type: TOKEN_TYPE, iat, ...claims }, config.secret, {
        expiresIn: config.ttlSeconds,
      });
    },

    verify(token) {
      let decoded: unknown;
      try {
        decoded = jwt.verify(token, config.secret, {
          clockTimestamp: Math.floor(now() / 1000),
        });
      } catch {
        throw new AccountLinkTokenError();
      }

      if (typeof decoded !== 'object' || decoded === null) {
        throw new AccountLinkTokenError();
      }
      const claims = decoded as Partial<AccountLinkClaims> & { type?: string };
      if (
        claims.type !== TOKEN_TYPE ||
        !claims.candidateUserId ||
        !claims.googleId ||
        !claims.email
      ) {
        throw new AccountLinkTokenError();
      }

      return {
        candidateUserId: claims.candidateUserId,
        googleId: claims.googleId,
        email: claims.email,
      };
    },
  };
}
