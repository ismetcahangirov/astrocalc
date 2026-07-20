import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from './client';
import {
  accountDeletions,
  dataExportJobs,
  profiles,
  subjects,
  users,
  type DataExportJobRow,
} from './schema';
import type { AccountRepository } from '../account/repository';
import type {
  AccountDeletionRecord,
  DataExportJob,
  ExportReadyFields,
  ExportJobStatus,
  UserDataExport,
} from '../account/types';

function toJob(row: DataExportJobRow): DataExportJob {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status as ExportJobStatus,
    objectKey: row.objectKey,
    expiresAt: row.expiresAt,
    downloadedAt: row.downloadedAt,
    error: row.error,
    createdAt: row.createdAt,
  };
}

/** Drizzle/Neon-backed {@link AccountRepository}. */
export class DrizzleAccountRepository implements AccountRepository {
  constructor(private readonly db: Database) {}

  async recordDeletion(record: AccountDeletionRecord): Promise<void> {
    await this.db.insert(accountDeletions).values({
      deletedUserId: record.deletedUserId,
      requestedBy: record.requestedBy,
      actor: record.actor,
    });
  }

  async deleteUserCascade(userId: string): Promise<void> {
    // FK `onDelete: 'cascade'` on profiles/sessions/dataExportJobs (and future
    // user-owned tables) removes every related row.
    await this.db.delete(users).where(eq(users.id, userId));
  }

  async collectUserData(userId: string): Promise<UserDataExport | null> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return null;
    const [profile] = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    const subjectRows = await this.db
      .select()
      .from(subjects)
      .where(eq(subjects.userId, userId))
      .orderBy(subjects.createdAt);

    return {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt.toISOString(),
      },
      profile: profile
        ? {
            displayName: profile.displayName,
            fullName: profile.fullName,
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
      subjects: subjectRows.map((s) => ({
        id: s.id,
        name: s.name,
        birthDate: s.birthDate,
        birthTime: s.birthTime,
        birthTimeKnown: s.birthTimeKnown,
        birthPlaceName: s.birthPlaceName,
        birthPlaceLat: s.birthPlaceLat,
        birthPlaceLng: s.birthPlaceLng,
        birthPlaceTimezone: s.birthPlaceTimezone,
        createdAt: s.createdAt.toISOString(),
      })),
    };
  }

  async createExportJob(userId: string): Promise<DataExportJob> {
    const [row] = await this.db.insert(dataExportJobs).values({ userId }).returning();
    if (!row) throw new Error('failed to create export job');
    return toJob(row);
  }

  async getExportJob(jobId: string): Promise<DataExportJob | null> {
    const [row] = await this.db
      .select()
      .from(dataExportJobs)
      .where(eq(dataExportJobs.id, jobId))
      .limit(1);
    return row ? toJob(row) : null;
  }

  async markExportProcessing(jobId: string): Promise<void> {
    await this.db
      .update(dataExportJobs)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(eq(dataExportJobs.id, jobId));
  }

  async markExportReady(jobId: string, fields: ExportReadyFields): Promise<void> {
    await this.db
      .update(dataExportJobs)
      .set({
        status: 'ready',
        objectKey: fields.objectKey,
        downloadTokenHash: fields.downloadTokenHash,
        expiresAt: fields.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(dataExportJobs.id, jobId));
  }

  async markExportFailed(jobId: string, error: string): Promise<void> {
    await this.db
      .update(dataExportJobs)
      .set({ status: 'failed', error, updatedAt: new Date() })
      .where(eq(dataExportJobs.id, jobId));
  }

  async markExportDownloaded(jobId: string): Promise<boolean> {
    // Conditional on `downloadedAt IS NULL` so only the first request wins.
    const rows = await this.db
      .update(dataExportJobs)
      .set({ downloadedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(dataExportJobs.id, jobId), isNull(dataExportJobs.downloadedAt)))
      .returning({ id: dataExportJobs.id });
    return rows.length > 0;
  }

  async getDownloadTokenHash(jobId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ hash: dataExportJobs.downloadTokenHash })
      .from(dataExportJobs)
      .where(eq(dataExportJobs.id, jobId))
      .limit(1);
    return row?.hash ?? null;
  }
}
