/**
 * Persistence boundary for refresh-token revocation state. Kept as an interface
 * so the session service can be unit-tested against an in-memory implementation
 * while production uses Upstash Redis (see `redisRevocationStore.ts`).
 *
 * Two independent mechanisms live here:
 *   1. Per-token "used" markers (`used:<jti>`) — the audit trail rotation leaves
 *      behind so a replay of an already-rotated refresh token is detected.
 *   2. A per-user revocation cutoff (`revoked:<userId>`) — an epoch-second
 *      timestamp; every refresh token issued at or before it is rejected. This
 *      is how an admin ban (or the theft response) invalidates *all* of a user's
 *      sessions at once.
 *
 * Every key carries a TTL of the refresh-token lifetime so state self-expires
 * once no affected token could still be valid.
 */
export interface RevocationStore {
  /** True if this refresh-token `jti` has already been rotated away (consumed). */
  isRefreshTokenUsed(jti: string): Promise<boolean>;
  /** Mark a refresh-token `jti` as consumed so any later replay is caught. */
  markRefreshTokenUsed(jti: string, ttlSeconds: number): Promise<void>;
  /** Revoke every session of a user: reject refresh tokens issued at/before `cutoffEpochSeconds`. */
  revokeUser(userId: string, cutoffEpochSeconds: number, ttlSeconds: number): Promise<void>;
  /** The user's revocation cutoff (epoch seconds), or null if never revoked. */
  getUserRevokedAt(userId: string): Promise<number | null>;
}

interface Expiring<T> {
  value: T;
  expiresAtMs: number;
}

/**
 * In-memory {@link RevocationStore} for tests and local dev without Redis. Honors
 * TTLs against an injectable clock so tests can advance time deterministically.
 */
export class InMemoryRevocationStore implements RevocationStore {
  private usedJtis = new Map<string, number>(); // jti -> expiresAtMs
  private userRevokedAt = new Map<string, Expiring<number>>(); // userId -> { cutoff, expiresAtMs }

  constructor(private readonly now: () => number = Date.now) {}

  async isRefreshTokenUsed(jti: string): Promise<boolean> {
    const expiresAtMs = this.usedJtis.get(jti);
    if (expiresAtMs === undefined) return false;
    if (this.now() >= expiresAtMs) {
      this.usedJtis.delete(jti);
      return false;
    }
    return true;
  }

  async markRefreshTokenUsed(jti: string, ttlSeconds: number): Promise<void> {
    this.usedJtis.set(jti, this.now() + ttlSeconds * 1000);
  }

  async revokeUser(userId: string, cutoffEpochSeconds: number, ttlSeconds: number): Promise<void> {
    this.userRevokedAt.set(userId, {
      value: cutoffEpochSeconds,
      expiresAtMs: this.now() + ttlSeconds * 1000,
    });
  }

  async getUserRevokedAt(userId: string): Promise<number | null> {
    const entry = this.userRevokedAt.get(userId);
    if (!entry) return null;
    if (this.now() >= entry.expiresAtMs) {
      this.userRevokedAt.delete(userId);
      return null;
    }
    return entry.value;
  }
}
