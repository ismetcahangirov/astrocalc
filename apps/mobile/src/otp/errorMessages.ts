import { ApiError } from '../api/apiError';
import { OtpApiError } from './otpApiError';
import type { TranslationKey } from '../i18n/translations';
import { formatCountdown } from './validation';

/**
 * Maps a thrown error from the OTP flow to a localized, user-facing message
 * (#10's own acceptance criterion: "a clear, friendly error message
 * (localized) is shown when a limit is hit"). Before this, `useOtpAuth`
 * surfaced the backend's raw English `AuthError.message` directly, so the
 * abuse-protection copy (cooldown/lockout/rate-limit) never respected the
 * app's selected language — only client-side validation strings did.
 *
 * Countdown-bearing errors (cooldown, lockout, rate limit) get the localized
 * label plus a formatted `m:ss`, matching how the rest of this screen already
 * displays countdowns (see `otp.code.resendIn`/`expiresIn`) rather than
 * building a templated sentence.
 */
export function localizeOtpError(err: unknown, t: (key: TranslationKey) => string): string {
  if (!(err instanceof ApiError)) return t('otp.error.generic');

  const retryAfterSeconds = err instanceof OtpApiError ? err.retryAfterSeconds : undefined;
  const countdown = retryAfterSeconds != null ? formatCountdown(retryAfterSeconds) : null;
  const withCountdown = (key: TranslationKey) => (countdown ? `${t(key)} ${countdown}` : t(key));

  switch (err.code) {
    case 'otp_cooldown':
      return withCountdown('otp.error.cooldown');
    case 'otp_account_locked':
      return withCountdown('otp.error.accountLocked');
    case 'otp_rate_limited':
    case 'otp_ip_rate_limited':
      return withCountdown('otp.error.rateLimited');
    case 'otp_not_found':
      return t('otp.error.notFound');
    case 'otp_expired':
      return t('otp.error.expired');
    case 'otp_invalid_code':
      return t('otp.error.invalidCode');
    case 'otp_max_attempts':
      return t('otp.error.maxAttempts');
    case 'whatsapp_quota_exceeded':
      return t('otp.error.quotaExceeded');
    case 'whatsapp_send_failed':
      return t('otp.error.sendFailed');
    case 'network_error':
      return t('otp.error.network');
    default:
      return t('otp.error.generic');
  }
}
