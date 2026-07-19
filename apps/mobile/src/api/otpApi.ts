import { config } from '../config';
import { ApiError } from './authApi';

export { ApiError } from './authApi';

export interface OtpUser {
  id: string;
  phone: string;
}

export interface OtpRequestResponse {
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
}

export interface OtpVerifyResponse {
  user: OtpUser;
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
}

interface OtpErrorBody {
  code: string;
  message: string;
  retryAfterSeconds?: number;
  attemptsRemaining?: number;
  alternative?: 'google';
}

/**
 * Carries the extra client-facing fields the backend merges into OTP error
 * bodies (see `apps/backend/src/otp/errors.ts`) — cooldown/lockout countdowns,
 * remaining verification attempts, and the Google fallback signal for a
 * WhatsApp quota exhaustion.
 */
export class OtpApiError extends ApiError {
  constructor(
    code: string,
    message: string,
    public readonly retryAfterSeconds?: number,
    public readonly attemptsRemaining?: number,
    public readonly alternative?: 'google',
  ) {
    super(code, message);
    this.name = 'OtpApiError';
  }
}

async function post<T>(path: string, body: unknown, fallbackMessage: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.apiBaseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('network_error', 'Could not reach the server. Check your connection.');
  }

  const data = (await res.json().catch(() => null)) as
    (T & { error?: never }) | { error: OtpErrorBody } | null;

  if (!res.ok || !data || 'error' in data) {
    const err = data && 'error' in data ? data.error : null;
    throw new OtpApiError(
      err?.code ?? 'unknown_error',
      err?.message ?? fallbackMessage,
      err?.retryAfterSeconds,
      err?.attemptsRemaining,
      err?.alternative,
    );
  }

  return data;
}

/** Request a WhatsApp OTP code for `phone` (E.164). See `apps/backend/src/otp/otpRoute.ts`. */
export function requestOtp(phone: string): Promise<OtpRequestResponse> {
  return post<OtpRequestResponse>(
    '/otp/request',
    { phone },
    'Could not send a verification code. Please try again.',
  );
}

/** Verify a previously requested code and open a session (find-or-create by phone). */
export function verifyOtp(phone: string, code: string): Promise<OtpVerifyResponse> {
  return post<OtpVerifyResponse>(
    '/otp/verify',
    { phone, code },
    'Verification failed. Please try again.',
  );
}
