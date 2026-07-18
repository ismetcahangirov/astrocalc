import type { Redis } from '@upstash/redis';
import type { RevocationStore } from './revocationStore';

/**
 * Upstash Redis-backed {@link RevocationStore}. Keys, per the issue's technical
 * notes:
 *   - `used:<jti>`     — presence marks a rotated-away refresh token (reuse detection)
 *   - `revoked:<userId>` — epoch-second cutoff; tokens issued at/before it are dead
 *
 * Both keys are written with an `ex` (seconds) TTL so revocation state clears
 * itself once no affected refresh token could still be live.
 */
export class RedisRevocationStore implements RevocationStore {
  constructor(private readonly redis: Redis) {}

  private static usedKey(jti: string): string {
    return `used:${jti}`;
  }

  private static revokedKey(userId: string): string {
    return `revoked:${userId}`;
  }

  async isRefreshTokenUsed(jti: string): Promise<boolean> {
    const exists = await this.redis.exists(RedisRevocationStore.usedKey(jti));
    return exists > 0;
  }

  async markRefreshTokenUsed(jti: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(RedisRevocationStore.usedKey(jti), 1, { ex: ttlSeconds });
  }

  async revokeUser(userId: string, cutoffEpochSeconds: number, ttlSeconds: number): Promise<void> {
    await this.redis.set(RedisRevocationStore.revokedKey(userId), cutoffEpochSeconds, {
      ex: ttlSeconds,
    });
  }

  async getUserRevokedAt(userId: string): Promise<number | null> {
    const value = await this.redis.get<number>(RedisRevocationStore.revokedKey(userId));
    return value === null || value === undefined ? null : Number(value);
  }
}
