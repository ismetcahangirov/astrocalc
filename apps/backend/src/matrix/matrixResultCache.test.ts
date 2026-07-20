import { describe, expect, it, vi } from 'vitest';
import { getOrComputeMatrix, InMemoryMatrixResultCache } from './matrixResultCache';

const KEY = { birthDate: '1990-05-12' };
const OTHER_KEY = { birthDate: '1991-06-13' };

describe('InMemoryMatrixResultCache', () => {
  it('returns null for a key that was never set', async () => {
    const cache = new InMemoryMatrixResultCache();
    expect(await cache.get('user-1', KEY)).toBeNull();
  });

  it('round-trips a stored value', async () => {
    const cache = new InMemoryMatrixResultCache();
    await cache.set('user-1', KEY, { centre: 7 });
    expect(await cache.get('user-1', KEY)).toEqual({ centre: 7 });
  });

  it('namespaces entries by owner', async () => {
    const cache = new InMemoryMatrixResultCache();
    await cache.set('user-1', KEY, { centre: 7 });
    // Same birth date, different owner: two people born on the same day must not
    // read each other's entry, even though their Matrices would be identical.
    expect(await cache.get('user-2', KEY)).toBeNull();
  });

  it('invalidates only the given owner', async () => {
    const cache = new InMemoryMatrixResultCache();
    await cache.set('user-1', KEY, { centre: 7 });
    await cache.set('user-2', KEY, { centre: 7 });

    await cache.invalidate('user-1');

    expect(await cache.get('user-1', KEY)).toBeNull();
    expect(await cache.get('user-2', KEY)).toEqual({ centre: 7 });
  });

  it('invalidates every entry an owner holds, not just the current one', async () => {
    const cache = new InMemoryMatrixResultCache();
    await cache.set('user-1', KEY, { centre: 7 });
    await cache.set('user-1', OTHER_KEY, { centre: 9 });

    await cache.invalidate('user-1');

    expect(await cache.get('user-1', KEY)).toBeNull();
    expect(await cache.get('user-1', OTHER_KEY)).toBeNull();
  });
});

describe('getOrComputeMatrix', () => {
  it('computes and stores on a miss', async () => {
    const cache = new InMemoryMatrixResultCache();
    const compute = vi.fn(async () => ({ centre: 7 }));

    const result = await getOrComputeMatrix(cache, 'user-1', KEY, compute);

    expect(result).toEqual({ centre: 7 });
    expect(compute).toHaveBeenCalledTimes(1);
    expect(await cache.get('user-1', KEY)).toEqual({ centre: 7 });
  });

  it('serves a hit without recomputing', async () => {
    const cache = new InMemoryMatrixResultCache();
    const compute = vi.fn(async () => ({ centre: 7 }));

    await getOrComputeMatrix(cache, 'user-1', KEY, compute);
    const second = await getOrComputeMatrix(cache, 'user-1', KEY, compute);

    expect(second).toEqual({ centre: 7 });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('recomputes after the owner is invalidated', async () => {
    const cache = new InMemoryMatrixResultCache();
    const compute = vi.fn(async () => ({ centre: 7 }));

    await getOrComputeMatrix(cache, 'user-1', KEY, compute);
    await cache.invalidate('user-1');
    await getOrComputeMatrix(cache, 'user-1', KEY, compute);

    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('recomputes for a different birth date rather than serving the old arcana', async () => {
    const cache = new InMemoryMatrixResultCache();
    const compute = vi
      .fn<() => Promise<{ centre: number }>>()
      .mockResolvedValueOnce({ centre: 7 })
      .mockResolvedValueOnce({ centre: 9 });

    const first = await getOrComputeMatrix(cache, 'user-1', KEY, compute);
    const second = await getOrComputeMatrix(cache, 'user-1', OTHER_KEY, compute);

    expect(first).toEqual({ centre: 7 });
    expect(second).toEqual({ centre: 9 });
  });
});
