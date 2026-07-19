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
  const service = createProfileService({ repo, cache });
  return { repo, service, invalidated };
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
