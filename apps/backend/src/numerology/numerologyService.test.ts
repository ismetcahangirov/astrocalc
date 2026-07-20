import { describe, expect, it } from 'vitest';
import { InMemoryUserRepository } from '../auth/repository';
import type { NumerologyCacheKeyInput } from './numerologyCacheKey';
import { InMemoryNumerologyResultCache, type NumerologyResultCache } from './numerologyResultCache';
import { createNumerologyService } from './numerologyService';

/** Wraps an in-memory cache and counts get/set calls, to assert whether a compute was skipped. */
class CountingNumerologyResultCache implements NumerologyResultCache {
  readonly inner = new InMemoryNumerologyResultCache();
  getCalls = 0;
  setCalls = 0;

  async get<T>(ownerId: string, key: NumerologyCacheKeyInput): Promise<T | null> {
    this.getCalls++;
    return this.inner.get<T>(ownerId, key);
  }

  async set<T>(ownerId: string, key: NumerologyCacheKeyInput, value: T): Promise<void> {
    this.setCalls++;
    return this.inner.set(ownerId, key, value);
  }

  async invalidate(ownerId: string): Promise<void> {
    return this.inner.invalidate(ownerId);
  }
}

async function makeService() {
  const repo = new InMemoryUserRepository();
  const cache = new CountingNumerologyResultCache();
  const service = createNumerologyService({ repo, cache });

  const user = await repo.createUserWithProfile({
    email: 'ada@example.com',
    googleId: 'g-1',
    displayName: 'Ada',
    avatarUrl: null,
    locale: 'en',
  });

  return { service, repo, cache, userId: user.id };
}

describe('getNumerology', () => {
  it('computes the profile with no Pro interpretation (not yet built)', async () => {
    const { service, repo, userId } = await makeService();
    await repo.updateProfile(userId, { fullName: 'Ada Lovelace', birthDate: '1990-05-12' });

    const result = await service.getNumerology(userId, '2026-07-20');

    // Hand-checked: 1990 -> 1+9+9+0 = 19 -> 10 -> 1; month 05 -> 5;
    // day 12 -> 1+2 = 3. 1 + 5 + 3 = 9.
    expect(result.profile.lifePath.value).toBe(9);
    expect(result.interpretation).toBeNull();
  });

  it('serves a second call in the same month from the cache without recomputing', async () => {
    const { service, repo, cache, userId } = await makeService();
    await repo.updateProfile(userId, { fullName: 'Ada Lovelace', birthDate: '1990-05-12' });

    const first = await service.getNumerology(userId, '2026-07-01');
    const second = await service.getNumerology(userId, '2026-07-31');

    expect(second).toEqual(first);
    expect(cache.setCalls).toBe(1);
    expect(cache.getCalls).toBe(2);
  });

  it('misses the cache in the next month, and the Personal Month actually changes', async () => {
    // This is the reason the key is month-scoped rather than birth-data-scoped:
    // a key that ignored the calendar would return July's 7 all through August.
    const { service, repo, cache, userId } = await makeService();
    await repo.updateProfile(userId, { fullName: 'Ada Lovelace', birthDate: '1990-05-12' });

    const july = await service.getNumerology(userId, '2026-07-31');
    const august = await service.getNumerology(userId, '2026-08-01');

    expect(cache.setCalls).toBe(2);
    expect(july.profile.personalMonth).toBe(7);
    expect(august.profile.personalMonth).toBe(8);
    expect(august.profile.personalMonth).not.toBe(july.profile.personalMonth);
    // The birth-date-derived numbers are unchanged across the boundary.
    expect(august.profile.lifePath).toEqual(july.profile.lifePath);
  });

  it('throws IncompleteNumerologyProfileError when the profile has no fullName or birth date', async () => {
    const { service, userId } = await makeService();

    await expect(service.getNumerology(userId, '2026-07-20')).rejects.toMatchObject({
      code: 'incomplete_profile',
      details: { missing: ['fullName', 'birthDate'] },
    });
  });

  it('throws rather than falling back to displayName when only fullName is missing', async () => {
    const { service, repo, userId } = await makeService();
    // `displayName: 'Ada'` was set at profile creation and stays set.
    await repo.updateProfile(userId, { birthDate: '1990-05-12' });

    await expect(service.getNumerology(userId, '2026-07-20')).rejects.toMatchObject({
      code: 'incomplete_profile',
      details: { missing: ['fullName'] },
    });
  });
});
