import { describe, expect, it, vi } from 'vitest';
import type { DestinyMatrix, MatrixInput } from '@astrocalc/calc-engine';
import type { MatrixResponse } from '../api/matrixApi';
import { getMatrix, MissingMatrixDataError, type MatrixServiceDeps } from './matrixService';

/** A stand-in Matrix — this suite is about orchestration, never about arcana values. */
const BACKEND_MATRIX = { schemaVersion: 1, centre: 7 } as unknown as DestinyMatrix;
const OFFLINE_MATRIX = { schemaVersion: 1, centre: 7 } as unknown as DestinyMatrix;

class FakeNetworkError extends Error {}

function deps(overrides: Partial<MatrixServiceDeps> = {}): MatrixServiceDeps {
  return {
    fetchMatrix: vi.fn(async (): Promise<MatrixResponse> => ({
      matrix: BACKEND_MATRIX,
      interpretation: null,
    })),
    compute: vi.fn((_input: MatrixInput) => OFFLINE_MATRIX),
    isNetworkError: (error: unknown) => error instanceof FakeNetworkError,
    ...overrides,
  };
}

const PROFILE = { birthDate: '1990-05-12' };

describe('getMatrix', () => {
  it('prefers the backend and tags the result as authoritative', async () => {
    const d = deps();
    const view = await getMatrix(PROFILE, d);

    expect(view).toEqual({ matrix: BACKEND_MATRIX, source: 'backend' });
    expect(d.compute).not.toHaveBeenCalled();
  });

  it('falls back to on-device computation when the device is offline', async () => {
    const d = deps({
      fetchMatrix: vi.fn(async () => {
        throw new FakeNetworkError('offline');
      }),
    });

    const view = await getMatrix(PROFILE, d);

    expect(view).toEqual({ matrix: OFFLINE_MATRIX, source: 'offline' });
    expect(d.compute).toHaveBeenCalledWith({ birthDate: '1990-05-12' });
  });

  it('propagates a non-network backend error instead of silently computing', async () => {
    // The offline path exists for lost connectivity, not for a server that
    // actively rejected the request — masking a 401 as a locally-computed
    // Matrix would hide an expired session behind a screen that looks fine.
    const authError = new Error('unauthorized');
    const d = deps({
      fetchMatrix: vi.fn(async () => {
        throw authError;
      }),
    });

    await expect(getMatrix(PROFILE, d)).rejects.toBe(authError);
    expect(d.compute).not.toHaveBeenCalled();
  });

  it('throws MissingMatrixDataError before any network call when the birth date is absent', async () => {
    const d = deps();

    await expect(getMatrix({ birthDate: null }, d)).rejects.toBeInstanceOf(MissingMatrixDataError);
    // Validated up front so an incomplete profile fails identically online and
    // offline, rather than reaching the backend online and the engine offline.
    expect(d.fetchMatrix).not.toHaveBeenCalled();
    expect(d.compute).not.toHaveBeenCalled();
  });

  it('names the missing field so the UI can point at it', async () => {
    try {
      await getMatrix({ birthDate: null }, deps());
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MissingMatrixDataError);
      expect((err as MissingMatrixDataError).missing).toEqual(['birthDate']);
    }
  });
});
