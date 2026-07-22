import { Router } from 'express';
import { z } from 'zod';
import type { ProfileService } from './profileService';
import { InvalidRequestError } from '../auth/errors';
import { requireAuth } from '../auth/authMiddleware';
import type { TokenService } from '../auth/tokens';

const patchSchema = z.object({
  displayName: z.string().min(1).max(200).nullable().optional(),
  // The three name parts (Ad / Soyad / Ata adı) the app now sends. When any is
  // present the service composes `fullName` and `displayName` from them.
  firstName: z.string().trim().max(120).nullable().optional(),
  lastName: z.string().trim().max(120).nullable().optional(),
  patronymic: z.string().trim().max(120).nullable().optional(),
  // Same 200-char ceiling as displayName: multi-part patronymic and compound
  // family names run long, and a rejected name is a worse failure here than a
  // long one. Trimmed because leading whitespace would otherwise ride along
  // into the numerology letter sum as a no-op.
  fullName: z.string().trim().min(1).max(200).nullable().optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
  locale: z.string().min(2).max(10).nullable().optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'birthDate must be YYYY-MM-DD')
    .nullable()
    .optional(),
  birthTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'birthTime must be HH:mm')
    .nullable()
    .optional(),
  birthTimeKnown: z.boolean().optional(),
  birthPlaceName: z.string().min(1).max(200).nullable().optional(),
  birthPlaceLat: z.number().min(-90).max(90).nullable().optional(),
  birthPlaceLng: z.number().min(-180).max(180).nullable().optional(),
  birthPlaceTimezone: z.string().min(1).max(100).nullable().optional(),
  completeOnboarding: z.boolean().optional(),
});

function serialize(profile: Awaited<ReturnType<ProfileService['getProfile']>>) {
  return {
    ...profile,
    onboardingCompletedAt: profile.onboardingCompletedAt?.toISOString() ?? null,
  };
}

/**
 * Profile routes, shared by the onboarding flow (#6) and the profile-edit
 * screen (#7) — both send the same PATCH shape, just at different times:
 *   GET   /profile  (bearer)          -> current user's profile
 *   PATCH /profile  (bearer) { ... }  -> partial update; each onboarding step
 *                                        calls this with just its own fields,
 *                                        and the edit screen calls it with
 *                                        whichever fields the user changed.
 *                                        `completeOnboarding: true` marks the
 *                                        flow finished (normally, or via
 *                                        "I'll finish this later") and is what
 *                                        unlocks the main app.
 *
 * Changing any birth-relevant field (birthDate/birthTime/birthTimeKnown/
 * birthPlace*) invalidates that user's cached natal chart/matrix via
 * `ProfileService`'s cache invalidator — see `profileService.ts`. That cache
 * itself is EPIC 3 / #19 (chart result caching), not yet built; the
 * invalidator is a no-op until #19 lands, but the call site is already wired
 * so #19 only has to implement the port, not find every caller.
 */
export function createProfileRouter(service: ProfileService, tokenService: TokenService): Router {
  const router = Router();
  const auth = requireAuth(tokenService);

  router.get('/', auth, async (req, res, next) => {
    try {
      const profile = await service.getProfile(req.userId as string);
      res.status(200).json(serialize(profile));
    } catch (err) {
      next(err);
    }
  });

  router.patch('/', auth, async (req, res, next) => {
    try {
      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? 'Invalid request body';
        throw new InvalidRequestError(message);
      }

      const profile = await service.updateProfile(req.userId as string, parsed.data);
      res.status(200).json(serialize(profile));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
