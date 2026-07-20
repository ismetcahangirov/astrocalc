import { Router } from 'express';
import { z } from 'zod';
import type { NumerologyService } from './numerologyService';
import { InvalidRequestError } from '../auth/errors';
import { requireAuth } from '../auth/authMiddleware';
import type { TokenService } from '../auth/tokens';

const querySchema = z.object({
  referenceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'referenceDate must be YYYY-MM-DD')
    .optional(),
});

/**
 * Numerology routes (#64), matching the natal-chart convention — the payload is
 * returned bare as `{ profile, interpretation }`, not wrapped:
 *   GET /numerology?referenceDate=YYYY-MM-DD  (bearer) -> the signed-in user's
 *                                                         profile (cached — #64)
 */
export function createNumerologyRouter(
  service: NumerologyService,
  tokenService: TokenService,
): Router {
  const router = Router();
  const auth = requireAuth(tokenService);

  router.get('/', auth, async (req, res, next) => {
    try {
      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new InvalidRequestError(parsed.error.issues[0]?.message ?? 'Invalid query');
      }

      // The client should send its own local date. "Today" is a local-timezone
      // question and the cycle numbers turn over on a date boundary, so a user
      // in Baku just after midnight would otherwise be served the previous
      // day's numbers off the server's UTC clock. The UTC fallback is only for
      // callers that send nothing.
      const referenceDate = parsed.data.referenceDate ?? new Date().toISOString().slice(0, 10);

      const result = await service.getNumerology(req.userId as string, referenceDate);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
