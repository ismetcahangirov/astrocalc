import { Router } from 'express';
import { z } from 'zod';
import type { NatalChartService } from './natalChartService';
import { InvalidRequestError } from '../auth/errors';
import { requireAuth } from '../auth/authMiddleware';
import type { TokenService } from '../auth/tokens';

// The submitted chart's content isn't trusted (see `natalChartService.refreshChart`) — this
// only guards against a malformed request, not against the client claiming a wrong chart.
const syncSchema = z.object({ chart: z.record(z.unknown()) });

/**
 * Natal-chart routes (#19/#20), matching the mobile client's
 * `apps/mobile/src/api/natalChartApi.ts` exactly:
 *   GET  /natal-chart       (bearer) -> the signed-in user's chart (cached — #19)
 *   POST /natal-chart/sync  (bearer) { chart } -> recompute + refresh the server
 *                                                  cache with an offline-computed
 *                                                  chart once connectivity returns
 *                                                  (#20, AC #3)
 */
export function createNatalChartRouter(
  service: NatalChartService,
  tokenService: TokenService,
): Router {
  const router = Router();
  const auth = requireAuth(tokenService);

  router.get('/', auth, async (req, res, next) => {
    try {
      const result = await service.getChart(req.userId as string);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/sync', auth, async (req, res, next) => {
    try {
      const parsed = syncSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new InvalidRequestError(parsed.error.issues[0]?.message ?? 'Invalid request body');
      }

      await service.refreshChart(req.userId as string);
      res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
