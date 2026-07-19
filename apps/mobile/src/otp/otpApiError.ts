import { ApiError } from '../api/apiError';

/**
 * Carries the extra client-facing fields the backend merges into OTP error
 * bodies (see `apps/backend/src/otp/errors.ts`) — cooldown/lockout countdowns,
 * remaining verification attempts, and the Google fallback signal for a
 * WhatsApp quota exhaustion. Kept dependency-free (like `apiError.ts`) so
 * `otp/errorMessages.ts` can check error codes without dragging in `config.ts`.
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
