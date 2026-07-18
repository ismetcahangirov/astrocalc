import { describe, expect, it } from 'vitest';
import { createTokenService } from './tokens';
import { AuthError } from './errors';

const service = createTokenService({
  accessSecret: 'access-secret',
  refreshSecret: 'refresh-secret',
  accessTtl: '15m',
  refreshTtl: '30d',
});

describe('createTokenService', () => {
  it('issues an access + refresh token pair carrying userId and sessionId', () => {
    const { accessToken, refreshToken } = service.issueTokens('user-1', 'session-1');

    expect(typeof accessToken).toBe('string');
    expect(typeof refreshToken).toBe('string');
    expect(accessToken).not.toBe(refreshToken);

    const access = service.verifyAccessToken(accessToken);
    expect(access).toMatchObject({ userId: 'user-1', sessionId: 'session-1' });

    const refresh = service.verifyRefreshToken(refreshToken);
    expect(refresh).toMatchObject({ userId: 'user-1', sessionId: 'session-1' });
  });

  it('rejects an access token presented as a refresh token', () => {
    const { accessToken } = service.issueTokens('user-1', 'session-1');
    expect(() => service.verifyRefreshToken(accessToken)).toThrow(AuthError);
  });

  it('rejects a refresh token presented as an access token', () => {
    const { refreshToken } = service.issueTokens('user-1', 'session-1');
    expect(() => service.verifyAccessToken(refreshToken)).toThrow(AuthError);
  });

  it('rejects a token signed with a different secret', () => {
    const other = createTokenService({
      accessSecret: 'someone-else',
      refreshSecret: 'someone-else-refresh',
      accessTtl: '15m',
      refreshTtl: '30d',
    });
    const { accessToken } = other.issueTokens('user-1', 'session-1');
    expect(() => service.verifyAccessToken(accessToken)).toThrow(AuthError);
  });

  it('rejects a malformed token', () => {
    expect(() => service.verifyAccessToken('not-a-jwt')).toThrow(AuthError);
  });
});
