import { Router } from 'express';
import type { MatrixService } from './matrixService';
import { requireAuth } from '../auth/authMiddleware';
import type { TokenService } from '../auth/tokens';

/**
 * Matrix of Destiny routes (#73), matching the natal-chart and numerology
 * convention — the payload is returned bare as `{ matrix, interpretation }`,
 * not wrapped:
 *   GET /matrix  (bearer) -> the signed-in user's Matrix (cached — #73)
 *
 * There is deliberately no query schema, and therefore no `zod` import. Its two
 * siblings both validate a `referenceDate`; the Matrix has no such parameter,
 * because every arcana is derived from the birth date alone. Accepting one "for
 * symmetry" would document a knob that does nothing.
 */
export function createMatrixRouter(service: MatrixService, tokenService: TokenService): Router {
  const router = Router();
  const auth = requireAuth(tokenService);

  router.get('/', auth, async (req, res, next) => {
    try {
      const result = await service.getMatrix(req.userId as string);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
