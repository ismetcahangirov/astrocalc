import type { NatalChartInput } from '@astrocalc/calc-engine';
import { IncompleteProfileError } from '../auth/errors';

/**
 * The birth-data subset both a user's own profile and a saved subject carry —
 * everything `computeNatalChart` needs. Extracted so the profile chart service
 * (#19) and the subjects chart service (#s2) map to the engine's input the same
 * way and refuse to compute for the same reasons.
 */
export interface BirthData {
  birthDate: string | null;
  birthTime: string | null;
  birthTimeKnown: boolean;
  birthPlaceLat: number | null;
  birthPlaceLng: number | null;
  birthPlaceTimezone: string | null;
}

export type MissingBirthField =
  'birthDate' | 'birthPlaceLat' | 'birthPlaceLng' | 'birthPlaceTimezone' | 'birthTime';

/**
 * Map stored birth data to the engine's {@link NatalChartInput}, or throw
 * {@link IncompleteProfileError} listing exactly what's absent. Mirrors the
 * mobile app's `profileToChartInput` so both sides refuse to compute for the
 * same reason.
 */
export function birthDataToChartInput(data: BirthData): NatalChartInput {
  const missing: MissingBirthField[] = [];
  if (!data.birthDate) missing.push('birthDate');
  if (data.birthPlaceLat == null) missing.push('birthPlaceLat');
  if (data.birthPlaceLng == null) missing.push('birthPlaceLng');
  if (!data.birthPlaceTimezone) missing.push('birthPlaceTimezone');
  if (data.birthTimeKnown && !data.birthTime) missing.push('birthTime');

  if (missing.length > 0) throw new IncompleteProfileError(missing);

  return {
    birthDate: data.birthDate!,
    birthTime: data.birthTime,
    birthTimeKnown: data.birthTimeKnown,
    latitude: data.birthPlaceLat!,
    longitude: data.birthPlaceLng!,
    timezone: data.birthPlaceTimezone!,
  };
}
