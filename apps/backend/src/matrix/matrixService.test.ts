import { describe, expect, it } from 'vitest';
import { InMemoryUserRepository } from '../auth/repository';
import type { MatrixCacheKeyInput } from './matrixCacheKey';
import { InMemoryMatrixResultCache, type MatrixResultCache } from './matrixResultCache';
import { createMatrixService } from './matrixService';

/** Wraps an in-memory cache and counts get/set calls, to assert whether a compute was skipped. */
class CountingMatrixResultCache implements MatrixResultCache {
  readonly inner = new InMemoryMatrixResultCache();
  getCalls = 0;
  setCalls = 0;

  async get<T>(ownerId: string, key: MatrixCacheKeyInput): Promise<T | null> {
    this.getCalls++;
    return this.inner.get<T>(ownerId, key);
  }

  async set<T>(ownerId: string, key: MatrixCacheKeyInput, value: T): Promise<void> {
    this.setCalls++;
    return this.inner.set(ownerId, key, value);
  }

  async invalidate(ownerId: string): Promise<void> {
    return this.inner.invalidate(ownerId);
  }
}

async function makeService() {
  const repo = new InMemoryUserRepository();
  const cache = new CountingMatrixResultCache();
  const service = createMatrixService({ repo, cache });

  const user = await repo.createUserWithProfile({
    email: 'ada@example.com',
    googleId: 'g-1',
    displayName: 'Ada',
    avatarUrl: null,
    locale: 'en',
  });

  return { service, repo, cache, userId: user.id };
}

describe('getMatrix', () => {
  it('computes the Matrix with no Pro interpretation (not yet built)', async () => {
    const { service, repo, userId } = await makeService();
    await repo.updateProfile(userId, { birthDate: '1990-11-22' });

    const result = await service.getMatrix(userId);

    // The reference case from the method spec §6: day 22 stays 22, and the
    // centre is 22+11+19+7 = 59 -> 14.
    expect(result.matrix.core.day).toBe(22);
    expect(result.matrix.core.centre).toBe(14);
    expect(result.interpretation).toBeNull();
  });

  it('serves a second call from the cache without recomputing', async () => {
    const { service, repo, cache, userId } = await makeService();
    await repo.updateProfile(userId, { birthDate: '1990-11-22' });

    const first = await service.getMatrix(userId);
    const second = await service.getMatrix(userId);

    expect(second).toEqual(first);
    expect(cache.setCalls).toBe(1);
    expect(cache.getCalls).toBe(2);
  });

  it('keeps serving the cached Matrix no matter how much time passes', async () => {
    // The behavioural difference from numerology, which must miss at every month
    // boundary. The Matrix has no time-varying input, so a cache that never
    // expired on its own would still always be correct — and this test is what
    // stops someone "fixing" that by adding a reference date to the key.
    const { service, repo, cache, userId } = await makeService();
    await repo.updateProfile(userId, { birthDate: '1990-11-22' });

    await service.getMatrix(userId);
    await service.getMatrix(userId);
    await service.getMatrix(userId);

    expect(cache.setCalls).toBe(1);
  });

  it('recomputes after a birth-date change invalidates the cache', async () => {
    const { service, repo, cache, userId } = await makeService();
    await repo.updateProfile(userId, { birthDate: '1990-11-22' });
    const before = await service.getMatrix(userId);

    await repo.updateProfile(userId, { birthDate: '1987-01-29' });
    await cache.invalidate(userId);
    const after = await service.getMatrix(userId);

    expect(before.matrix.core.day).toBe(22);
    expect(after.matrix.core.day).toBe(11); // 29 -> 2+9
    expect(cache.setCalls).toBe(2);
  });

  it('does not serve the old Matrix after a birth-date change even without an invalidate', async () => {
    // The birth date *is* the cache key, so a corrected date addresses a
    // different entry whether or not anything invalidated the old one.
    // Invalidation exists to reclaim the orphan, not to guarantee correctness —
    // worth pinning down, because it means a missed invalidation here is a
    // storage leak rather than a wrong answer shown to a user.
    const { service, repo, userId } = await makeService();
    await repo.updateProfile(userId, { birthDate: '1990-11-22' });
    await service.getMatrix(userId);

    await repo.updateProfile(userId, { birthDate: '1987-01-29' });
    const after = await service.getMatrix(userId); // no invalidate call

    expect(after.matrix.core.day).toBe(11);
    expect(after.matrix.birthDate).toBe('1987-01-29');
  });

  it('throws IncompleteMatrixProfileError when the profile has no birth date', async () => {
    const { service, userId } = await makeService();

    await expect(service.getMatrix(userId)).rejects.toMatchObject({
      code: 'incomplete_profile',
      details: { missing: ['birthDate'] },
    });
  });

  it('computes without a birth time, place or full name', async () => {
    // The Matrix's whole distinguishing property: it needs strictly less data
    // than either sibling. A profile that can produce neither a chart (no
    // coordinates) nor numerology (no full name) still produces a full Matrix.
    const { service, repo, userId } = await makeService();
    await repo.updateProfile(userId, { birthDate: '1990-05-12' });

    const result = await service.getMatrix(userId);

    expect(result.matrix.core.day).toBe(12);
    expect(result.matrix.health).toHaveLength(7);
  });
});
