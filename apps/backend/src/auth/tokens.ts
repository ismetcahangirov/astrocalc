import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { AuthError } from './errors';

export interface TokenServiceConfig {
  accessSecret: string;
  refreshSecret: string;
  /** e.g. '15m' — passed straight to `jsonwebtoken`'s `expiresIn`. */
  accessTtl: string;
  /** e.g. '30d'. */
  refreshTtl: string;
  /** Injectable clock (epoch ms) for the `iat`/`exp` claims — defaults to `Date.now`. */
  now?: () => number;
}

export interface TokenClaims {
  userId: string;
  sessionId: string;
}

/**
 * Refresh-token claims. `jti` is a unique id minted per issued refresh token —
 * it is the key the rotation/reuse-detection logic tracks (see
 * `sessionService.ts`). `issuedAt` is the standard JWT `iat` (epoch seconds),
 * used to test a token against a user-wide revocation cutoff.
 */
export interface RefreshTokenClaims extends TokenClaims {
  jti: string;
  issuedAt: number;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  /** The `jti` embedded in the freshly issued refresh token. */
  refreshJti: string;
}

type TokenKind = 'access' | 'refresh';

interface DecodedClaims extends TokenClaims {
  type: TokenKind;
}

export interface TokenService {
  issueTokens(userId: string, sessionId: string): IssuedTokens;
  verifyAccessToken(token: string): TokenClaims;
  verifyRefreshToken(token: string): RefreshTokenClaims;
}

export function createTokenService(config: TokenServiceConfig): TokenService {
  const now = config.now ?? Date.now;

  function sign(kind: TokenKind, userId: string, sessionId: string, jti?: string): string {
    const secret = kind === 'access' ? config.accessSecret : config.refreshSecret;
    const expiresIn = kind === 'access' ? config.accessTtl : config.refreshTtl;
    // Stamp `iat` explicitly (jsonwebtoken derives `exp` from it) so the clock is
    // injectable and the revocation cutoff comparison is deterministic in tests.
    const iat = Math.floor(now() / 1000);
    return jwt.sign({ type: kind, sessionId, iat }, secret, {
      subject: userId,
      expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
      ...(jti ? { jwtid: jti } : {}),
    });
  }

  function decode(
    kind: TokenKind,
    token: string,
  ): DecodedClaims & { sub: string; iat?: number; jti?: string } {
    const secret = kind === 'access' ? config.accessSecret : config.refreshSecret;
    let decoded: unknown;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      throw new AuthError('token_invalid', `Invalid or expired ${kind} token`, 401);
    }
    if (typeof decoded !== 'object' || decoded === null) {
      throw new AuthError('token_invalid', `Invalid ${kind} token`, 401);
    }
    const claims = decoded as Partial<DecodedClaims> & { sub?: string; iat?: number; jti?: string };
    if (claims.type !== kind || !claims.sub || !claims.sessionId) {
      throw new AuthError('token_invalid', `Invalid ${kind} token`, 401);
    }
    return {
      ...claims,
      type: kind,
      userId: claims.sub,
      sessionId: claims.sessionId,
      sub: claims.sub,
    };
  }

  return {
    issueTokens(userId, sessionId) {
      // A fresh, unpredictable id per refresh token — this is what lets us mark a
      // specific token "used" on rotation and spot a later replay of it.
      const refreshJti = randomUUID();
      return {
        accessToken: sign('access', userId, sessionId),
        refreshToken: sign('refresh', userId, sessionId, refreshJti),
        refreshJti,
      };
    },
    verifyAccessToken(token) {
      const claims = decode('access', token);
      return { userId: claims.userId, sessionId: claims.sessionId };
    },
    verifyRefreshToken(token) {
      const claims = decode('refresh', token);
      if (!claims.jti || typeof claims.iat !== 'number') {
        throw new AuthError('token_invalid', 'Invalid refresh token', 401);
      }
      return {
        userId: claims.userId,
        sessionId: claims.sessionId,
        jti: claims.jti,
        issuedAt: claims.iat,
      };
    },
  };
}
