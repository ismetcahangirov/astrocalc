import { randomUUID } from 'node:crypto';
import type { Profile, User } from '../auth/types';
import type {
  AccountDeletionRecord,
  DataExportJob,
  ExportReadyFields,
  UserDataExport,
} from './types';

/**
 * Persistence boundary for account deletion + data export (#9). Kept as an
 * interface so the service is unit-testable against an in-memory store while
 * production uses the Drizzle/Neon implementation (`db/drizzleAccountRepository.ts`).
 */
export interface AccountRepository {
  /** Write the GDPR deletion audit record (who deleted whom, when). */
  recordDeletion(record: AccountDeletionRecord): Promise<void>;
  /**
   * Delete the user row. FK `onDelete: 'cascade'` constraints remove every
   * related row (profile, sessions, export jobs, and future user-owned tables).
   */
  deleteUserCascade(userId: string): Promise<void>;
  /** Gather the user's personal data into the exportable bundle shape. */
  collectUserData(userId: string): Promise<UserDataExport | null>;

  createExportJob(userId: string): Promise<DataExportJob>;
  getExportJob(jobId: string): Promise<DataExportJob | null>;
  markExportProcessing(jobId: string): Promise<void>;
  markExportReady(jobId: string, fields: ExportReadyFields): Promise<void>;
  markExportFailed(jobId: string, error: string): Promise<void>;
  /**
   * Atomically stamp the job as downloaded. Returns `false` if it was already
   * downloaded — this is what makes the link single-use even under a race.
   */
  markExportDownloaded(jobId: string): Promise<boolean>;
  /** The stored HMAC hash of the job's download token, if any. */
  getDownloadTokenHash(jobId: string): Promise<string | null>;
}

interface StoredJob extends DataExportJob {
  downloadTokenHash: string | null;
}

/**
 * In-memory {@link AccountRepository} for tests and local dev without a database.
 * Seed users/profiles with {@link seedUser}; the export/deletion bookkeeping is
 * self-contained.
 */
export class InMemoryAccountRepository implements AccountRepository {
  private users = new Map<string, User>();
  private profiles = new Map<string, Profile>();
  private jobs = new Map<string, StoredJob>();

  deletions: AccountDeletionRecord[] = [];

  constructor(private readonly now: () => number = Date.now) {}

  /** Test seam: register a user (and optional profile) the export can read. */
  seedUser(user: User, profile?: Profile): void {
    this.users.set(user.id, user);
    if (profile) this.profiles.set(user.id, profile);
  }

  async recordDeletion(record: AccountDeletionRecord): Promise<void> {
    this.deletions.push({ ...record });
  }

  async deleteUserCascade(userId: string): Promise<void> {
    this.users.delete(userId);
    this.profiles.delete(userId);
    for (const [id, job] of this.jobs) {
      if (job.userId === userId) this.jobs.delete(id);
    }
  }

  async collectUserData(userId: string): Promise<UserDataExport | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    const profile = this.profiles.get(userId) ?? null;
    return {
      exportedAt: new Date(this.now()).toISOString(),
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt.toISOString(),
      },
      profile: profile
        ? {
            displayName: profile.displayName,
            locale: profile.locale,
            birthDate: profile.birthDate,
            birthTime: profile.birthTime,
            birthTimeKnown: profile.birthTimeKnown,
            birthPlaceName: profile.birthPlaceName,
            birthPlaceLat: profile.birthPlaceLat,
            birthPlaceLng: profile.birthPlaceLng,
            birthPlaceTimezone: profile.birthPlaceTimezone,
            onboardingCompletedAt: profile.onboardingCompletedAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  async createExportJob(userId: string): Promise<DataExportJob> {
    const job: StoredJob = {
      id: randomUUID(),
      userId,
      status: 'pending',
      objectKey: null,
      downloadTokenHash: null,
      expiresAt: null,
      downloadedAt: null,
      error: null,
      createdAt: new Date(this.now()),
    };
    this.jobs.set(job.id, job);
    return toPublic(job);
  }

  async getExportJob(jobId: string): Promise<DataExportJob | null> {
    const job = this.jobs.get(jobId);
    return job ? toPublic(job) : null;
  }

  async markExportProcessing(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) job.status = 'processing';
  }

  async markExportReady(jobId: string, fields: ExportReadyFields): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'ready';
    job.objectKey = fields.objectKey;
    job.downloadTokenHash = fields.downloadTokenHash;
    job.expiresAt = fields.expiresAt;
  }

  async markExportFailed(jobId: string, error: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'failed';
    job.error = error;
  }

  async markExportDownloaded(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.downloadedAt) return false;
    job.downloadedAt = new Date(this.now());
    return true;
  }

  async getDownloadTokenHash(jobId: string): Promise<string | null> {
    return this.jobs.get(jobId)?.downloadTokenHash ?? null;
  }
}

function toPublic(job: StoredJob): DataExportJob {
  const { downloadTokenHash: _hash, ...rest } = job;
  return { ...rest };
}
