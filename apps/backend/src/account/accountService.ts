import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { SessionService } from '../auth/sessionService';
import type { AccountRepository } from './repository';
import type { ObjectStorage } from './objectStorage';
import type { ExportQueue } from './exportQueue';
import type { ExportNotifier } from './exportNotifier';
import type { DataExportJob, DeletionActor } from './types';
import {
  DeletionNotConfirmedError,
  ExportJobNotFoundError,
  ExportLinkExpiredError,
  ExportLinkInvalidError,
  ExportNotReadyError,
} from './errors';

export interface AccountServiceConfig {
  /** The exact phrase the client must echo to confirm a deletion. */
  deletionConfirmationPhrase: string;
  /** Download-link lifetime, in seconds (e.g. 24h). */
  exportTtlSeconds: number;
  /** Public base URL used to build the download link put in notifications. */
  publicApiUrl: string;
  /** HMAC secret used to hash download tokens before storage. */
  downloadTokenSecret: string;
}

export interface AccountServiceDeps {
  repo: AccountRepository;
  storage: ObjectStorage;
  queue: ExportQueue;
  notifier: ExportNotifier;
  sessionService: Pick<SessionService, 'revokeAllForUser'>;
  config: AccountServiceConfig;
  /** Injectable clock (epoch ms) — defaults to `Date.now`. */
  now?: () => number;
  /** Injectable token generator — defaults to a 32-byte random hex string. */
  generateToken?: () => string;
}

export interface DeleteAccountInput {
  userId: string;
  /** The confirmation phrase the client echoed back. */
  confirmation: string | undefined;
  actor: DeletionActor;
  /** Who initiated it (the user themselves, or an admin's id). */
  requestedBy: string;
}

export interface DownloadResult {
  body: Buffer;
  contentType: string;
  filename: string;
}

export interface AccountService {
  deleteAccount(input: DeleteAccountInput): Promise<void>;
  requestExport(userId: string): Promise<DataExportJob>;
  getExportStatus(userId: string, jobId: string): Promise<DataExportJob>;
  /** Called by the QStash worker webhook (or inline in dev) to build the bundle. */
  processExport(jobId: string): Promise<void>;
  downloadExport(jobId: string, token: string | undefined): Promise<DownloadResult>;
}

/**
 * Account deletion + GDPR data export (#9).
 *
 * Deletion is guarded by an explicit confirmation phrase, recorded in an audit
 * log, then cascaded via the users FK (removing profile, sessions, export jobs
 * and any future user-owned rows); the user's refresh tokens are revoked so
 * every device is signed out immediately.
 *
 * Export runs asynchronously: a request creates a `pending` job and enqueues it
 * (QStash); the worker gathers the data, uploads a JSON bundle to R2, and marks
 * the job `ready` with a single-use, ~24h download token (only its hash is
 * stored). The download endpoint verifies the token, atomically consumes it,
 * and deletes the bundle so the link truly works once.
 */
export function createAccountService(deps: AccountServiceDeps): AccountService {
  const { repo, storage, queue, notifier, sessionService, config } = deps;
  const now = deps.now ?? Date.now;
  const generateToken = deps.generateToken ?? (() => randomBytes(32).toString('hex'));

  function hashToken(token: string): string {
    return createHmac('sha256', config.downloadTokenSecret).update(token).digest('hex');
  }

  function tokenMatches(token: string, expectedHash: string): boolean {
    const actual = Buffer.from(hashToken(token));
    const expected = Buffer.from(expectedHash);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  return {
    async deleteAccount(input: DeleteAccountInput): Promise<void> {
      if (input.confirmation !== config.deletionConfirmationPhrase) {
        throw new DeletionNotConfirmedError();
      }

      // Audit first so the GDPR record exists even if a later step throws. No
      // interactive transaction on neon-http; the cascade + revoke run in
      // sequence (mirrors the note in drizzleUserRepository).
      await repo.recordDeletion({
        deletedUserId: input.userId,
        requestedBy: input.requestedBy,
        actor: input.actor,
      });
      await repo.deleteUserCascade(input.userId);
      // Kill every session/refresh token so the deleted account can't be used.
      await sessionService.revokeAllForUser(input.userId);
    },

    async requestExport(userId: string): Promise<DataExportJob> {
      const job = await repo.createExportJob(userId);
      await queue.enqueue(job.id);
      return job;
    },

    async getExportStatus(userId: string, jobId: string): Promise<DataExportJob> {
      const job = await repo.getExportJob(jobId);
      if (!job || job.userId !== userId) throw new ExportJobNotFoundError();
      return job;
    },

    async processExport(jobId: string): Promise<void> {
      const job = await repo.getExportJob(jobId);
      if (!job) throw new ExportJobNotFoundError();
      // Idempotent: QStash may deliver more than once. Only build a bundle for a
      // job that hasn't already been finished.
      if (job.status === 'ready' || job.status === 'failed') return;

      await repo.markExportProcessing(jobId);
      try {
        const data = await repo.collectUserData(job.userId);
        if (!data) throw new Error(`user ${job.userId} not found`);

        const objectKey = `exports/${job.userId}/${jobId}.json`;
        const body = Buffer.from(JSON.stringify(data, null, 2), 'utf8');
        await storage.put(objectKey, body, 'application/json');

        const token = generateToken();
        const expiresAt = new Date(now() + config.exportTtlSeconds * 1000);
        await repo.markExportReady(jobId, {
          objectKey,
          downloadTokenHash: hashToken(token),
          expiresAt,
        });

        const downloadUrl =
          `${config.publicApiUrl.replace(/\/$/, '')}/account/export/${jobId}/download` +
          `?token=${encodeURIComponent(token)}`;
        await notifier.notifyReady({ userId: job.userId, downloadUrl, expiresAt });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'export failed';
        await repo.markExportFailed(jobId, message);
        throw err; // surface to QStash so it can retry
      }
    },

    async downloadExport(jobId: string, token: string | undefined): Promise<DownloadResult> {
      if (!token) throw new ExportLinkInvalidError();

      const job = await repo.getExportJob(jobId);
      if (!job) throw new ExportJobNotFoundError();
      if (job.status !== 'ready' || !job.objectKey) throw new ExportNotReadyError();
      if (job.downloadedAt) throw new ExportLinkInvalidError();
      if (job.expiresAt && now() >= job.expiresAt.getTime()) throw new ExportLinkExpiredError();

      const expectedHash = await repo.getDownloadTokenHash(jobId);
      if (!expectedHash || !tokenMatches(token, expectedHash)) {
        throw new ExportLinkInvalidError();
      }

      // Consume the link atomically before serving so a concurrent second click
      // loses the race (single-use).
      const consumed = await repo.markExportDownloaded(jobId);
      if (!consumed) throw new ExportLinkInvalidError();

      const object = await storage.get(job.objectKey);
      if (!object) throw new ExportLinkInvalidError();

      // Best-effort cleanup — the link is spent, so the blob can go too.
      await storage.delete(job.objectKey).catch(() => undefined);

      return {
        body: object.body,
        contentType: object.contentType,
        filename: `astrocalc-data-export-${jobId}.json`,
      };
    },
  };
}
