import type { UserRepository } from '../auth/repository';
import type { TokenService } from '../auth/tokens';
import type { SignInResult } from '../auth/types';
import type { RateLimiter } from '../security/rateLimiter';
import { generateOtpCode, hashOtpCode, verifyOtpHash } from './codeGenerator';
import { maskPhone, normalizePhone } from './phone';
import type { OtpStore } from './otpStore';
import type { WhatsAppSender } from './whatsappSender';
import type { AdminAlerter } from './adminAlerter';
import {
  OtpAccountLockedError,
  OtpCooldownError,
  OtpExpiredError,
  OtpInvalidCodeError,
  OtpMaxAttemptsError,
  OtpNotFoundError,
  OtpPhoneRateLimitError,
  WhatsAppQuotaExceededError,
} from './errors';

export interface OtpServiceConfig {
  /** How long a code stays valid (e.g. 300 = 5 minutes). */
  ttlSeconds: number;
  /** Minimum gap between resends (e.g. 60). */
  resendCooldownSeconds: number;
  /** Wrong attempts allowed before the code is discarded (e.g. 5). */
  maxAttempts: number;
  /** Number of digits in a code (e.g. 6). */
  codeLength: number;
  /** How long a phone is locked out of requests/verification after tripping `maxAttempts` (e.g. 900 = 15 minutes). */
  lockoutSeconds: number;
}

export interface OtpServiceDeps {
  store: OtpStore;
  sender: WhatsAppSender;
  repo: UserRepository;
  tokenService: TokenService;
  alerter: AdminAlerter;
  /** Caps OTP requests per phone number (e.g. 3/hour) — independent of the short resend cooldown. */
  phoneRequestLimiter: RateLimiter;
  /** Secret used to HMAC the code before storage. */
  hashSecret: string;
  config: OtpServiceConfig;
  /** Injectable clock (epoch ms) — defaults to `Date.now`. */
  now?: () => number;
}

export interface RequestOtpResult {
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
}

export interface OtpService {
  requestOtp(rawPhone: string): Promise<RequestOtpResult>;
  verifyOtp(rawPhone: string, code: string): Promise<SignInResult>;
}

/**
 * Phone-number login over WhatsApp OTP:
 *   requestOtp → cooldown check → generate + send code → persist hash (TTL)
 *   verifyOtp  → check TTL, code (constant-time) and attempt count → open a
 *                session and issue tokens (find-or-create the phone user)
 *
 * Codes are HMAC-hashed before storage and never logged in plaintext. A quota
 * exhaustion from Meta alerts the admin panel and is surfaced to the client with
 * a Google fallback.
 */
export function createOtpService(deps: OtpServiceDeps): OtpService {
  const { store, sender, repo, tokenService, alerter, phoneRequestLimiter, hashSecret, config } = deps;
  const now = deps.now ?? Date.now;

  return {
    async requestOtp(rawPhone: string): Promise<RequestOtpResult> {
      const phone = normalizePhone(rawPhone);

      const lockSeconds = await store.getLockSeconds(phone);
      if (lockSeconds > 0) throw new OtpAccountLockedError(lockSeconds);

      const cooldown = await store.getCooldownSeconds(phone);
      if (cooldown > 0) throw new OtpCooldownError(cooldown);

      const rate = await phoneRequestLimiter.limit(phone);
      if (!rate.success) {
        await alerter.anomalousActivity({
          kind: 'otp_phone_rate_limited',
          identifier: maskPhone(phone),
          at: new Date(now()),
        });
        throw new OtpPhoneRateLimitError(rate.retryAfterSeconds);
      }

      const code = generateOtpCode(config.codeLength);

      // Send first: a failed send must not consume the cooldown or leave a
      // dangling challenge, so the user can retry immediately.
      try {
        await sender.sendOtp({ to: phone, code });
      } catch (err) {
        if (err instanceof WhatsAppQuotaExceededError) {
          await alerter.quotaExhausted({ channel: 'whatsapp', at: new Date(now()), detail: err.message });
        }
        throw err;
      }

      const expiresAt = now() + config.ttlSeconds * 1000;
      await store.saveChallenge(
        phone,
        { codeHash: hashOtpCode(hashSecret, phone, code), expiresAt },
        config.ttlSeconds,
      );
      await store.startCooldown(phone, config.resendCooldownSeconds);

      return {
        expiresInSeconds: config.ttlSeconds,
        resendAvailableInSeconds: config.resendCooldownSeconds,
      };
    },

    async verifyOtp(rawPhone: string, code: string): Promise<SignInResult> {
      const phone = normalizePhone(rawPhone);

      const lockSeconds = await store.getLockSeconds(phone);
      if (lockSeconds > 0) throw new OtpAccountLockedError(lockSeconds);

      const challenge = await store.getChallenge(phone);
      if (!challenge) throw new OtpNotFoundError();

      if (now() >= challenge.expiresAt) {
        await store.deleteChallenge(phone);
        throw new OtpExpiredError();
      }

      if (!verifyOtpHash(hashSecret, phone, code, challenge.codeHash)) {
        const attempts = await store.incrementAttempts(phone, config.ttlSeconds);
        if (attempts >= config.maxAttempts) {
          await store.deleteChallenge(phone);
          await store.lock(phone, config.lockoutSeconds);
          await alerter.anomalousActivity({
            kind: 'otp_account_locked',
            identifier: maskPhone(phone),
            at: new Date(now()),
            detail: `${attempts} failed verification attempts`,
          });
          throw new OtpMaxAttemptsError();
        }
        throw new OtpInvalidCodeError(config.maxAttempts - attempts);
      }

      // Single-use: consume the code before issuing a session.
      await store.deleteChallenge(phone);

      let isNewUser = false;
      let user = await repo.findByPhone(phone);
      if (!user) {
        user = await repo.createUserWithPhone({ phone });
        isNewUser = true;
      }

      const session = await repo.createSession(user.id);
      const { accessToken, refreshToken } = tokenService.issueTokens(user.id, session.id);

      return { user, accessToken, refreshToken, isNewUser };
    },
  };
}
