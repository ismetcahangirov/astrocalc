import type { Redis } from '@upstash/redis';
import type { InterpretationKey, InterpretationText } from './types';

function cacheKey(key: InterpretationKey): string {
  return `${key.category}:${key.subjectKey}:${key.locale}`;
}

/**
 * Cache boundary for interpretation text (#18), keyed by
 * category+subjectKey+locale. The full matrix (hundreds of rows × 4
 * languages) rarely changes — an admin edit is the only writer — so a plain
 * TTL cache in front of Postgres, invalidated on write, is enough. Kept as an
 * interface so the service is unit-testable against an in-memory store while
 * production uses Upstash Redis.
 */
export interface InterpretationCache {
  get(key: InterpretationKey): Promise<InterpretationText | null>;
  set(key: InterpretationKey, text: InterpretationText, ttlSeconds: number): Promise<void>;
  /** Evict a row on admin edit, so the next read reflects the new content. */
  invalidate(key: InterpretationKey): Promise<void>;
}

interface Expiring<T> {
  value: T;
  expiresAtMs: number;
}

/** In-memory {@link InterpretationCache} for tests and local dev without Redis. */
export class InMemoryInterpretationCache implements InterpretationCache {
  private entries = new Map<string, Expiring<InterpretationText>>();

  constructor(private readonly now: () => number = Date.now) {}

  async get(key: InterpretationKey): Promise<InterpretationText | null> {
    const entry = this.entries.get(cacheKey(key));
    if (!entry) return null;
    if (this.now() >= entry.expiresAtMs) {
      this.entries.delete(cacheKey(key));
      return null;
    }
    return entry.value;
  }

  async set(key: InterpretationKey, text: InterpretationText, ttlSeconds: number): Promise<void> {
    this.entries.set(cacheKey(key), { value: text, expiresAtMs: this.now() + ttlSeconds * 1000 });
  }

  async invalidate(key: InterpretationKey): Promise<void> {
    this.entries.delete(cacheKey(key));
  }
}

const KEY_PREFIX = 'interpretation:';

/** Upstash Redis-backed {@link InterpretationCache}, shared across instances. */
export class RedisInterpretationCache implements InterpretationCache {
  constructor(private readonly redis: Redis) {}

  async get(key: InterpretationKey): Promise<InterpretationText | null> {
    const value = await this.redis.get<InterpretationText>(`${KEY_PREFIX}${cacheKey(key)}`);
    if (!value) return null;
    // Redis round-trips Dates as strings; restore the type for callers.
    return { ...value, updatedAt: new Date(value.updatedAt) };
  }

  async set(key: InterpretationKey, text: InterpretationText, ttlSeconds: number): Promise<void> {
    await this.redis.set(`${KEY_PREFIX}${cacheKey(key)}`, text, { ex: ttlSeconds });
  }

  async invalidate(key: InterpretationKey): Promise<void> {
    await this.redis.del(`${KEY_PREFIX}${cacheKey(key)}`);
  }
}
