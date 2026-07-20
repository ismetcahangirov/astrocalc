import type { MatrixInput } from '@astrocalc/calc-engine';
import { IncompleteMatrixProfileError } from '../auth/errors';

/**
 * The single field the Matrix reads. Both `Profile` and `Subject` structurally
 * satisfy this, which is what lets one function serve the "my own Matrix" and
 * the "a saved person's Matrix" paths — the same structural-typing trick
 * `birthChartInput.ts` and `numerologyInput.ts` use.
 *
 * Note what is absent, and how much of it there is. The chart additionally needs
 * a birth time and coordinates; numerology additionally needs the full birth
 * name. The Matrix needs neither, which is why a person the app cannot draw a
 * chart for — no birth place, no birth time — can still be shown a complete
 * Matrix. The mobile "People" list relies on exactly that (see
 * `matrixReady()` in `PeopleScreen.tsx`).
 */
export interface MatrixData {
  birthDate: string | null;
}

export type MissingMatrixField = 'birthDate';

/**
 * Map stored data to the engine's {@link MatrixInput}, or throw
 * {@link IncompleteMatrixProfileError} naming what's absent.
 *
 * There is deliberately no normalisation beyond the presence check: the engine
 * parses the date strictly (`parseIsoDate`) and rejects both malformed and
 * impossible dates, so trimming or reformatting here would only move that
 * failure somewhere with less context.
 */
export function matrixDataToInput(data: MatrixData): MatrixInput {
  if (!data.birthDate) throw new IncompleteMatrixProfileError(['birthDate']);
  return { birthDate: data.birthDate };
}
