import { describe, expect, it } from 'vitest';
import { createProfileService } from './profileService';
import { InMemoryUserRepository } from '../auth/repository';
import type { ChartCacheInvalidator } from './chartCacheInvalidator';

function build() {
  const repo = new InMemoryUserRepository();
  const invalidated: string[] = [];
  const cache: ChartCacheInvalidator = {
    async invalidate(userId: string) {
      invalidated.push(userId);
    },
  };
  const numerologyInvalidated: string[] = [];
  const numerologyCache: ChartCacheInvalidator = {
    async invalidate(userId: string) {
      numerologyInvalidated.push(userId);
    },
  };
  const service = createProfileService({ repo, cache, numerologyCache });
  return { repo, service, invalidated, numerologyInvalidated };
}

async function createUser(repo: InMemoryUserRepository) {
  const user = await repo.createUserWithProfile({
    email: 'ada@example.com',
    googleId: 'g-1',
    displayName: 'Ada',
    avatarUrl: null,
    locale: 'en',
  });
  return user.id;
}

describe('createProfileService.updateProfile — chart cache invalidation', () => {
  it('does not invalidate when no birth-relevant field is touched', async () => {
    const { repo, service, invalidated } = build();
    const userId = await createUser(repo);

    await service.updateProfile(userId, { displayName: 'Ada Lovelace' });
    await service.updateProfile(userId, { avatarUrl: 'https://example.com/a.png' });
    await service.updateProfile(userId, { locale: 'az' });

    expect(invalidated).toEqual([]);
  });

  it('invalidates when birthDate changes', async () => {
    const { repo, service, invalidated } = build();
    const userId = await createUser(repo);

    await service.updateProfile(userId, { birthDate: '1990-05-12' });

    expect(invalidated).toEqual([userId]);
  });

  it('invalidates when birthTime, birthPlace, or birthTimeKnown changes', async () => {
    const { repo, service, invalidated } = build();
    const userId = await createUser(repo);

    await service.updateProfile(userId, { birthTime: '10:30' });
    await service.updateProfile(userId, {
      birthPlaceName: 'Baku, Azerbaijan',
      birthPlaceLat: 40.4,
      birthPlaceLng: 49.8,
    });
    await service.updateProfile(userId, { birthTimeKnown: true });

    expect(invalidated).toEqual([userId, userId, userId]);
  });

  it('does not invalidate when a birth field is resent with its existing value', async () => {
    const { repo, service, invalidated } = build();
    const userId = await createUser(repo);

    await service.updateProfile(userId, { birthDate: '1990-05-12' });
    invalidated.length = 0; // reset after the initial (real) change

    await service.updateProfile(userId, { birthDate: '1990-05-12', displayName: 'Ada Lovelace' });

    expect(invalidated).toEqual([]);
  });

  it('invalidates once even when multiple birth fields change in the same patch', async () => {
    const { repo, service, invalidated } = build();
    const userId = await createUser(repo);

    await service.updateProfile(userId, {
      birthDate: '1990-05-12',
      birthTime: '10:30',
      birthPlaceName: 'Baku, Azerbaijan',
    });

    expect(invalidated).toEqual([userId]);
  });

  it('works with the default no-op invalidator when none is provided', async () => {
    const repo = new InMemoryUserRepository();
    const service = createProfileService({ repo });
    const userId = await createUser(repo);

    await expect(service.updateProfile(userId, { birthDate: '1990-05-12' })).resolves.toMatchObject(
      {
        birthDate: '1990-05-12',
      },
    );
  });
});

describe('createProfileService.updateProfile — numerology cache invalidation', () => {
  it('invalidates the numerology cache when fullName changes, without touching the chart cache', async () => {
    // The regression this guards: `fullName` is not a birth-relevant field, so
    // the chart-cache change detection does not see it at all. A user who
    // corrects their name must stop seeing the old numbers — while their
    // (unaffected, expensive) chart stays cached.
    const { repo, service, invalidated, numerologyInvalidated } = build();
    const userId = await createUser(repo);

    await service.updateProfile(userId, { fullName: 'Augusta Ada King' });

    expect(numerologyInvalidated).toEqual([userId]);
    expect(invalidated).toEqual([]);
  });

  it('invalidates both caches when birthDate changes — the one field they share', async () => {
    const { repo, service, invalidated, numerologyInvalidated } = build();
    const userId = await createUser(repo);

    await service.updateProfile(userId, { birthDate: '1990-05-12' });

    expect(numerologyInvalidated).toEqual([userId]);
    expect(invalidated).toEqual([userId]);
  });

  it('does not invalidate the numerology cache for a birth-only field like birthPlaceName', async () => {
    const { repo, service, numerologyInvalidated } = build();
    const userId = await createUser(repo);

    await service.updateProfile(userId, { birthTime: '10:30', birthTimeKnown: true });

    expect(numerologyInvalidated).toEqual([]);
  });

  it('does not invalidate when fullName is resent with its existing value', async () => {
    const { repo, service, numerologyInvalidated } = build();
    const userId = await createUser(repo);

    await service.updateProfile(userId, { fullName: 'Ada Lovelace' });
    numerologyInvalidated.length = 0; // reset after the initial (real) change

    await service.updateProfile(userId, { fullName: 'Ada Lovelace' });

    expect(numerologyInvalidated).toEqual([]);
  });

  it('does not invalidate when only a nickname-ish field changes', async () => {
    const { repo, service, numerologyInvalidated } = build();
    const userId = await createUser(repo);

    await service.updateProfile(userId, { displayName: 'Ada L.' });

    expect(numerologyInvalidated).toEqual([]);
  });
});

describe('createProfileService.updateProfile — timezone derivation', () => {
  // Fake resolver: Baku coordinates -> Asia/Baku, anything else -> null.
  const deriveTimezone = (lat: number | null | undefined, lng: number | null | undefined) =>
    lat === 40.4 && lng === 49.8 ? 'Asia/Baku' : null;

  function buildWithDerive() {
    const repo = new InMemoryUserRepository();
    const service = createProfileService({ repo, deriveTimezone });
    return { repo, service };
  }

  it('derives and stores the timezone from coordinates on save', async () => {
    const { repo, service } = buildWithDerive();
    const userId = await createUser(repo);

    const updated = await service.updateProfile(userId, {
      birthPlaceName: 'Baku, Azerbaijan',
      birthPlaceLat: 40.4,
      birthPlaceLng: 49.8,
    });

    expect(updated.birthPlaceTimezone).toBe('Asia/Baku');
  });

  it('overrides any client-sent timezone with the server-derived one', async () => {
    const { repo, service } = buildWithDerive();
    const userId = await createUser(repo);

    const updated = await service.updateProfile(userId, {
      birthPlaceLat: 40.4,
      birthPlaceLng: 49.8,
      birthPlaceTimezone: 'Europe/London', // client-supplied — must be ignored
    });

    expect(updated.birthPlaceTimezone).toBe('Asia/Baku');
  });

  it('clears the timezone when coordinates are removed', async () => {
    const { repo, service } = buildWithDerive();
    const userId = await createUser(repo);

    await service.updateProfile(userId, { birthPlaceLat: 40.4, birthPlaceLng: 49.8 });
    const updated = await service.updateProfile(userId, {
      birthPlaceLat: null,
      birthPlaceLng: null,
    });

    expect(updated.birthPlaceTimezone).toBeNull();
  });

  it('derives from existing coordinates when only one coordinate is patched', async () => {
    const { repo, service } = buildWithDerive();
    const userId = await createUser(repo);

    // Seed both coordinates but with the wrong lng, so tz is null...
    await service.updateProfile(userId, { birthPlaceLat: 40.4, birthPlaceLng: 0 });
    // ...then patch only lng to the Baku value; lat is read from the stored profile.
    const updated = await service.updateProfile(userId, { birthPlaceLng: 49.8 });

    expect(updated.birthPlaceTimezone).toBe('Asia/Baku');
  });

  it('leaves the stored timezone untouched when the patch does not touch coordinates', async () => {
    const { repo, service } = buildWithDerive();
    const userId = await createUser(repo);

    await service.updateProfile(userId, { birthPlaceLat: 40.4, birthPlaceLng: 49.8 });
    const updated = await service.updateProfile(userId, { displayName: 'Ada Lovelace' });

    expect(updated.birthPlaceTimezone).toBe('Asia/Baku');
  });
});
