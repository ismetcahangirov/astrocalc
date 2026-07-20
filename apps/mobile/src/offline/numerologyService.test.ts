import { describe, expect, it, vi } from 'vitest';
import { computeNumerologyProfile, type NumerologyProfile } from '@astrocalc/calc-engine';
import type { NumerologyResponse } from '../api/numerologyApi';
import {
  getNumerology,
  localToday,
  MissingNumerologyDataError,
  type NumerologyServiceDeps,
} from './numerologyService';

/** Simulated loss of connectivity — the only error the offline fallback reacts to. */
class NetworkError extends Error {}
const isNetworkError = (error: unknown): boolean => error instanceof NetworkError;

/** A profile with everything numerology needs: a full birth name and a birth date. */
const PROFILE = { fullName: 'Ada Lovelace', birthDate: '1815-12-10' };
const REFERENCE_DATE = '2026-07-20';

function expectedProfile(): NumerologyProfile {
  return computeNumerologyProfile({ ...PROFILE, referenceDate: REFERENCE_DATE });
}

/**
 * The backend's answer, deliberately *not* equal to the local computation — a
 * sentinel `schemaVersion` proves the online path returned the server's profile
 * rather than silently recomputing it.
 */
function backendResponse(): NumerologyResponse {
  return { profile: { ...expectedProfile(), schemaVersion: 99 }, interpretation: null };
}

function makeDeps(overrides: Partial<NumerologyServiceDeps> = {}): NumerologyServiceDeps {
  return {
    fetchNumerology: vi.fn(() => Promise.resolve(backendResponse())),
    compute: computeNumerologyProfile,
    isNetworkError,
    ...overrides,
  };
}

describe('getNumerology — online', () => {
  it('returns the backend profile tagged as such', async () => {
    const deps = makeDeps();
    const view = await getNumerology(PROFILE, REFERENCE_DATE, deps);

    expect(view.source).toBe('backend');
    expect(view.profile.schemaVersion).toBe(99);
  });

  it('passes the caller-supplied reference date through to the backend', async () => {
    const deps = makeDeps();
    await getNumerology(PROFILE, REFERENCE_DATE, deps);

    expect(deps.fetchNumerology).toHaveBeenCalledWith(REFERENCE_DATE);
  });

  it('propagates a non-network error instead of falling back to offline', async () => {
    const compute = vi.fn(computeNumerologyProfile);
    const deps = makeDeps({
      fetchNumerology: vi.fn(() => Promise.reject(new Error('unauthorized'))),
      compute,
    });

    await expect(getNumerology(PROFILE, REFERENCE_DATE, deps)).rejects.toThrow('unauthorized');
    expect(compute).not.toHaveBeenCalled();
  });
});

describe('getNumerology — offline', () => {
  it('computes locally when the device is offline', async () => {
    const deps = makeDeps({
      fetchNumerology: vi.fn(() => Promise.reject(new NetworkError('offline'))),
    });

    const view = await getNumerology(PROFILE, REFERENCE_DATE, deps);

    expect(view.source).toBe('offline');
    // The same algorithm the backend runs, for the same reference date.
    expect(view.profile).toEqual(expectedProfile());
  });
});

describe('getNumerology — incomplete profile', () => {
  it('throws before any network call when the full name is missing', async () => {
    const fetchNumerology = vi.fn(() => Promise.resolve(backendResponse()));
    const deps = makeDeps({ fetchNumerology });

    await expect(
      getNumerology({ ...PROFILE, fullName: null }, REFERENCE_DATE, deps),
    ).rejects.toBeInstanceOf(MissingNumerologyDataError);
    expect(fetchNumerology).not.toHaveBeenCalled();
  });

  it('throws before any network call when the birth date is missing', async () => {
    const fetchNumerology = vi.fn(() => Promise.resolve(backendResponse()));
    const deps = makeDeps({ fetchNumerology });

    await expect(
      getNumerology({ ...PROFILE, birthDate: null }, REFERENCE_DATE, deps),
    ).rejects.toBeInstanceOf(MissingNumerologyDataError);
    expect(fetchNumerology).not.toHaveBeenCalled();
  });

  it('names exactly what is missing', async () => {
    const deps = makeDeps();

    await expect(
      getNumerology({ ...PROFILE, fullName: null }, REFERENCE_DATE, deps),
    ).rejects.toMatchObject({ missing: ['fullName'] });
    await expect(
      getNumerology({ ...PROFILE, birthDate: null }, REFERENCE_DATE, deps),
    ).rejects.toMatchObject({ missing: ['birthDate'] });
    await expect(
      getNumerology({ fullName: '   ', birthDate: null }, REFERENCE_DATE, deps),
    ).rejects.toMatchObject({ missing: ['fullName', 'birthDate'] });
  });
});

describe('localToday', () => {
  it('formats a date as zero-padded YYYY-MM-DD', () => {
    // Local-time constructor: month is 0-based, so this is 3 March 2026.
    expect(localToday(new Date(2026, 2, 3, 12, 0, 0))).toBe('2026-03-03');
    expect(localToday(new Date(2026, 11, 31, 23, 59, 0))).toBe('2026-12-31');
  });

  it('uses the local calendar day, not the UTC one', () => {
    // 00:30 local. In any timezone east of UTC this instant is still "yesterday"
    // in UTC, so toISOString() would hand back the wrong date.
    const justAfterMidnight = new Date(2026, 6, 20, 0, 30, 0);
    expect(localToday(justAfterMidnight)).toBe('2026-07-20');
    expect(localToday(justAfterMidnight)).toBe(
      `${justAfterMidnight.getFullYear()}-${String(justAfterMidnight.getMonth() + 1).padStart(2, '0')}-${String(justAfterMidnight.getDate()).padStart(2, '0')}`,
    );
  });

  it('defaults to now and is a well-formed date', () => {
    expect(localToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const now = new Date();
    expect(localToday()).toBe(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    );
  });
});
