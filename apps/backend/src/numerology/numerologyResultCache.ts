import { hashNumerologyCacheKey, type NumerologyCacheKeyInput } from './numerologyCacheKey';

/**
 * Cache boundary for computed numerology profiles, keyed by owner + name +
 * birth date + reference month (#64). Kept as an interface so callers can be
 * unit-tested against an in-memory store while production uses Upstash Redis
 * (`redisNumerologyResultCache.ts`).
 *
 * Unlike `ChartResultCache` this deliberately does *not* implement
 * `ChartCacheInvalidator`: that port is what `profileService` passes as its
 * single `cache` dep, and a numerology cache is not a chart cache. It keeps its
 * own `invalidate` all the same — a profile edit that changes the full name or
 * the birth date must drop the cached numbers (see `profileService.ts`).
 *
 * `ownerId` is a user id today; it is typed as a plain string so a saved
 * subject's id can namespace its own entries here later without a shape change.
 */
export interface NumerologyResultCache {
  get<T>(ownerId: string, key: NumerologyCacheKeyInput): Promise<T | null>;
  set<T>(ownerId: string, key: NumerologyCacheKeyInput, value: T): Promise<void>;
  invalidate(ownerId: string): Promise<void>;
}

/**
 * Look up a cached numerology profile, computing (and caching) it on a miss.
 * The intended entry point for `numerologyService`: it turns "compute on every
 * request" into "compute once per person per month".
 */
export async function getOrComputeNumerology<T>(
  cache: NumerologyResultCache,
  ownerId: string,
  key: NumerologyCacheKeyInput,
  compute: () => Promise<T>,
): Promise<T> {
  const cached = await cache.get<T>(ownerId, key);
  if (cached !== null) return cached;

  const value = await compute();
  await cache.set(ownerId, key, value);
  return value;
}

/** In-memory {@link NumerologyResultCache} for tests and local dev without Redis. */
export class InMemoryNumerologyResultCache implements NumerologyResultCache {
  private entries = new Map<string, unknown>();

  private static entryKey(ownerId: string, key: NumerologyCacheKeyInput): string {
    return `${ownerId}:${hashNumerologyCacheKey(key)}`;
  }

  async get<T>(ownerId: string, key: NumerologyCacheKeyInput): Promise<T | null> {
    const value = this.entries.get(InMemoryNumerologyResultCache.entryKey(ownerId, key));
    return (value as T | undefined) ?? null;
  }

  async set<T>(ownerId: string, key: NumerologyCacheKeyInput, value: T): Promise<void> {
    this.entries.set(InMemoryNumerologyResultCache.entryKey(ownerId, key), value);
  }

  async invalidate(ownerId: string): Promise<void> {
    const prefix = `${ownerId}:`;
    for (const entryKey of this.entries.keys()) {
      if (entryKey.startsWith(prefix)) this.entries.delete(entryKey);
    }
  }
}
