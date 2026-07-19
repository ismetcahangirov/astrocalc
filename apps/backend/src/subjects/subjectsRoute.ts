import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/authMiddleware';
import { InvalidRequestError } from '../auth/errors';
import type { TokenService } from '../auth/tokens';
import type { SubjectsService } from './subjectsService';

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  birthTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .nullable()
    .optional(),
  birthTimeKnown: z.boolean().optional(),
  birthPlaceName: z.string().max(200).nullable().optional(),
  birthPlaceLat: z.number().min(-90).max(90).nullable().optional(),
  birthPlaceLng: z.number().min(-180).max(180).nullable().optional(),
});

const updateSchema = createSchema.partial();

/**
 * Saved-subject routes (#s2), all bearer-authenticated and scoped to the
 * signed-in user:
 *   GET    /subjects                 -> the user's saved people
 *   POST   /subjects                 -> create one
 *   GET    /subjects/:id             -> one (404 if not owned)
 *   PATCH  /subjects/:id             -> update one
 *   DELETE /subjects/:id             -> delete one (204)
 *   GET    /subjects/:id/natal-chart -> that person's chart
 */
export function createSubjectsRouter(service: SubjectsService, tokenService: TokenService): Router {
  const router = Router();
  const auth = requireAuth(tokenService);

  router.get('/', auth, async (req, res, next) => {
    try {
      const subjects = await service.list(req.userId as string);
      res.status(200).json({ subjects });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', auth, async (req, res, next) => {
    try {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new InvalidRequestError(parsed.error.issues[0]?.message ?? 'Invalid request body');
      }
      const subject = await service.create(req.userId as string, parsed.data);
      res.status(201).json({ subject });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', auth, async (req, res, next) => {
    try {
      const subject = await service.get(req.userId as string, req.params.id as string);
      res.status(200).json({ subject });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', auth, async (req, res, next) => {
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new InvalidRequestError(parsed.error.issues[0]?.message ?? 'Invalid request body');
      }
      const subject = await service.update(
        req.userId as string,
        req.params.id as string,
        parsed.data,
      );
      res.status(200).json({ subject });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', auth, async (req, res, next) => {
    try {
      await service.remove(req.userId as string, req.params.id as string);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id/natal-chart', auth, async (req, res, next) => {
    try {
      const result = await service.getChart(req.userId as string, req.params.id as string);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
