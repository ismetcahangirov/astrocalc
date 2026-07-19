import { Router } from 'express';
import { z } from 'zod';
import type { AuthService } from './authService';
import { InvalidRequestError } from './errors';

const bodySchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
});

/**
 * POST /auth/google  { idToken }  ->
 *   { status: 'signed_in', user, accessToken, refreshToken, isNewUser } | on a
 *   same-email match with an unlinked existing account (#4):
 *   { status: 'link_required', linkToken, maskedEmail }
 *
 * Errors are thrown (AuthError subclasses) and translated to JSON by
 * `errorHandler`, so the mobile client always receives a stable
 * `{ error: { code, message } }` shape it can show to the user.
 */
export function createGoogleAuthRouter(authService: AuthService): Router {
  const router = Router();

  router.post('/google', async (req, res, next) => {
    try {
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? 'Invalid request body';
        throw new InvalidRequestError(message);
      }

      const outcome = await authService.signInWithGoogle(parsed.data.idToken);

      if (outcome.status === 'link_required') {
        res.status(200).json({
          status: 'link_required',
          linkToken: outcome.linkToken,
          maskedEmail: outcome.maskedEmail,
        });
        return;
      }

      res.status(200).json({
        status: 'signed_in',
        user: {
          id: outcome.user.id,
          email: outcome.user.email,
          googleId: outcome.user.googleId,
        },
        accessToken: outcome.accessToken,
        refreshToken: outcome.refreshToken,
        isNewUser: outcome.isNewUser,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
