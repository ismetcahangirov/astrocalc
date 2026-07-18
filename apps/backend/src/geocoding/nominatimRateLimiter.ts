import type { Redis } from '@upstash/redis';

/**
 * Nominatim's usage policy caps *absolute maximum* request rate at one
 * request per second, app-wide (not per user) — see
 * https://operations.osmfoundation.org/policies/nominatim/. `acquire()`
 * resolves once it is safe to issue the next upstream request, delaying the
 * caller if necessary.
 */
export interface NominatimRateLimiter {
  acquire(): Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface InMemoryRateLimiterOptions {
  minIntervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Single-process {@link NominatimRateLimiter} for tests and local dev without
 * Redis. Concurrent `acquire()` calls are serialized so their reserved
 * windows never overlap.
 */
export class InMemoryNominatimRateLimiter implements NominatimRateLimiter {
  private readonly minIntervalMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private nextAvailableAtMs = 0;
  private chain: Promise<void> = Promise.resolve();

  constructor(opts: InMemoryRateLimiterOptions = {}) {
    this.minIntervalMs = opts.minIntervalMs ?? 1000;
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? defaultSleep;
  }

  acquire(): Promise<void> {
    const turn = this.chain.then(() => this.acquireExclusive());
    // Swallow the rejection on the shared chain (each caller still sees it via `turn`)
    // so one failed acquire doesn't wedge every later caller.
    this.chain = turn.catch(() => undefined);
    return turn;
  }

  private async acquireExclusive(): Promise<void> {
    const now = this.now();
    const wait = this.nextAvailableAtMs - now;
    if (wait > 0) {
      await this.sleep(wait);
      this.nextAvailableAtMs += this.minIntervalMs;
    } else {
      this.nextAvailableAtMs = now + this.minIntervalMs;
    }
  }
}

export interface RedisRateLimiterOptions {
  minIntervalMs?: number;
  maxWaitMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Upstash Redis-backed {@link NominatimRateLimiter}, enforcing the 1 req/sec
 * ceiling across every backend instance (not just the current process).
 * Implemented as a self-expiring lock: `SET key val NX PX <minIntervalMs>`
 * succeeds only if no other instance holds the window, and the key cleans
 * itself up once that window elapses.
 */
export class RedisNominatimRateLimiter implements NominatimRateLimiter {
  private static readonly KEY = 'nominatim:rate-limit-lock';
  private readonly minIntervalMs: number;
  private readonly maxWaitMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly redis: Redis,
    opts: RedisRateLimiterOptions = {},
  ) {
    this.minIntervalMs = opts.minIntervalMs ?? 1000;
    this.maxWaitMs = opts.maxWaitMs ?? 5000;
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? defaultSleep;
  }

  async acquire(): Promise<void> {
    const deadline = this.now() + this.maxWaitMs;
    for (;;) {
      const acquired = await this.redis.set(RedisNominatimRateLimiter.KEY, 1, {
        nx: true,
        px: this.minIntervalMs,
      });
      if (acquired) return;
      if (this.now() >= deadline) {
        throw new Error('Timed out waiting for the Nominatim rate-limit slot');
      }
      await this.sleep(Math.min(150, this.minIntervalMs));
    }
  }
}
