import { describe, expect, it } from 'vitest';
import { localizeOtpError } from './errorMessages';
import { ApiError } from '../api/apiError';
import { OtpApiError } from './otpApiError';
import { translations, type TranslationKey } from '../i18n/translations';

const t = (key: TranslationKey) => translations.en[key];

describe('localizeOtpError', () => {
  it('falls back to a generic localized message for a non-ApiError', () => {
    expect(localizeOtpError(new Error('boom'), t)).toBe(t('otp.error.generic'));
  });

  it('falls back to a generic localized message for an unmapped code', () => {
    expect(localizeOtpError(new ApiError('something_new', 'x'), t)).toBe(t('otp.error.generic'));
  });

  it('maps otp_not_found / otp_expired / otp_invalid_code / otp_max_attempts / whatsapp errors 1:1', () => {
    expect(localizeOtpError(new ApiError('otp_not_found', 'x'), t)).toBe(t('otp.error.notFound'));
    expect(localizeOtpError(new ApiError('otp_expired', 'x'), t)).toBe(t('otp.error.expired'));
    expect(localizeOtpError(new ApiError('otp_invalid_code', 'x'), t)).toBe(
      t('otp.error.invalidCode'),
    );
    expect(localizeOtpError(new ApiError('otp_max_attempts', 'x'), t)).toBe(
      t('otp.error.maxAttempts'),
    );
    expect(localizeOtpError(new ApiError('whatsapp_quota_exceeded', 'x'), t)).toBe(
      t('otp.error.quotaExceeded'),
    );
    expect(localizeOtpError(new ApiError('whatsapp_send_failed', 'x'), t)).toBe(
      t('otp.error.sendFailed'),
    );
    expect(localizeOtpError(new ApiError('network_error', 'x'), t)).toBe(t('otp.error.network'));
  });

  it('appends a formatted countdown for cooldown/lockout/rate-limit errors', () => {
    const err = new OtpApiError('otp_cooldown', 'x', 65);
    expect(localizeOtpError(err, t)).toBe(`${t('otp.error.cooldown')} 1:05`);
  });

  it('appends a formatted countdown for account-locked errors', () => {
    const err = new OtpApiError('otp_account_locked', 'x', 900);
    expect(localizeOtpError(err, t)).toBe(`${t('otp.error.accountLocked')} 15:00`);
  });

  it('appends a formatted countdown for phone and IP rate-limit errors', () => {
    const phoneErr = new OtpApiError('otp_rate_limited', 'x', 3600);
    const ipErr = new OtpApiError('otp_ip_rate_limited', 'x', 3600);
    expect(localizeOtpError(phoneErr, t)).toBe(`${t('otp.error.rateLimited')} 60:00`);
    expect(localizeOtpError(ipErr, t)).toBe(`${t('otp.error.rateLimited')} 60:00`);
  });

  it('omits the countdown suffix when retryAfterSeconds is absent', () => {
    const err = new OtpApiError('otp_cooldown', 'x');
    expect(localizeOtpError(err, t)).toBe(t('otp.error.cooldown'));
  });
});
