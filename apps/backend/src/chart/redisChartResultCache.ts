import type { Redis } from '@upstash/redis';
import { hashChartCacheKey, type ChartCacheKeyInput } from './chartCacheKey';
import type { ChartResultCache } from './chartResultCache';

/**
 * Upstash Redis-backed {@link ChartResultCache}, shared across instances.
 *
 * Invalidation (#19's second acceptance criterion) is per-user, but the cache
 * key hash intentionally does *not* include the user id (see the technical
 * notes on `hashChartCacheKey`). Rather than tracking/deleting every hash a
 * user has ever produced — which would need an unbounded per-user index, or
 * an Upstash `SCAN`, both worth avoiding — each user has a "generation"
 * counter. The data key embeds the current generation, so bumping it via
 * `INCR` orphans every previously-cached entry for that user in one O(1)
 * write; `ttlSeconds` (when set) is what actually reclaims the orphaned keys.
 */
export class RedisChartResultCache implements ChartResultCache {
  constructor(
    private readonly redis: Redis,
    /** TTL applied to cached entries, or `undefined` for no TTL (explicit invalidation only) — see #19's technical notes. */
    private readonly ttlSeconds?: number,
  ) {}

  private static generationKey(userId: string): string {
    return `chart:gen:${userId}`;
  }

  private static dataKey(userId: string, generation: number, hash: string): string {
    return `chart:${userId}:${generation}:${hash}`;
  }

  private async currentGeneration(userId: string): Promise<number> {
    const generation = await this.redis.get<number>(RedisChartResultCache.generationKey(userId));
    return generation ?? 0;
  }

  async get<T>(userId: string, key: ChartCacheKeyInput): Promise<T | null> {
    const generation = await this.currentGeneration(userId);
    const dataKey = RedisChartResultCache.dataKey(userId, generation, hashChartCacheKey(key));
    const value = await this.redis.get<T>(dataKey);
    return value ?? null;
  }

  async set<T>(userId: string, key: ChartCacheKeyInput, value: T): Promise<void> {
    const generation = await this.currentGeneration(userId);
    const dataKey = RedisChartResultCache.dataKey(userId, generation, hashChartCacheKey(key));
    if (this.ttlSeconds === undefined) {
      await this.redis.set(dataKey, value);
    } else {
      await this.redis.set(dataKey, value, { ex: this.ttlSeconds });
    }
  }

  async invalidate(userId: string): Promise<void> {
    await this.redis.incr(RedisChartResultCache.generationKey(userId));
  }
}
