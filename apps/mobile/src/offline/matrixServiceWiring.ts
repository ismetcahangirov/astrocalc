import { computeDestinyMatrix } from '@astrocalc/calc-engine';
import { fetchMatrix } from '../api/matrixApi';
import { isNetworkError } from '../api/httpClient';
import { getMatrix, type MatrixServiceDeps, type MatrixView } from './matrixService';

/**
 * Concrete wiring for the Matrix service: the real backend API client and the
 * shared `@astrocalc/calc-engine` compute. Kept separate from
 * `matrixService.ts` so that module stays free of React Native / Expo imports
 * and can be unit-tested under plain Node.
 */

/** Build the production {@link MatrixServiceDeps}. */
export function defaultDeps(): MatrixServiceDeps {
  return {
    fetchMatrix,
    compute: computeDestinyMatrix,
    isNetworkError,
  };
}

/** App-facing entry point: get the Matrix (backend or offline) with real deps. */
export function loadMatrix(profile: { birthDate: string | null }): Promise<MatrixView> {
  return getMatrix(profile, defaultDeps());
}
