import type { RevocationStore } from './revocationStore';
import type { TokenService } from './tokens';
import { SessionRevokedError, TokenReuseError } from './errors';

export interface SessionServiceConfig {
  /** Refresh-token lifetime in seconds — used as the TTL for revocation state. */
  refreshTtlSeconds: number;
}

export interface SessionServiceDeps {
  tokenService: TokenService;
  store: RevocationStore;
  config: SessionServiceConfig;
  /** Injectable clock (epoch ms) — defaults to `Date.now`. */
  now?: () => number;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export interface SessionService {
  /**
   * Rotate a refresh token: validate it, invalidate it, and issue a fresh
   * access + refresh pair. Replaying an already-rotated token is treated as
   * theft and revokes every session of the user.
   */
  refresh(refreshToken: string): Promise<RefreshResult>;
  /** Blacklist every active refresh token of a user (admin ban / theft response). */
  revokeAllForUser(userId: string): Promise<void>;
}

/**
 * Refresh-token lifecycle: rotation, reuse (theft) detection, and bulk
 * revocation.
 *
 * Rotation model — each refresh token carries a unique `jti`. On use we mark
 * that `jti` consumed and mint a brand-new token; the old one is dead. If a
 * `jti` that is *already* marked consumed comes back, the only way that happens
 * is a replay of a rotated token, i.e. someone is holding a stolen copy — so we
 * revoke the whole user (all sessions) and force a fresh sign-in everywhere.
 *
 * Bulk revocation writes a per-user cutoff (`revoked:<userId>` = now); any
 * refresh token issued at or before it is rejected. That single write is what
 * an admin ban triggers to kill all of a user's sessions immediately, and what
 * the theft response uses to invalidate sessions the attacker may hold.
 *
 * Nothing here ever logs the token itself.
 */
export function createSessionService(deps: SessionServiceDeps): SessionService {
  const { tokenService, store, config } = deps;
  const now = deps.now ?? Date.now;

  async function revokeAllForUser(userId: string): Promise<void> {
    const cutoff = Math.floor(now() / 1000);
    await store.revokeUser(userId, cutoff, config.refreshTtlSeconds);
  }

  return {
    revokeAllForUser,

    async refresh(refreshToken: string): Promise<RefreshResult> {
      // Throws AuthError('token_invalid') on a bad signature/shape/expiry.
      const claims = tokenService.verifyRefreshToken(refreshToken);

      // 1. User-wide revocation (admin ban, or a prior theft response). `<=` so a
      //    token minted in the very same second as the cutoff is still rejected.
      const revokedAt = await store.getUserRevokedAt(claims.userId);
      if (revokedAt !== null && claims.issuedAt <= revokedAt) {
        throw new SessionRevokedError();
      }

      // 2. Reuse (theft) detection: a consumed jti coming back means a rotated
      //    token was replayed. Nuke every session of the user.
      if (await store.isRefreshTokenUsed(claims.jti)) {
        await revokeAllForUser(claims.userId);
        throw new TokenReuseError();
      }

      // 3. Consume this token, then issue the next pair. Marking "used" before
      //    issuing means a race that replays this same token is caught next time.
      await store.markRefreshTokenUsed(claims.jti, config.refreshTtlSeconds);
      const issued = tokenService.issueTokens(claims.userId, claims.sessionId);
      return { accessToken: issued.accessToken, refreshToken: issued.refreshToken };
    },
  };
}
