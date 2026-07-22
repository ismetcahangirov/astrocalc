import { SUPPORTED_LOCALES, type InterpretationLocale } from '@astrocalc/calc-engine';
import { Router } from 'express';
import { z } from 'zod';
import type { InterpretationService } from './interpretationService';
import { AdminUnauthorizedError, InvalidRequestError } from '../auth/errors';
import { requireAuth } from '../auth/authMiddleware';
import type { TokenService } from '../auth/tokens';

const categorySchema = z.enum([
  'planet-sign',
  'planet-house',
  'house',
  'aspect',
  'numerology',
  'matrix',
]);
const localeSchema = z.enum(
  SUPPORTED_LOCALES as unknown as [InterpretationLocale, ...InterpretationLocale[]],
);

const querySchema = z.object({ locale: localeSchema });

const subjectSchema = z.object({
  category: categorySchema,
  subjectKey: z.string().min(1).max(100),
});

const batchSchema = z.object({
  locale: localeSchema,
  subjects: z.array(subjectSchema).min(1).max(200),
});

const upsertSchema = z.object({ content: z.string().min(1).max(5000) });

const celestialBodySchema = z.enum([
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'northNode',
  'southNode',
  'chiron',
]);
const zodiacSignSchema = z.enum([
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
]);
const aspectTypeSchema = z.enum(['conjunction', 'sextile', 'square', 'trine', 'opposition']);

const positionSchema = z.object({
  body: celestialBodySchema,
  sign: zodiacSignSchema,
  longitude: z.number(),
});
const cuspSchema = z.object({
  house: z.number().int().min(1).max(12),
  longitude: z.number(),
  sign: zodiacSignSchema,
  degree: z.number(),
});
const chartAspectSchema = z.object({
  bodyA: celestialBodySchema,
  bodyB: celestialBodySchema,
  type: aspectTypeSchema,
});

const forChartSchema = z.object({
  locale: localeSchema,
  chart: z.object({
    positions: z.array(positionSchema).min(1).max(20),
    cusps: z.array(cuspSchema).length(12).optional(),
    aspects: z.array(chartAspectSchema).max(200).optional(),
  }),
});

export interface InterpretationRouterOptions {
  /** Shared secret the admin panel presents to edit interpretation text (EPIC 10). */
  adminApiToken?: string;
}

function readBearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer (.+)$/.exec(header);
  return match?.[1]?.trim() ?? null;
}

/**
 * Interpretation-text routes (#18):
 *   GET  /interpretations/:category/:subjectKey?locale=en  (bearer) -> one resolved text, or 404
 *   POST /interpretations/batch  (bearer) { locale, subjects }      -> the ones with content
 *   POST /interpretations/for-chart  (bearer) { chart, locale }     -> the natal-chart result
 *                                                                       screen's full reading,
 *                                                                       composed server-side
 *                                                                       from a computed chart
 *   PUT  /interpretations/:category/:subjectKey/:locale  (admin)    -> upsert (admin panel edit, no deploy)
 *   GET  /interpretations/admin/missing  (admin)                    -> completeness checklist
 */
export function createInterpretationRouter(
  service: InterpretationService,
  tokenService: TokenService,
  options: InterpretationRouterOptions = {},
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

  router.get('/admin/missing', async (req, res, next) => {
    try {
      requireAdmin(req.headers.authorization);
      const missing = await service.listMissing();
      res.status(200).json({ missing, count: missing.length });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:category/:subjectKey/:locale', async (req, res, next) => {
    try {
      requireAdmin(req.headers.authorization);

      const category = categorySchema.safeParse(req.params.category);
      const locale = localeSchema.safeParse(req.params.locale);
      const subjectKey = req.params.subjectKey;
      if (!category.success || !locale.success || !subjectKey) {
        throw new InvalidRequestError('Invalid category, subjectKey, or locale');
      }
      const body = upsertSchema.safeParse(req.body);
      if (!body.success) {
        throw new InvalidRequestError(body.error.issues[0]?.message ?? 'Invalid request body');
      }

      const updatedBy = typeof req.body?.updatedBy === 'string' ? req.body.updatedBy : null;
      const row = await service.upsertText(
        { category: category.data, subjectKey, locale: locale.data },
        { content: body.data.content, updatedBy },
      );
      res.status(200).json(row);
    } catch (err) {
      next(err);
    }
  });

  router.post('/batch', auth, async (req, res, next) => {
    try {
      const parsed = batchSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new InvalidRequestError(parsed.error.issues[0]?.message ?? 'Invalid request body');
      }

      const results = await service.getBatch(parsed.data.subjects, parsed.data.locale);
      res.status(200).json({ results });
    } catch (err) {
      next(err);
    }
  });

  router.post('/for-chart', auth, async (req, res, next) => {
    try {
      const parsed = forChartSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new InvalidRequestError(parsed.error.issues[0]?.message ?? 'Invalid request body');
      }

      const result = await service.getForComputedChart(parsed.data.chart, parsed.data.locale);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:category/:subjectKey', auth, async (req, res, next) => {
    try {
      const category = categorySchema.safeParse(req.params.category);
      const query = querySchema.safeParse(req.query);
      const subjectKey = req.params.subjectKey;
      if (!category.success || !query.success || !subjectKey) {
        throw new InvalidRequestError('Invalid category, subjectKey, or locale');
      }

      const result = await service.getText(
        { category: category.data, subjectKey },
        query.data.locale,
      );
      if (!result) {
        res
          .status(404)
          .json({ error: { code: 'not_found', message: 'No interpretation text found' } });
        return;
      }
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
