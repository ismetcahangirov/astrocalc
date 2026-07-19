import { Router } from 'express';
import { z } from 'zod';
import type { GeocodingService } from './geocodingService';
import { InvalidRequestError } from '../auth/errors';
import { requireAuth } from '../auth/authMiddleware';
import type { TokenService } from '../auth/tokens';

const querySchema = z.object({ q: z.string().trim().min(1).max(200) });

const reverseSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/**
 * GET /geocoding/search?q=<text> -> { results: PlaceResult[] }
 * Used by the birth-place field's autocomplete (onboarding + profile edit).
 * An empty `results` array is a normal, successful response — it's the
 * client's cue to fall back to manual lat/lng entry.
 */
export function createGeocodingRouter(
  service: GeocodingService,
  tokenService: TokenService,
): Router {
  const router = Router();
  const auth = requireAuth(tokenService);

  router.get('/search', auth, async (req, res, next) => {
    try {
      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new InvalidRequestError('Query parameter "q" is required');
      }

      const results = await service.search(parsed.data.q);
      res.status(200).json({ results });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /geocoding/reverse?lat=<num>&lng=<num> -> { name, region, timezone }
   * Turns a map-picked point into a human-readable place plus the historically
   * correct IANA timezone (derived from the coordinates). Used by the birth-place
   * map picker to label a dropped pin and preview its zone.
   */
  router.get('/reverse', auth, async (req, res, next) => {
    try {
      const parsed = reverseSchema.safeParse(req.query);
      if (!parsed.success) {
        throw new InvalidRequestError('Query parameters "lat" and "lng" are required');
      }

      const result = await service.reverse(parsed.data.lat, parsed.data.lng);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
