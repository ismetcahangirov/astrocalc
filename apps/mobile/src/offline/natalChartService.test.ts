import { describe, expect, it, vi } from 'vitest';
import { computeNatalChart, type NatalChart } from '@astrocalc/calc-engine';
import type { Profile } from '../api/profileApi';
import type { NatalChartResponse } from '../api/natalChartApi';
import { OfflineChartCache } from './chartCache';
import type { KeyValueStore } from './keyValueStore';
import {
  getNatalChart,
  syncPendingChart,
  profileToChartInput,
  MissingBirthDataError,
  type NatalChartServiceDeps,
} from './natalChartService';

/** Simulated loss of connectivity — the only error the offline fallback reacts to. */
class NetworkError extends Error {}
const isNetworkError = (error: unknown): boolean => error instanceof NetworkError;

function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (key) => Promise.resolve(map.get(key) ?? null),
    setItem: (key, value) => Promise.resolve(void map.set(key, value)),
    removeItem: (key) => Promise.resolve(void map.delete(key)),
  };
}

/** A fully-specified profile (New York, exact birth time known). */
const PROFILE: Profile = {
  userId: 'u1',
  displayName: 'Test',
  avatarUrl: null,
  locale: 'en',
  birthDate: '2007-03-15',
  birthTime: '12:00',
  birthTimeKnown: true,
  birthPlaceName: 'New York',
  birthPlaceLat: 40.7128,
  birthPlaceLng: -74.006,
  birthPlaceTimezone: 'America/New_York',
  onboardingCompletedAt: null,
};

const INTERPRETATION = { sections: { sun: 'You are bold.' } };

function backendResponse(): NatalChartResponse {
  return { chart: computeNatalChart(profileToChartInput(PROFILE)), interpretation: INTERPRETATION };
}

function makeDeps(overrides: Partial<NatalChartServiceDeps> = {}): NatalChartServiceDeps {
  return {
    fetchNatalChart: vi.fn(() => Promise.resolve(backendResponse())),
    syncNatalChart: vi.fn(() => Promise.resolve()),
    compute: computeNatalChart,
    cache: new OfflineChartCache(memoryStore()),
    isNetworkError,
    ...overrides,
  };
}

describe('profileToChartInput', () => {
  it('maps a complete profile to engine input', () => {
    expect(profileToChartInput(PROFILE)).toEqual({
      birthDate: '2007-03-15',
      birthTime: '12:00',
      birthTimeKnown: true,
      latitude: 40.7128,
      longitude: -74.006,
      timezone: 'America/New_York',
    });
  });

  it('flags a missing timezone (only the backend can resolve it via geo-tz)', () => {
    try {
      profileToChartInput({ ...PROFILE, birthPlaceTimezone: null });
      throw new Error('expected a throw');
    } catch (error) {
      expect(error).toBeInstanceOf(MissingBirthDataError);
      expect((error as MissingBirthDataError).missing).toEqual(['timezone']);
    }
  });

  it('flags missing coordinates', () => {
    try {
      profileToChartInput({ ...PROFILE, birthPlaceLat: null });
      throw new Error('expected a throw');
    } catch (error) {
      expect((error as MissingBirthDataError).missing).toEqual(['coordinates']);
    }
  });

  it('flags a known-but-absent birth time', () => {
    try {
      profileToChartInput({ ...PROFILE, birthTime: null });
      throw new Error('expected a throw');
    } catch (error) {
      expect((error as MissingBirthDataError).missing).toEqual(['birthTime']);
    }
  });

  it('accepts an unknown birth time', () => {
    const input = profileToChartInput({ ...PROFILE, birthTime: null, birthTimeKnown: false });
    expect(input.birthTimeKnown).toBe(false);
    expect(input.birthTime).toBeNull();
  });
});

describe('getNatalChart — online', () => {
  it('returns the backend chart with its Pro interpretation', async () => {
    const deps = makeDeps();
    const view = await getNatalChart(PROFILE, deps);

    expect(view.source).toBe('backend');
    expect(view.interpretation).toEqual(INTERPRETATION);
    expect(view.interpretationLockedOffline).toBe(false);
  });

  it('caches the backend chart as not pending sync', async () => {
    const deps = makeDeps();
    await getNatalChart(PROFILE, deps);

    expect(await deps.cache.getPending()).toBeNull();
    expect((await deps.cache.read())?.source).toBe('backend');
  });

  it('propagates a non-network error instead of falling back to offline', async () => {
    const deps = makeDeps({
      fetchNatalChart: vi.fn(() => Promise.reject(new Error('unauthorized'))),
    });

    await expect(getNatalChart(PROFILE, deps)).rejects.toThrow('unauthorized');
    // No offline chart was cached — the failure was a real rejection, not offline.
    expect(await deps.cache.read()).toBeNull();
  });
});

describe('getNatalChart — offline', () => {
  it('computes locally with no interpretation and queues it for sync', async () => {
    const deps = makeDeps({
      fetchNatalChart: vi.fn(() => Promise.reject(new NetworkError('offline'))),
    });

    const view = await getNatalChart(PROFILE, deps);

    expect(view.source).toBe('offline');
    expect(view.interpretation).toBeNull(); // AC #4: Pro reading never computed offline
    expect(view.interpretationLockedOffline).toBe(true);
    // Queued for sync (AC #3).
    expect(await deps.cache.getPending()).toEqual(view.chart);
  });

  it('produces the exact chart the backend would (AC #2: same algorithm)', async () => {
    const deps = makeDeps({
      fetchNatalChart: vi.fn(() => Promise.reject(new NetworkError('offline'))),
    });

    const view = await getNatalChart(PROFILE, deps);
    // Byte-for-byte identical to what the backend computes for the same profile.
    expect(view.chart).toEqual(computeNatalChart(profileToChartInput(PROFILE)));
    expect(view.chart.utDateTime).toBe('2007-03-15T16:00:00.000Z');
  });

  it('throws MissingBirthDataError before any network call when data is absent', async () => {
    const fetchNatalChart = vi.fn(() => Promise.resolve(backendResponse()));
    const deps = makeDeps({ fetchNatalChart });

    await expect(
      getNatalChart({ ...PROFILE, birthPlaceTimezone: null }, deps),
    ).rejects.toBeInstanceOf(MissingBirthDataError);
    expect(fetchNatalChart).not.toHaveBeenCalled();
  });
});

describe('syncPendingChart', () => {
  async function seedPending(deps: NatalChartServiceDeps): Promise<NatalChart> {
    const chart = computeNatalChart(profileToChartInput(PROFILE));
    await deps.cache.save({ chart, source: 'offline', pendingSync: true });
    return chart;
  }

  it('does nothing when there is no pending chart', async () => {
    const deps = makeDeps();
    expect(await syncPendingChart(deps)).toBe(false);
    expect(deps.syncNatalChart).not.toHaveBeenCalled();
  });

  it('pushes the pending chart and clears the flag on success', async () => {
    const deps = makeDeps();
    const chart = await seedPending(deps);

    expect(await syncPendingChart(deps)).toBe(true);
    expect(deps.syncNatalChart).toHaveBeenCalledWith(chart);
    expect(await deps.cache.getPending()).toBeNull();
  });

  it('keeps the pending flag when still offline', async () => {
    const deps = makeDeps({
      syncNatalChart: vi.fn(() => Promise.reject(new NetworkError('offline'))),
    });
    await seedPending(deps);

    expect(await syncPendingChart(deps)).toBe(false);
    expect(await deps.cache.getPending()).not.toBeNull();
  });

  it('re-throws a non-network sync error', async () => {
    const deps = makeDeps({
      syncNatalChart: vi.fn(() => Promise.reject(new Error('server exploded'))),
    });
    await seedPending(deps);

    await expect(syncPendingChart(deps)).rejects.toThrow('server exploded');
  });
});

describe('getNatalChart — reconnect flushes a queued offline chart (AC #3)', () => {
  it('syncs the pending offline chart, then serves the fresh backend chart', async () => {
    const deps = makeDeps();
    const pending = computeNatalChart(profileToChartInput(PROFILE));
    await deps.cache.save({ chart: pending, source: 'offline', pendingSync: true });

    const view = await getNatalChart(PROFILE, deps);

    expect(deps.syncNatalChart).toHaveBeenCalledWith(pending);
    expect(view.source).toBe('backend');
    expect(await deps.cache.getPending()).toBeNull();
  });
});
