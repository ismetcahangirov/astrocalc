import { Router } from 'express';
import { z } from 'zod';
import type { OtpService } from './otpService';
import type { RateLimiter } from '../security/rateLimiter';
import type { AdminAlerter } from './adminAlerter';
import { InvalidRequestError } from '../auth/errors';
import { OtpIpRateLimitError } from './errors';

const requestSchema = z.object({ phone: z.string().min(1, 'phone is required') });
const verifySchema = z.object({
  phone: z.string().min(1, 'phone is required'),
  code: z.string().min(1, 'code is required'),
});

export interface OtpRouterDeps {
  otpService: OtpService;
  /** Caps OTP-request calls per source IP (e.g. 10/hour) — SMS/WhatsApp-bombing protection (#10). */
  ipRequestLimiter: RateLimiter;
  alerter: AdminAlerter;
}

/**
 * WhatsApp OTP login:
 *   POST /otp/request { phone }        -> { expiresInSeconds, resendAvailableInSeconds }
 *   POST /otp/verify  { phone, code }  -> { user, accessToken, refreshToken, isNewUser }
 *
 * The request endpoint is additionally throttled per source IP: the per-phone
 * cooldown/limit inside `otpService` alone can't stop one attacker from
 * spraying codes at many different numbers from a single IP.
 */
export function createOtpRouter(deps: OtpRouterDeps): Router {
  const { otpService, ipRequestLimiter, alerter } = deps;
  const router = Router();

  router.post('/request', async (req, res, next) => {
    try {
      const parsed = requestSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? 'Invalid request body';
        throw new InvalidRequestError(message);
      }

      const ip = req.ip ?? 'unknown';
      const rate = await ipRequestLimiter.limit(ip);
      if (!rate.success) {
        await alerter.anomalousActivity({ kind: 'otp_ip_rate_limited', identifier: ip, at: new Date() });
        throw new OtpIpRateLimitError(rate.retryAfterSeconds);
      }

      const result = await otpService.requestOtp(parsed.data.phone);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/verify', async (req, res, next) => {
    try {
      const parsed = verifySchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? 'Invalid request body';
        throw new InvalidRequestError(message);
      }

      const result = await otpService.verifyOtp(parsed.data.phone, parsed.data.code);
      res.status(200).json({
        user: { id: result.user.id, phone: result.user.phone },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        isNewUser: result.isNewUser,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
