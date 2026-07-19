import type { Redis } from '@upstash/redis';
import type { OrbConfig } from '@astrocalc/calc-engine';

/**
 * Cache boundary for the effective admin orb configuration (#15) — the merged
 * set of overrides across at most five rows (one per major aspect type), so
 * the whole thing is cached as a single value rather than per-row. An admin
 * edit is the only writer, so a plain TTL cache in front of Postgres,
 * invalidated on write, is enough. Kept as an interface so the service is
 * unit-testable against an in-memory store while production uses Upstash Redis.
 */
export interface OrbConfigCache {
  get(): Promise<OrbConfig | null>;
  set(config: OrbConfig, ttlSeconds: number): Promise<void>;
  /** Evict the cached config on admin edit, so the next read reflects the new value. */
  invalidate(): Promise<void>;
}

interface Expiring<T> {
  value: T;
  expiresAtMs: number;
}

/** In-memory {@link OrbConfigCache} for tests and local dev without Redis. */
export class InMemoryOrbConfigCache implements OrbConfigCache {
  private entry: Expiring<OrbConfig> | null = null;

  constructor(private readonly now: () => number = Date.now) {}

  async get(): Promise<OrbConfig | null> {
    if (!this.entry) return null;
    if (this.now() >= this.entry.expiresAtMs) {
      this.entry = null;
      return null;
    }
    return this.entry.value;
  }

  async set(config: OrbConfig, ttlSeconds: number): Promise<void> {
    this.entry = { value: config, expiresAtMs: this.now() + ttlSeconds * 1000 };
  }

  async invalidate(): Promise<void> {
    this.entry = null;
  }
}

const CACHE_KEY = 'orb-config:effective';

/** Upstash Redis-backed {@link OrbConfigCache}, shared across instances. */
export class RedisOrbConfigCache implements OrbConfigCache {
  constructor(private readonly redis: Redis) {}

  async get(): Promise<OrbConfig | null> {
    const value = await this.redis.get<OrbConfig>(CACHE_KEY);
    return value ?? null;
  }

  async set(config: OrbConfig, ttlSeconds: number): Promise<void> {
    await this.redis.set(CACHE_KEY, config, { ex: ttlSeconds });
  }

  async invalidate(): Promise<void> {
    await this.redis.del(CACHE_KEY);
  }
}
