import { authedFetch, ApiError } from './httpClient';

export { ApiError } from './httpClient';

export interface Profile {
  userId: string;
  displayName: string | null;
  /**
   * The name held as three parts (Ad / Soyad / Ata adı) — the source of truth
   * the profile form collects (#name-split). The backend composes `fullName`
   * and `displayName` from them.
   */
  firstName: string | null;
  lastName: string | null;
  patronymic: string | null;
  /**
   * The full name on the birth certificate — the sole letter input to the
   * numerology Expression/Soul Urge/Personality numbers. Composed server-side
   * from the three parts above.
   */
  fullName: string | null;
  avatarUrl: string | null;
  locale: string | null;
  birthDate: string | null;
  birthTime: string | null;
  birthTimeKnown: boolean;
  birthPlaceName: string | null;
  birthPlaceLat: number | null;
  birthPlaceLng: number | null;
  birthPlaceTimezone: string | null;
  onboardingCompletedAt: string | null;
}

/**
 * Fields the onboarding flow (#6) and profile-edit screen (#7) may update.
 * Mirrors the backend's `ProfileUpdateInput`.
 */
export interface ProfileUpdateInput {
  displayName?: string | null;
  /**
   * Name parts the form sends; the backend composes `fullName`/`displayName`
   * from them, so those need not be sent alongside.
   */
  firstName?: string | null;
  lastName?: string | null;
  patronymic?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  locale?: string | null;
  birthDate?: string | null;
  birthTime?: string | null;
  birthTimeKnown?: boolean;
  birthPlaceName?: string | null;
  birthPlaceLat?: number | null;
  birthPlaceLng?: number | null;
  birthPlaceTimezone?: string | null;
  /** Set when the onboarding flow is exited — normally or via "finish later". */
  completeOnboarding?: boolean;
}

async function parseProfileResponse(res: Response): Promise<Profile> {
  const data = (await res.json().catch(() => null)) as
    (Profile & { error?: never }) | { error: { code: string; message: string } } | null;

  if (!res.ok || !data || 'error' in data) {
    const err = data && 'error' in data ? data.error : null;
    throw new ApiError(
      err?.code ?? 'unknown_error',
      err?.message ?? 'Something went wrong. Please try again.',
    );
  }

  return data;
}

/** Fetch the signed-in user's profile — used to prefill the edit screen. */
export async function getProfile(): Promise<Profile> {
  const res = await authedFetch('/profile', { method: 'GET' });
  return parseProfileResponse(res);
}

/**
 * Persist edits from the profile screen. Changing any birth-relevant field
 * causes the backend to invalidate the cached natal chart/matrix for this
 * user (see `apps/backend/src/profile/chartCacheInvalidator.ts`).
 */
export async function updateProfile(patch: ProfileUpdateInput): Promise<Profile> {
  const res = await authedFetch('/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return parseProfileResponse(res);
}
