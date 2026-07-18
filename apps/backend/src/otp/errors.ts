import { AuthError } from '../auth/errors';

/**
 * OTP / WhatsApp-specific auth errors. Each extends {@link AuthError} so the
 * shared `errorHandler` serializes it to `{ error: { code, message, ...details } }`.
 * The extra `details` are what let the mobile client show a live countdown or
 * fall back to Google sign-in.
 */

/** Resend attempted while the cooldown window is still open. */
export class OtpCooldownError extends AuthError {
  constructor(public readonly retryAfterSeconds: number) {
    super(
      'otp_cooldown',
      `Please wait ${retryAfterSeconds}s before requesting another code.`,
      429,
      {
        retryAfterSeconds,
      },
    );
    this.name = 'OtpCooldownError';
  }
}

/** No outstanding OTP challenge for this phone (never requested, or already used). */
export class OtpNotFoundError extends AuthError {
  constructor(message = 'No verification code was requested for this number.') {
    super('otp_not_found', message, 400);
    this.name = 'OtpNotFoundError';
  }
}

/** The code exists but its 5-minute TTL has elapsed. */
export class OtpExpiredError extends AuthError {
  constructor(message = 'This code has expired. Request a new one.') {
    super('otp_expired', message, 400);
    this.name = 'OtpExpiredError';
  }
}

/** Wrong code; carries how many attempts remain before lockout. */
export class OtpInvalidCodeError extends AuthError {
  constructor(public readonly attemptsRemaining: number) {
    super('otp_invalid_code', 'That code is incorrect.', 401, { attemptsRemaining });
    this.name = 'OtpInvalidCodeError';
  }
}

/** Too many wrong attempts — the challenge is discarded and must be re-requested. */
export class OtpMaxAttemptsError extends AuthError {
  constructor(message = 'Too many incorrect attempts. Request a new code.') {
    super('otp_max_attempts', message, 429);
    this.name = 'OtpMaxAttemptsError';
  }
}

/**
 * Raised for both `requestOtp` and `verifyOtp` once too many wrong codes have
 * tripped the temporary lockout (see {@link OtpMaxAttemptsError}). The number
 * is locked out of OTP login entirely — no new code can be requested or
 * verified — until `retryAfterSeconds` elapses.
 */
export class OtpAccountLockedError extends AuthError {
  constructor(public readonly retryAfterSeconds: number) {
    super(
      'otp_account_locked',
      `Too many failed attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
      429,
      { retryAfterSeconds },
    );
    this.name = 'OtpAccountLockedError';
  }
}

/** Per-phone-number hourly cap on OTP requests exceeded (independent of the short resend cooldown). */
export class OtpPhoneRateLimitError extends AuthError {
  constructor(public readonly retryAfterSeconds: number) {
    super(
      'otp_rate_limited',
      'Too many codes requested for this number. Please try again later.',
      429,
      {
        retryAfterSeconds,
      },
    );
    this.name = 'OtpPhoneRateLimitError';
  }
}

/** Per-IP hourly cap on OTP requests exceeded — likely SMS/WhatsApp-bombing or scripted abuse. */
export class OtpIpRateLimitError extends AuthError {
  constructor(public readonly retryAfterSeconds: number) {
    super(
      'otp_ip_rate_limited',
      'Too many verification codes requested. Please try again later.',
      429,
      {
        retryAfterSeconds,
      },
    );
    this.name = 'OtpIpRateLimitError';
  }
}

/**
 * The Meta conversation quota is exhausted. `alternative` tells the client which
 * login method to offer instead (Google), per the acceptance criteria.
 */
export class WhatsAppQuotaExceededError extends AuthError {
  public readonly alternative = 'google' as const;
  constructor(
    message = 'WhatsApp verification is temporarily unavailable. Please continue with Google.',
  ) {
    super('whatsapp_quota_exceeded', message, 503, { alternative: 'google', channel: 'whatsapp' });
    this.name = 'WhatsAppQuotaExceededError';
  }
}

/** Meta Cloud API failed for a non-quota reason (network, bad template, auth). */
export class WhatsAppSendError extends AuthError {
  constructor(message = 'Could not send the WhatsApp verification code. Please try again.') {
    super('whatsapp_send_failed', message, 502);
    this.name = 'WhatsAppSendError';
  }
}
