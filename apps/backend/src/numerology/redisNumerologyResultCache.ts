import type { Redis } from '@upstash/redis';
import { hashNumerologyCacheKey, type NumerologyCacheKeyInput } from './numerologyCacheKey';
import type { NumerologyResultCache } from './numerologyResultCache';

/**
 * Upstash Redis-backed {@link NumerologyResultCache}, shared across instances.
 *
 * Invalidation is per-owner, but the cache key hash intentionally does *not*
 * include the owner id (see `hashNumerologyCacheKey`). Rather than
 * tracking/deleting every hash an owner has ever produced — which would need an
 * unbounded per-owner index, or an Upstash `SCAN`, both worth avoiding — each
 * owner has a "generation" counter. The data key embeds the current generation,
 * so bumping it via `INCR` orphans every previously-cached entry for that owner
 * in one O(1) write; `ttlSeconds` (when set) is what actually reclaims the
 * orphaned keys. Month-scoped keys (see `numerologyCacheKey.ts`) orphan
 * themselves the same way at each month boundary, which is the other reason a
 * TTL is worth configuring here.
 */
export class RedisNumerologyResultCache implements NumerologyResultCache {
  constructor(
    private readonly redis: Redis,
    /** TTL applied to cached entries, or `undefined` for no TTL (explicit invalidation only). */
    private readonly ttlSeconds?: number,
  ) {}

  private static generationKey(ownerId: string): string {
    return `numerology:gen:${ownerId}`;
  }

  private static dataKey(ownerId: string, generation: number, hash: string): string {
    return `numerology:${ownerId}:${generation}:${hash}`;
  }

  private async currentGeneration(ownerId: string): Promise<number> {
    const generation = await this.redis.get<number>(
      RedisNumerologyResultCache.generationKey(ownerId),
    );
    return generation ?? 0;
  }

  async get<T>(ownerId: string, key: NumerologyCacheKeyInput): Promise<T | null> {
    const generation = await this.currentGeneration(ownerId);
    const dataKey = RedisNumerologyResultCache.dataKey(
      ownerId,
      generation,
      hashNumerologyCacheKey(key),
    );
    const value = await this.redis.get<T>(dataKey);
    return value ?? null;
  }

  async set<T>(ownerId: string, key: NumerologyCacheKeyInput, value: T): Promise<void> {
    const generation = await this.currentGeneration(ownerId);
    const dataKey = RedisNumerologyResultCache.dataKey(
      ownerId,
      generation,
      hashNumerologyCacheKey(key),
    );
    if (this.ttlSeconds === undefined) {
      await this.redis.set(dataKey, value);
    } else {
      await this.redis.set(dataKey, value, { ex: this.ttlSeconds });
    }
  }

  async invalidate(ownerId: string): Promise<void> {
    await this.redis.incr(RedisNumerologyResultCache.generationKey(ownerId));
  }
}
