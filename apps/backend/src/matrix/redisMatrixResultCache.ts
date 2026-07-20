import type { Redis } from '@upstash/redis';
import { hashMatrixCacheKey, type MatrixCacheKeyInput } from './matrixCacheKey';
import type { MatrixResultCache } from './matrixResultCache';

/**
 * Upstash Redis-backed {@link MatrixResultCache}, shared across instances.
 *
 * Invalidation is per-owner, but the cache key hash intentionally does *not*
 * include the owner id (see `hashMatrixCacheKey`). Rather than
 * tracking/deleting every hash an owner has ever produced — which would need an
 * unbounded per-owner index, or an Upstash `SCAN`, both worth avoiding — each
 * owner has a "generation" counter. The data key embeds the current generation,
 * so bumping it via `INCR` orphans every previously-cached entry for that owner
 * in one O(1) write; `ttlSeconds` (when set) is what actually reclaims the
 * orphaned keys.
 *
 * Note that a Matrix entry, unlike a numerology one, has no second self-cleaning
 * mechanism: its key is scoped to an immutable birth date rather than to a
 * rolling calendar month, so nothing ever orphans an entry except an explicit
 * invalidate. In practice each owner holds at most one live entry, and the TTL
 * exists for the birth-date-correction case rather than for volume.
 */
export class RedisMatrixResultCache implements MatrixResultCache {
  constructor(
    private readonly redis: Redis,
    /** TTL applied to cached entries, or `undefined` for no TTL (explicit invalidation only). */
    private readonly ttlSeconds?: number,
  ) {}

  private static generationKey(ownerId: string): string {
    return `matrix:gen:${ownerId}`;
  }

  private static dataKey(ownerId: string, generation: number, hash: string): string {
    return `matrix:${ownerId}:${generation}:${hash}`;
  }

  private async currentGeneration(ownerId: string): Promise<number> {
    const generation = await this.redis.get<number>(RedisMatrixResultCache.generationKey(ownerId));
    return generation ?? 0;
  }

  async get<T>(ownerId: string, key: MatrixCacheKeyInput): Promise<T | null> {
    const generation = await this.currentGeneration(ownerId);
    const dataKey = RedisMatrixResultCache.dataKey(ownerId, generation, hashMatrixCacheKey(key));
    const value = await this.redis.get<T>(dataKey);
    return value ?? null;
  }

  async set<T>(ownerId: string, key: MatrixCacheKeyInput, value: T): Promise<void> {
    const generation = await this.currentGeneration(ownerId);
    const dataKey = RedisMatrixResultCache.dataKey(ownerId, generation, hashMatrixCacheKey(key));
    if (this.ttlSeconds === undefined) {
      await this.redis.set(dataKey, value);
    } else {
      await this.redis.set(dataKey, value, { ex: this.ttlSeconds });
    }
  }

  async invalidate(ownerId: string): Promise<void> {
    await this.redis.incr(RedisMatrixResultCache.generationKey(ownerId));
  }
}
