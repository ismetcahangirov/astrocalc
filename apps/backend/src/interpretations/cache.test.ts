import { describe, expect, it } from 'vitest';
import { InMemoryInterpretationCache } from './cache';
import type { InterpretationKey, InterpretationText } from './types';

const KEY: InterpretationKey = { category: 'planet-sign', subjectKey: 'sun-Aries', locale: 'en' };
const TEXT: InterpretationText = { ...KEY, content: 'Bold self-expression.', updatedBy: null, updatedAt: new Date(0) };

describe('InMemoryInterpretationCache', () => {
  it('returns null for a key that was never set', async () => {
    const cache = new InMemoryInterpretationCache();
    expect(await cache.get(KEY)).toBeNull();
  });

  it('returns a cached value before it expires', async () => {
    let clockMs = 0;
    const cache = new InMemoryInterpretationCache(() => clockMs);

    await cache.set(KEY, TEXT, 60);
    clockMs += 59_000;

    expect(await cache.get(KEY)).toEqual(TEXT);
  });

  it('expires a value once its TTL has elapsed', async () => {
    let clockMs = 0;
    const cache = new InMemoryInterpretationCache(() => clockMs);

    await cache.set(KEY, TEXT, 60);
    clockMs += 60_000;

    expect(await cache.get(KEY)).toBeNull();
  });

  it('does not confuse rows that differ only by locale', async () => {
    const cache = new InMemoryInterpretationCache();
    await cache.set(KEY, TEXT, 60);
    await cache.set({ ...KEY, locale: 'az' }, { ...TEXT, locale: 'az', content: 'azerbaijani' }, 60);

    expect((await cache.get(KEY))?.content).toBe('Bold self-expression.');
    expect((await cache.get({ ...KEY, locale: 'az' }))?.content).toBe('azerbaijani');
  });

  it('invalidate evicts the entry so the next read misses', async () => {
    const cache = new InMemoryInterpretationCache();
    await cache.set(KEY, TEXT, 60);
    await cache.invalidate(KEY);

    expect(await cache.get(KEY)).toBeNull();
  });
});
