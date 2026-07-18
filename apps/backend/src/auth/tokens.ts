import jwt from 'jsonwebtoken';
import { AuthError } from './errors';

export interface TokenServiceConfig {
  accessSecret: string;
  refreshSecret: string;
  /** e.g. '15m' — passed straight to `jsonwebtoken`'s `expiresIn`. */
  accessTtl: string;
  /** e.g. '30d'. */
  refreshTtl: string;
}

export interface TokenClaims {
  userId: string;
  sessionId: string;
}

type TokenKind = 'access' | 'refresh';

interface DecodedClaims extends TokenClaims {
  type: TokenKind;
}

export interface TokenService {
  issueTokens(userId: string, sessionId: string): { accessToken: string; refreshToken: string };
  verifyAccessToken(token: string): TokenClaims;
  verifyRefreshToken(token: string): TokenClaims;
}

export function createTokenService(config: TokenServiceConfig): TokenService {
  function sign(kind: TokenKind, userId: string, sessionId: string): string {
    const secret = kind === 'access' ? config.accessSecret : config.refreshSecret;
    const expiresIn = kind === 'access' ? config.accessTtl : config.refreshTtl;
    return jwt.sign({ type: kind, sessionId }, secret, {
      subject: userId,
      expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  function verify(kind: TokenKind, token: string): TokenClaims {
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
    const claims = decoded as Partial<DecodedClaims> & { sub?: string };
    if (claims.type !== kind || !claims.sub || !claims.sessionId) {
      throw new AuthError('token_invalid', `Invalid ${kind} token`, 401);
    }
    return { userId: claims.sub, sessionId: claims.sessionId };
  }

  return {
    issueTokens(userId, sessionId) {
      return {
        accessToken: sign('access', userId, sessionId),
        refreshToken: sign('refresh', userId, sessionId),
      };
    },
    verifyAccessToken: (token) => verify('access', token),
    verifyRefreshToken: (token) => verify('refresh', token),
  };
}
