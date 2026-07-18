import { config } from '../config';
import { getAccessToken } from '../auth/tokenStorage';
import { ApiError } from './authApi';

export { ApiError } from './authApi';

export interface Profile {
  userId: string;
  displayName: string | null;
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

/** Fields the profile-edit screen (#7) may update. Mirrors the backend's `ProfileUpdateInput`. */
export interface ProfileUpdateInput {
  displayName?: string | null;
  avatarUrl?: string | null;
  locale?: string | null;
  birthDate?: string | null;
  birthTime?: string | null;
  birthTimeKnown?: boolean;
  birthPlaceName?: string | null;
  birthPlaceLat?: number | null;
  birthPlaceLng?: number | null;
  birthPlaceTimezone?: string | null;
}

async function authedFetch(path: string, init: RequestInit): Promise<Response> {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new ApiError('unauthorized', 'You need to sign in again.');

  try {
    return await fetch(`${config.apiBaseUrl}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new ApiError('network_error', 'Could not reach the server. Check your connection.');
  }
}

async function parseProfileResponse(res: Response): Promise<Profile> {
  const data = (await res.json().catch(() => null)) as
    | (Profile & { error?: never })
    | { error: { code: string; message: string } }
    | null;

  if (!res.ok || !data || 'error' in data) {
    const err = data && 'error' in data ? data.error : null;
    throw new ApiError(err?.code ?? 'unknown_error', err?.message ?? 'Something went wrong. Please try again.');
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
