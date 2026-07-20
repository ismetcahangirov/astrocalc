import type { NumerologyInput } from '@astrocalc/calc-engine';
import { IncompleteNumerologyProfileError } from '../auth/errors';

/**
 * The fields numerology reads. Both `Profile` and `Subject` structurally
 * satisfy this, which is what lets one function serve the "my own numbers" and
 * the "a saved person's numbers" paths — the same structural-typing trick
 * `birthChartInput.ts` uses for birth data.
 *
 * A profile carries `fullName` (the birth name, collected for exactly this
 * purpose). A subject carries only the `name` it was created with, which is
 * treated as that person's birth name — a subject is created *to* be read for,
 * so the name given is the name meant.
 */
export interface NumerologyData {
  fullName?: string | null;
  name?: string | null;
  birthDate: string | null;
}

export type MissingNumerologyField = 'fullName' | 'birthDate';

/**
 * Map stored data to the engine's {@link NumerologyInput}, or throw
 * {@link IncompleteNumerologyProfileError} listing exactly what's absent.
 *
 * Note the fallback chain is `fullName ?? name` and stops there — there is
 * deliberately NO `displayName` fallback. `displayName` is a nickname or a
 * Google-supplied display string ("Ada", "ada.l"), and every name-derived
 * number (expression, soul urge, personality) is a letter-by-letter sum of
 * whatever string it is handed. Falling back to it would not fail loudly; it
 * would return a complete, confident, *wrong* profile that no one could tell
 * from a right one. Refusing to compute is the only safe behaviour.
 */
export function numerologyDataToInput(
  data: NumerologyData,
  referenceDate: string,
): NumerologyInput {
  const name = data.fullName ?? data.name ?? null;
  // A name that is only whitespace has no scoreable letters — the engine would
  // throw `invalid_input`; report it as missing data instead, like any absent field.
  const hasName = name !== null && name.trim().length > 0;

  const missing: MissingNumerologyField[] = [];
  if (!hasName) missing.push('fullName');
  if (!data.birthDate) missing.push('birthDate');

  if (missing.length > 0) throw new IncompleteNumerologyProfileError(missing);

  return {
    fullName: name!.trim(),
    birthDate: data.birthDate!,
    referenceDate,
  };
}
