import type { Redis } from '@upstash/redis';
import type { NominatimResult } from './types';

/**
 * Cache boundary for Nominatim search results, keyed by normalized query text.
 * Caching is required both to respect Nominatim's rate-limit policy (repeat
 * searches shouldn't re-hit the upstream API) and for latency/offline
 * resilience. Kept as an interface so the service can be unit-tested against
 * an in-memory store while production uses Upstash Redis.
 */
export interface GeocodeCache {
  get(key: string): Promise<NominatimResult[] | null>;
  set(key: string, results: NominatimResult[], ttlSeconds: number): Promise<void>;
}

interface Expiring<T> {
  value: T;
  expiresAtMs: number;
}

/** In-memory {@link GeocodeCache} for tests and local dev without Redis. */
export class InMemoryGeocodeCache implements GeocodeCache {
  private entries = new Map<string, Expiring<NominatimResult[]>>();

  constructor(private readonly now: () => number = Date.now) {}

  async get(key: string): Promise<NominatimResult[] | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (this.now() >= entry.expiresAtMs) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, results: NominatimResult[], ttlSeconds: number): Promise<void> {
    this.entries.set(key, { value: results, expiresAtMs: this.now() + ttlSeconds * 1000 });
  }
}

const KEY_PREFIX = 'geocode:search:';

/** Upstash Redis-backed {@link GeocodeCache}, shared across instances. */
export class RedisGeocodeCache implements GeocodeCache {
  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<NominatimResult[] | null> {
    const value = await this.redis.get<NominatimResult[]>(`${KEY_PREFIX}${key}`);
    return value ?? null;
  }

  async set(key: string, results: NominatimResult[], ttlSeconds: number): Promise<void> {
    await this.redis.set(`${KEY_PREFIX}${key}`, results, { ex: ttlSeconds });
  }
}
