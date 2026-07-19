import { Router } from 'express';
import { z } from 'zod';
import type { AccountLinkService } from './accountLinkService';
import { requireAuth } from './authMiddleware';
import { InvalidRequestError } from './errors';
import type { TokenService } from './tokens';

const confirmSchema = z.object({
  linkToken: z.string().min(1, 'linkToken is required'),
});

/**
 * POST /auth/link/confirm  (bearer)  { linkToken }  ->
 *   { user, accessToken, refreshToken, isNewUser: false }
 *
 * Completes an account link (#4) offered by `POST /auth/google`'s
 * `link_required` outcome. The bearer token must belong to the *existing*
 * account named in `linkToken` — i.e. the caller has to sign in some other
 * way first (typically WhatsApp OTP) to prove ownership before the Google
 * identity gets attached.
 */
export function createAccountLinkRouter(
  linkService: AccountLinkService,
  tokenService: TokenService,
): Router {
  const router = Router();
  const auth = requireAuth(tokenService);

  router.post('/link/confirm', auth, async (req, res, next) => {
    try {
      const parsed = confirmSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? 'Invalid request body';
        throw new InvalidRequestError(message);
      }

      const result = await linkService.confirmLink(req.userId as string, parsed.data.linkToken);

      res.status(200).json({
        status: 'signed_in',
        user: {
          id: result.user.id,
          email: result.user.email,
          googleId: result.user.googleId,
        },
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
