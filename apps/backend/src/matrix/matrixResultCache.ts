import { hashMatrixCacheKey, type MatrixCacheKeyInput } from './matrixCacheKey';

/**
 * Cache boundary for computed Matrix of Destiny results, keyed by owner +
 * birth date (#73). Kept as an interface so callers can be unit-tested against
 * an in-memory store while production uses Upstash Redis
 * (`redisMatrixResultCache.ts`).
 *
 * Like `NumerologyResultCache` — and unlike `ChartResultCache` — this
 * deliberately does *not* implement `ChartCacheInvalidator`. That port is what
 * `profileService` passes as its single `cache` dep, and a Matrix cache is not
 * a chart cache. It keeps its own `invalidate` all the same: a profile edit
 * that changes the birth date must drop the cached arcana (see
 * `profileService.ts`).
 *
 * `ownerId` is a user id today; it is typed as a plain string so a saved
 * subject's id can namespace its own entries here without a shape change —
 * which is exactly what `subjectsService.getMatrix` does.
 */
export interface MatrixResultCache {
  get<T>(ownerId: string, key: MatrixCacheKeyInput): Promise<T | null>;
  set<T>(ownerId: string, key: MatrixCacheKeyInput, value: T): Promise<void>;
  invalidate(ownerId: string): Promise<void>;
}

/**
 * Look up a cached Matrix, computing (and caching) it on a miss. The intended
 * entry point for `matrixService`.
 *
 * The Matrix is cheap to compute — a few dozen digit sums — so unlike the natal
 * chart this cache is not buying CPU back. What it buys is a *stable* result:
 * every read of a given person's Matrix returns the identical object, so an
 * arcana can never appear to shift between two screens because one of them
 * recomputed. That is worth more here than the microseconds.
 */
export async function getOrComputeMatrix<T>(
  cache: MatrixResultCache,
  ownerId: string,
  key: MatrixCacheKeyInput,
  compute: () => Promise<T>,
): Promise<T> {
  const cached = await cache.get<T>(ownerId, key);
  if (cached !== null) return cached;

  const value = await compute();
  await cache.set(ownerId, key, value);
  return value;
}

/** In-memory {@link MatrixResultCache} for tests and local dev without Redis. */
export class InMemoryMatrixResultCache implements MatrixResultCache {
  private entries = new Map<string, unknown>();

  private static entryKey(ownerId: string, key: MatrixCacheKeyInput): string {
    return `${ownerId}:${hashMatrixCacheKey(key)}`;
  }

  async get<T>(ownerId: string, key: MatrixCacheKeyInput): Promise<T | null> {
    const value = this.entries.get(InMemoryMatrixResultCache.entryKey(ownerId, key));
    return (value as T | undefined) ?? null;
  }

  async set<T>(ownerId: string, key: MatrixCacheKeyInput, value: T): Promise<void> {
    this.entries.set(InMemoryMatrixResultCache.entryKey(ownerId, key), value);
  }

  async invalidate(ownerId: string): Promise<void> {
    const prefix = `${ownerId}:`;
    for (const entryKey of this.entries.keys()) {
      if (entryKey.startsWith(prefix)) this.entries.delete(entryKey);
    }
  }
}
