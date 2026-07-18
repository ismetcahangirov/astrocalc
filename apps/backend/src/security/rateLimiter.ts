import { Ratelimit } from '@upstash/ratelimit';
import type { Redis } from '@upstash/redis';

export interface RateLimitResult {
  success: boolean;
  /** Requests left in the current window (0 once exhausted). */
  remaining: number;
  /** Seconds until the caller may try again; 0 when `success` is true. */
  retryAfterSeconds: number;
}

/**
 * A named counter that allows up to `limit` calls per rolling window, keyed by
 * an arbitrary identifier (phone number, IP, etc). One instance is created per
 * (scope, limit, window) — e.g. "OTP requests per phone, 3/hour" is a separate
 * limiter from "OTP requests per IP, 10/hour".
 */
export interface RateLimiter {
  limit(identifier: string): Promise<RateLimitResult>;
}

/**
 * Upstash Redis-backed {@link RateLimiter} using a sliding-window counter (via
 * `@upstash/ratelimit`), so the limit is enforced across every backend
 * instance rather than per-process.
 */
export function createSlidingWindowRateLimiter(
  redis: Redis,
  opts: { limit: number; windowSeconds: number; prefix: string },
): RateLimiter {
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(opts.limit, `${opts.windowSeconds} s`),
    prefix: opts.prefix,
  });

  return {
    async limit(identifier: string): Promise<RateLimitResult> {
      const result = await ratelimit.limit(identifier);
      return {
        success: result.success,
        remaining: result.remaining,
        retryAfterSeconds: result.success ? 0 : Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
      };
    },
  };
}

/**
 * Single-process {@link RateLimiter} for tests and local dev without Redis.
 * Implements a sliding-window log (timestamps per identifier) so behavior
 * matches the Redis-backed limiter closely enough for unit tests. Not shared
 * across instances — a production deployment must configure Upstash Redis.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly limitCount: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(opts: { limit: number; windowSeconds: number; now?: () => number }) {
    this.limitCount = opts.limit;
    this.windowMs = opts.windowSeconds * 1000;
    this.now = opts.now ?? Date.now;
  }

  async limit(identifier: string): Promise<RateLimitResult> {
    const now = this.now();
    const windowStart = now - this.windowMs;
    const timestamps = (this.hits.get(identifier) ?? []).filter((t) => t > windowStart);

    if (timestamps.length >= this.limitCount) {
      this.hits.set(identifier, timestamps);
      const retryAfterSeconds = Math.max(1, Math.ceil((timestamps[0]! + this.windowMs - now) / 1000));
      return { success: false, remaining: 0, retryAfterSeconds };
    }

    timestamps.push(now);
    this.hits.set(identifier, timestamps);
    return { success: true, remaining: this.limitCount - timestamps.length, retryAfterSeconds: 0 };
  }
}
