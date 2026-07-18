import { Router } from 'express';
import { z } from 'zod';
import type { SessionService } from './sessionService';
import { AdminUnauthorizedError, InvalidRequestError } from './errors';

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

const revokeSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
});

export interface SessionRouterOptions {
  /**
   * Shared secret the admin panel presents as `Authorization: Bearer <token>`
   * to force-revoke a user. When undefined, the admin revoke endpoint is
   * disabled (returns 401) — it is never left unguarded.
   */
  adminApiToken?: string;
}

/**
 * Refresh & session-revocation routes:
 *   POST /auth/refresh        { refreshToken }        -> { accessToken, refreshToken }
 *   POST /auth/admin/revoke   { userId }  (bearer)    -> { revoked: true }
 *
 * The refresh token is read from the JSON body (the mobile client keeps it in
 * `expo-secure-store`) and is never logged. Errors are thrown as AuthError
 * subclasses and serialized by the shared `errorHandler`.
 */
export function createSessionRouter(
  sessionService: SessionService,
  options: SessionRouterOptions = {},
): Router {
  const router = Router();

  router.post('/refresh', async (req, res, next) => {
    try {
      const parsed = refreshSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? 'Invalid request body';
        throw new InvalidRequestError(message);
      }

      const { accessToken, refreshToken } = await sessionService.refresh(parsed.data.refreshToken);
      res.status(200).json({ accessToken, refreshToken });
    } catch (err) {
      next(err);
    }
  });

  router.post('/admin/revoke', async (req, res, next) => {
    try {
      const { adminApiToken } = options;
      const presented = readBearer(req.headers.authorization);
      // Constant-work check is unnecessary here (admin-only, low volume), but we
      // still fail closed when no token is configured.
      if (!adminApiToken || !presented || presented !== adminApiToken) {
        throw new AdminUnauthorizedError();
      }

      const parsed = revokeSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? 'Invalid request body';
        throw new InvalidRequestError(message);
      }

      await sessionService.revokeAllForUser(parsed.data.userId);
      res.status(200).json({ revoked: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function readBearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer (.+)$/.exec(header);
  return match?.[1]?.trim() ?? null;
}
