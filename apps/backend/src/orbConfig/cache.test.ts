import { describe, expect, it } from 'vitest';
import { InMemoryOrbConfigCache } from './cache';

describe('InMemoryOrbConfigCache', () => {
  it('returns null when nothing has been cached', async () => {
    const cache = new InMemoryOrbConfigCache();
    expect(await cache.get()).toBeNull();
  });

  it('returns the cached config within its TTL', async () => {
    let now = 1_000;
    const cache = new InMemoryOrbConfigCache(() => now);
    await cache.set({ trine: 5 }, 60);

    now += 30_000;
    expect(await cache.get()).toEqual({ trine: 5 });
  });

  it('expires the cached config after its TTL elapses', async () => {
    let now = 1_000;
    const cache = new InMemoryOrbConfigCache(() => now);
    await cache.set({ trine: 5 }, 60);

    now += 61_000;
    expect(await cache.get()).toBeNull();
  });

  it('invalidate drops the cached config immediately', async () => {
    const cache = new InMemoryOrbConfigCache();
    await cache.set({ trine: 5 }, 60);
    await cache.invalidate();
    expect(await cache.get()).toBeNull();
  });
});
