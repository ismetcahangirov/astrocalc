import { ASPECT_ANGLES, type AspectType } from '@astrocalc/calc-engine';
import { Router } from 'express';
import { z } from 'zod';
import type { OrbConfigService } from './orbConfigService';
import { AdminUnauthorizedError, InvalidRequestError } from '../auth/errors';
import { requireAuth } from '../auth/authMiddleware';
import type { TokenService } from '../auth/tokens';

const ASPECT_TYPES = Object.keys(ASPECT_ANGLES) as [AspectType, ...AspectType[]];
const aspectTypeSchema = z.enum(ASPECT_TYPES);
const upsertSchema = z.object({ orbDegrees: z.number().min(0).max(30) });

export interface OrbConfigRouterOptions {
  /** Shared secret the admin panel presents to edit orb values (EPIC 10). */
  adminApiToken?: string;
}

function readBearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer (.+)$/.exec(header);
  return match?.[1]?.trim() ?? null;
}

/**
 * Admin-configurable aspect-orb routes (#15):
 *   GET /orb-config              (bearer) -> effective orb config (defaults merged with overrides) + stored rows
 *   PUT /orb-config/:aspectType  (admin)   -> upsert one aspect type's orb (admin panel edit, no deploy)
 */
export function createOrbConfigRouter(
  service: OrbConfigService,
  tokenService: TokenService,
  options: OrbConfigRouterOptions = {},
): Router {
  const router = Router();
  const auth = requireAuth(tokenService);

  function requireAdmin(headerValue: string | undefined): void {
    const { adminApiToken } = options;
    const presented = readBearer(headerValue);
    if (!adminApiToken || !presented || presented !== adminApiToken) {
      throw new AdminUnauthorizedError();
    }
  }

  router.get('/', auth, async (_req, res, next) => {
    try {
      const [orbs, rows] = await Promise.all([service.getEffectiveOrbs(), service.listRows()]);
      res.status(200).json({ orbs, rows });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:aspectType', async (req, res, next) => {
    try {
      requireAdmin(req.headers.authorization);

      const aspectType = aspectTypeSchema.safeParse(req.params.aspectType);
      if (!aspectType.success) {
        throw new InvalidRequestError('Invalid aspect type');
      }
      const body = upsertSchema.safeParse(req.body);
      if (!body.success) {
        throw new InvalidRequestError(body.error.issues[0]?.message ?? 'Invalid request body');
      }

      const updatedBy = typeof req.body?.updatedBy === 'string' ? req.body.updatedBy : null;
      const row = await service.upsertOrb(aspectType.data, body.data.orbDegrees, updatedBy);
      res.status(200).json(row);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
