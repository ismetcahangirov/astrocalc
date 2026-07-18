import { describe, expect, it, beforeEach } from 'vitest';
import { createOtpService, type OtpServiceConfig } from './otpService';
import { InMemoryOtpStore } from './otpStore';
import { FakeWhatsAppSender } from './whatsappSender';
import { InMemoryUserRepository } from '../auth/repository';
import { createTokenService } from '../auth/tokens';
import { RecordingAdminAlerter } from './adminAlerter';
import { InMemoryRateLimiter } from '../security/rateLimiter';
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
import { InvalidRequestError } from '../auth/errors';

const HASH_SECRET = 'test-otp-hash-secret';
const CONFIG: OtpServiceConfig = {
  ttlSeconds: 300,
  resendCooldownSeconds: 60,
  maxAttempts: 5,
  codeLength: 6,
  lockoutSeconds: 900,
};

const tokenService = createTokenService({
  accessSecret: 'a-secret',
  refreshSecret: 'r-secret',
  accessTtl: '15m',
  refreshTtl: '30d',
});

function build() {
  const clock = { t: 1_700_000_000_000 };
  const now = () => clock.t;
  const store = new InMemoryOtpStore(now);
  const sender = new FakeWhatsAppSender();
  const repo = new InMemoryUserRepository();
  const alerter = new RecordingAdminAlerter();
  const phoneRequestLimiter = new InMemoryRateLimiter({ limit: 1000, windowSeconds: 3600, now });
  const service = createOtpService({
    store,
    sender,
    repo,
    tokenService,
    alerter,
    phoneRequestLimiter,
    hashSecret: HASH_SECRET,
    config: CONFIG,
    now,
  });
  return { clock, store, sender, repo, alerter, phoneRequestLimiter, service };
}

describe('otpService.requestOtp', () => {
  it('normalizes the phone, sends a code via WhatsApp and reports expiry + resend windows', async () => {
    const { sender, service } = build();

    const result = await service.requestOtp('+1 (555) 123-4567');

    expect(result.expiresInSeconds).toBe(300);
    expect(result.resendAvailableInSeconds).toBe(60);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]!.to).toBe('+15551234567');
    expect(sender.sent[0]!.code).toMatch(/^\d{6}$/);
  });

  it('never stores the plaintext code (only a hash is persisted)', async () => {
    const { store, sender, service } = build();

    await service.requestOtp('+15551234567');
    const stored = await store.getChallenge('+15551234567');

    expect(stored).not.toBeNull();
    expect(stored!.codeHash).not.toContain(sender.sent[0]!.code);
    expect(stored!.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a malformed phone number before sending anything', async () => {
    const { sender, service } = build();

    await expect(service.requestOtp('not-a-phone')).rejects.toBeInstanceOf(InvalidRequestError);
    expect(sender.sent).toHaveLength(0);
  });

  it('throttles resend within the cooldown window and reports the remaining time', async () => {
    const { service, clock } = build();

    await service.requestOtp('+15551234567');

    clock.t += 10_000; // 10s later, still inside the 60s cooldown
    const err = await service.requestOtp('+15551234567').catch((e) => e);
    expect(err).toBeInstanceOf(OtpCooldownError);
    expect((err as OtpCooldownError).retryAfterSeconds).toBe(50);
  });

  it('allows a resend once the cooldown has elapsed', async () => {
    const { service, sender, clock } = build();

    await service.requestOtp('+15551234567');
    clock.t += 60_000; // cooldown elapsed

    const result = await service.requestOtp('+15551234567');
    expect(result.resendAvailableInSeconds).toBe(60);
    expect(sender.sent).toHaveLength(2);
  });

  it('alerts the admin panel and surfaces the Google alternative when the Meta quota is exhausted', async () => {
    const { service, sender, alerter, store } = build();
    sender.mode = 'quota';

    const err = await service.requestOtp('+15551234567').catch((e) => e);

    expect(err).toBeInstanceOf(WhatsAppQuotaExceededError);
    expect((err as WhatsAppQuotaExceededError).alternative).toBe('google');
    expect(alerter.alerts).toHaveLength(1);
    // A failed send must not consume the cooldown or leave a dangling challenge.
    expect(await store.getChallenge('+15551234567')).toBeNull();
    expect(await store.getCooldownSeconds('+15551234567')).toBe(0);
  });
});

describe('otpService.verifyOtp', () => {
  it('issues a session + tokens and creates a phone user on first successful verify', async () => {
    const { service, sender, repo } = build();
    await service.requestOtp('+15551234567');
    const code = sender.sent[0]!.code;

    const result = await service.verifyOtp('+15551234567', code);

    expect(result.isNewUser).toBe(true);
    expect(result.user.phone).toBe('+15551234567');
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(repo.userCount()).toBe(1);
  });

  it('reuses the existing user on a later verify (no duplicate account)', async () => {
    const { service, sender, clock } = build();
    await service.requestOtp('+15551234567');
    const first = await service.verifyOtp('+15551234567', sender.sent[0]!.code);

    clock.t += 60_000; // let the resend cooldown elapse before requesting again
    await service.requestOtp('+15551234567');
    const second = await service.verifyOtp('+15551234567', sender.sent[1]!.code);

    expect(second.isNewUser).toBe(false);
    expect(second.user.id).toBe(first.user.id);
  });

  it('consumes the code so it cannot be replayed', async () => {
    const { service, sender } = build();
    await service.requestOtp('+15551234567');
    const code = sender.sent[0]!.code;

    await service.verifyOtp('+15551234567', code);
    await expect(service.verifyOtp('+15551234567', code)).rejects.toBeInstanceOf(OtpNotFoundError);
  });

  it('rejects verification when no code was requested', async () => {
    const { service } = build();
    await expect(service.verifyOtp('+15551234567', '123456')).rejects.toBeInstanceOf(OtpNotFoundError);
  });

  it('rejects an expired code after the TTL and clears it', async () => {
    const { service, sender, clock, store } = build();
    await service.requestOtp('+15551234567');
    const code = sender.sent[0]!.code;

    clock.t += 301_000; // just past the 5-minute TTL

    await expect(service.verifyOtp('+15551234567', code)).rejects.toBeInstanceOf(OtpExpiredError);
    expect(await store.getChallenge('+15551234567')).toBeNull();
  });

  it('rejects a wrong code and reports remaining attempts', async () => {
    const { service } = build();
    await service.requestOtp('+15551234567');

    const err = await service.verifyOtp('+15551234567', '000000').catch((e) => e);
    expect(err).toBeInstanceOf(OtpInvalidCodeError);
    expect((err as OtpInvalidCodeError).attemptsRemaining).toBe(4);
  });

  it('locks out and clears the code after too many wrong attempts', async () => {
    const { service, store } = build();
    await service.requestOtp('+15551234567');

    for (let i = 0; i < 4; i++) {
      await service.verifyOtp('+15551234567', '000000').catch(() => {});
    }
    // 5th wrong attempt trips the max-attempts lockout.
    await expect(service.verifyOtp('+15551234567', '000000')).rejects.toBeInstanceOf(OtpMaxAttemptsError);
    expect(await store.getChallenge('+15551234567')).toBeNull();
  });
});
