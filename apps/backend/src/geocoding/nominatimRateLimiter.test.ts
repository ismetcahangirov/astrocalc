import { describe, expect, it, vi } from 'vitest';
import { InMemoryNominatimRateLimiter, RedisNominatimRateLimiter } from './nominatimRateLimiter';

describe('InMemoryNominatimRateLimiter', () => {
  it('does not delay the first acquire', async () => {
    const sleep = vi.fn(async () => undefined);
    const limiter = new InMemoryNominatimRateLimiter({ minIntervalMs: 1000, now: () => 0, sleep });

    await limiter.acquire();

    expect(sleep).not.toHaveBeenCalled();
  });

  it('does not delay a later acquire once enough time has passed', async () => {
    const sleep = vi.fn(async () => undefined);
    let clock = 0;
    const limiter = new InMemoryNominatimRateLimiter({
      minIntervalMs: 1000,
      now: () => clock,
      sleep,
    });

    await limiter.acquire();
    clock = 5000; // well past the 1s window
    await limiter.acquire();

    expect(sleep).not.toHaveBeenCalled();
  });

  it('serializes concurrent acquires with increasing waits spaced by minIntervalMs', async () => {
    const waits: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      waits.push(ms);
    });
    const limiter = new InMemoryNominatimRateLimiter({ minIntervalMs: 1000, now: () => 0, sleep });

    await Promise.all([limiter.acquire(), limiter.acquire(), limiter.acquire()]);

    expect(waits).toEqual([1000, 2000]);
  });
});

describe('RedisNominatimRateLimiter', () => {
  it('returns immediately when the lock is acquired on the first try', async () => {
    const redis = { set: vi.fn().mockResolvedValue('OK') };
    const sleep = vi.fn(async () => undefined);
    const limiter = new RedisNominatimRateLimiter(redis as never, { sleep });

    await limiter.acquire();

    expect(redis.set).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith('nominatim:rate-limit-lock', 1, { nx: true, px: 1000 });
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries until another instance releases the lock', async () => {
    const redis = {
      set: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('OK'),
    };
    const sleep = vi.fn(async () => undefined);
    const limiter = new RedisNominatimRateLimiter(redis as never, { sleep, now: () => 0 });

    await limiter.acquire();

    expect(redis.set).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('throws rather than waiting forever when the lock never frees up', async () => {
    const redis = { set: vi.fn().mockResolvedValue(null) };
    const sleep = vi.fn(async () => undefined);
    let clock = 0;
    const limiter = new RedisNominatimRateLimiter(redis as never, {
      sleep,
      now: () => clock,
      maxWaitMs: 5000,
    });
    sleep.mockImplementation(async () => {
      clock += 1000;
    });

    await expect(limiter.acquire()).rejects.toThrow(/timed out/i);
  });
});
