import { Router } from 'express';
import { z } from 'zod';
import type { AuthService } from './authService';
import { InvalidRequestError } from './errors';

const bodySchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
});

/**
 * POST /auth/google  { idToken }  ->  { user, accessToken, refreshToken, isNewUser }
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

      const result = await authService.signInWithGoogle(parsed.data.idToken);

      res.status(200).json({
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
