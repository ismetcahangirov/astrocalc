import type { ChartCacheInvalidator } from '../profile/chartCacheInvalidator';
import { hashChartCacheKey, type ChartCacheKeyInput } from './chartCacheKey';

/**
 * Cache boundary for computed natal-chart/matrix results, keyed by user +
 * birth data (#19). Kept as an interface so callers can be unit-tested against
 * an in-memory store while production uses Upstash Redis (`redisChartResultCache.ts`).
 *
 * Also implements {@link ChartCacheInvalidator} so an instance can be passed
 * directly as `ProfileServiceDeps.cache` — editing a birth-relevant profile
 * field invalidates every chart cached for that user in one call.
 */
export interface ChartResultCache extends ChartCacheInvalidator {
  get<T>(userId: string, key: ChartCacheKeyInput): Promise<T | null>;
  set<T>(userId: string, key: ChartCacheKeyInput, value: T): Promise<void>;
}

/**
 * Look up a cached chart result, computing (and caching) it on a miss. This is
 * the intended entry point for the future chart-computation service: it turns
 * "compute this every time" into "compute once per distinct birth data," which
 * is what makes a cache hit dramatically (order-of-magnitude) faster than a
 * miss — the whole point of #19's third acceptance criterion.
 */
export async function getOrComputeChart<T>(
  cache: ChartResultCache,
  userId: string,
  key: ChartCacheKeyInput,
  compute: () => Promise<T>,
): Promise<T> {
  const cached = await cache.get<T>(userId, key);
  if (cached !== null) return cached;

  const value = await compute();
  await cache.set(userId, key, value);
  return value;
}

/** In-memory {@link ChartResultCache} for tests and local dev without Redis. */
export class InMemoryChartResultCache implements ChartResultCache {
  private entries = new Map<string, unknown>();

  private static entryKey(userId: string, key: ChartCacheKeyInput): string {
    return `${userId}:${hashChartCacheKey(key)}`;
  }

  async get<T>(userId: string, key: ChartCacheKeyInput): Promise<T | null> {
    const value = this.entries.get(InMemoryChartResultCache.entryKey(userId, key));
    return (value as T | undefined) ?? null;
  }

  async set<T>(userId: string, key: ChartCacheKeyInput, value: T): Promise<void> {
    this.entries.set(InMemoryChartResultCache.entryKey(userId, key), value);
  }

  async invalidate(userId: string): Promise<void> {
    const prefix = `${userId}:`;
    for (const entryKey of this.entries.keys()) {
      if (entryKey.startsWith(prefix)) this.entries.delete(entryKey);
    }
  }
}
