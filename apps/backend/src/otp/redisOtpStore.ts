import type { Redis } from '@upstash/redis';
import type { OtpChallenge, OtpStore } from './otpStore';

/**
 * Upstash Redis-backed {@link OtpStore} — the production implementation behind
 * `InMemoryOtpStore`. Every key carries an `ex` TTL so challenges, attempt
 * counters, cooldowns and lockouts all self-expire; nothing needs a cleanup job.
 */
export class RedisOtpStore implements OtpStore {
  // Retain the challenge past its logical TTL so `otpService` can distinguish
  // an "expired" code (present, but past `expiresAt`) from one that was never
  // requested — mirrors `InMemoryOtpStore`'s grace window.
  private static readonly GRACE_SECONDS = 60;

  constructor(private readonly redis: Redis) {}

  private static challengeKey(phone: string): string {
    return `otp:challenge:${phone}`;
  }
  private static attemptsKey(phone: string): string {
    return `otp:attempts:${phone}`;
  }
  private static cooldownKey(phone: string): string {
    return `otp:cooldown:${phone}`;
  }
  private static lockKey(phone: string): string {
    return `otp:lock:${phone}`;
  }

  async saveChallenge(phone: string, challenge: OtpChallenge, ttlSeconds: number): Promise<void> {
    await Promise.all([
      this.redis.set(RedisOtpStore.challengeKey(phone), challenge, {
        ex: ttlSeconds + RedisOtpStore.GRACE_SECONDS,
      }),
      // A fresh code resets the attempt counter.
      this.redis.del(RedisOtpStore.attemptsKey(phone)),
    ]);
  }

  async getChallenge(phone: string): Promise<OtpChallenge | null> {
    const value = await this.redis.get<OtpChallenge>(RedisOtpStore.challengeKey(phone));
    return value ?? null;
  }

  async deleteChallenge(phone: string): Promise<void> {
    await Promise.all([
      this.redis.del(RedisOtpStore.challengeKey(phone)),
      this.redis.del(RedisOtpStore.attemptsKey(phone)),
    ]);
  }

  async incrementAttempts(phone: string, ttlSeconds: number): Promise<number> {
    const key = RedisOtpStore.attemptsKey(phone);
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, ttlSeconds);
    }
    return count;
  }

  async getCooldownSeconds(phone: string): Promise<number> {
    const ttl = await this.redis.ttl(RedisOtpStore.cooldownKey(phone));
    return ttl > 0 ? ttl : 0;
  }

  async startCooldown(phone: string, seconds: number): Promise<void> {
    await this.redis.set(RedisOtpStore.cooldownKey(phone), 1, { ex: seconds });
  }

  async getLockSeconds(phone: string): Promise<number> {
    const ttl = await this.redis.ttl(RedisOtpStore.lockKey(phone));
    return ttl > 0 ? ttl : 0;
  }

  async lock(phone: string, seconds: number): Promise<void> {
    await this.redis.set(RedisOtpStore.lockKey(phone), 1, { ex: seconds });
  }
}
