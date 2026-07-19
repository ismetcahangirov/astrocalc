import { Router } from 'express';
import { z } from 'zod';
import type { AccountService } from './accountService';
import type { TokenService } from '../auth/tokens';
import { requireAuth } from '../auth/authMiddleware';
import { InvalidRequestError } from '../auth/errors';
import { WorkerUnauthorizedError } from './errors';

const deleteSchema = z.object({
  confirmation: z.string().optional(),
});

const processSchema = z.object({
  jobId: z.string().min(1, 'jobId is required'),
});

export interface AccountRouterOptions {
  /**
   * Shared secret QStash forwards (as `Authorization: Bearer <token>`) when it
   * calls the export worker webhook. When unset the webhook is disabled
   * (fails closed) — it is never left unguarded.
   */
  workerToken?: string;
}

/**
 * Account deletion + GDPR data export (#9):
 *   DELETE /account                          (bearer) { confirmation } -> { deleted: true }
 *   POST   /account/export                   (bearer)                  -> 202 { jobId, status }
 *   GET    /account/export/:jobId            (bearer)                  -> { jobId, status, ... }
 *   POST   /account/export/process           (worker secret) { jobId } -> { processed: true }
 *   GET    /account/export/:jobId/download   (?token=)                 -> the JSON bundle (once)
 *
 * The download link carries its own capability token, so it is intentionally
 * NOT behind bearer auth — it is opened from an email/push notification.
 */
export function createAccountRouter(
  service: AccountService,
  tokenService: TokenService,
  options: AccountRouterOptions = {},
): Router {
  const router = Router();
  const auth = requireAuth(tokenService);

  router.delete('/', auth, async (req, res, next) => {
    try {
      const parsed = deleteSchema.safeParse(req.body ?? {});
      if (!parsed.success) throw new InvalidRequestError('Invalid request body');
      const userId = req.userId as string;
      await service.deleteAccount({
        userId,
        confirmation: parsed.data.confirmation,
        actor: 'self',
        requestedBy: userId,
      });
      res.status(200).json({ deleted: true });
    } catch (err) {
      next(err);
    }
  });

  router.post('/export', auth, async (req, res, next) => {
    try {
      const job = await service.requestExport(req.userId as string);
      res.status(202).json({ jobId: job.id, status: job.status });
    } catch (err) {
      next(err);
    }
  });

  router.get('/export/:jobId', auth, async (req, res, next) => {
    try {
      const { jobId } = req.params;
      if (!jobId) throw new InvalidRequestError('jobId is required');
      const job = await service.getExportStatus(req.userId as string, jobId);
      res.status(200).json({
        jobId: job.id,
        status: job.status,
        expiresAt: job.expiresAt?.toISOString() ?? null,
        downloadedAt: job.downloadedAt?.toISOString() ?? null,
      });
    } catch (err) {
      next(err);
    }
  });

  // QStash worker callback — guarded by the forwarded shared secret, not a user.
  router.post('/export/process', async (req, res, next) => {
    try {
      const { workerToken } = options;
      const presented = readBearer(req.headers.authorization);
      if (!workerToken || !presented || presented !== workerToken) {
        throw new WorkerUnauthorizedError();
      }
      const parsed = processSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? 'Invalid request body';
        throw new InvalidRequestError(message);
      }
      await service.processExport(parsed.data.jobId);
      res.status(200).json({ processed: true });
    } catch (err) {
      next(err);
    }
  });

  router.get('/export/:jobId/download', async (req, res, next) => {
    try {
      const token = typeof req.query.token === 'string' ? req.query.token : undefined;
      const result = await service.downloadExport(req.params.jobId, token);
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.status(200).send(result.body);
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
