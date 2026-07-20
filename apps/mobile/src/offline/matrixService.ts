import type { DestinyMatrix, MatrixInput } from '@astrocalc/calc-engine';
import type { MatrixResponse } from '../api/matrixApi';

/**
 * Online/offline Matrix of Destiny orchestration.
 *
 * This module is intentionally free of any React Native / Expo import (every
 * import above is type-only, and therefore erased at build time) so its logic
 * runs under plain-Node Vitest. The native wiring — the real API client and the
 * engine — lives in `./matrixServiceWiring.ts`.
 *
 * Same rule as the natal chart and numerology: the backend is authoritative,
 * and when it can't be reached the identical `@astrocalc/calc-engine` algorithm
 * runs on-device, so the arcana are the same either way.
 *
 * **Deliberately no offline cache and no pending-sync step.** Numerology skips
 * the cache because caching it would be actively *wrong* — its cycle numbers
 * turn over at midnight, so a stored profile is stale the next morning. The
 * Matrix skips it for the opposite reason: it is a pure function of the birth
 * date, so a cached copy could never go stale, and could never differ from
 * recomputing either. Reducing a few dozen digits costs nothing, and the birth
 * date is already on the device. A cache here would add a persistence layer,
 * its invalidation, and its failure modes in exchange for nothing measurable.
 * (The natal chart genuinely needs one: its IANA timezone is server-derived via
 * `geo-tz`, which cannot run on-device.)
 *
 * All I/O is injected via {@link MatrixServiceDeps} so the logic is pure and
 * unit-testable; `defaultDeps()` in the wiring module supplies the real ones.
 */

/** The profile field the Matrix can't be computed without. */
export type MissingMatrixField = 'birthDate';

/**
 * Thrown when a profile lacks the birth date the Matrix needs. Always the
 * user's to fix — it is entered by hand — so the UI should send them to their
 * profile rather than suggesting they reconnect.
 */
export class MissingMatrixDataError extends Error {
  constructor(public readonly missing: MissingMatrixField[]) {
    super(`Missing data for the Matrix: ${missing.join(', ')}`);
    this.name = 'MissingMatrixDataError';
  }
}

/** A Matrix ready for the UI, tagged with where it came from. */
export interface MatrixView {
  matrix: DestinyMatrix;
  /** `'backend'` (authoritative, online) or `'offline'` (computed on-device). */
  source: 'backend' | 'offline';
}

/** Injectable I/O for {@link getMatrix}. */
export interface MatrixServiceDeps {
  fetchMatrix: () => Promise<MatrixResponse>;
  compute: (input: MatrixInput) => DestinyMatrix;
  isNetworkError: (error: unknown) => boolean;
}

/**
 * Map a stored profile to the engine's {@link MatrixInput}, or throw
 * {@link MissingMatrixDataError}.
 */
function toMatrixInput(profile: { birthDate: string | null }): MatrixInput {
  if (!profile.birthDate) throw new MissingMatrixDataError(['birthDate']);
  return { birthDate: profile.birthDate };
}

/**
 * Get the user's Matrix, preferring the backend and falling back to on-device
 * computation when offline.
 *
 * Any non-network backend error (e.g. auth) propagates: the offline fallback is
 * for lost connectivity, not for real server rejections.
 *
 * @throws {MissingMatrixDataError} when the birth date is absent. Validated up
 *   front, before any network call, so an incomplete profile fails the same way
 *   online or offline.
 */
export async function getMatrix(
  profile: { birthDate: string | null },
  deps: MatrixServiceDeps,
): Promise<MatrixView> {
  const input = toMatrixInput(profile);

  try {
    const response = await deps.fetchMatrix();
    return { matrix: response.matrix, source: 'backend' };
  } catch (error) {
    if (!deps.isNetworkError(error)) throw error;

    // Offline: same algorithm, same input, same arcana.
    return { matrix: deps.compute(input), source: 'offline' };
  }
}
