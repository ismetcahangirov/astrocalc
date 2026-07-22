import { and, eq } from 'drizzle-orm';
import type { Database } from './client';
import { subjects, type SubjectRow } from './schema';
import type { SubjectRepository } from '../subjects/repository';
import type { Subject, SubjectPatchData, SubjectWriteData } from '../subjects/types';

function toSubject(row: SubjectRow): Subject {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    firstName: row.firstName,
    lastName: row.lastName,
    patronymic: row.patronymic,
    birthDate: row.birthDate,
    birthTime: row.birthTime,
    birthTimeKnown: row.birthTimeKnown,
    birthPlaceName: row.birthPlaceName,
    birthPlaceLat: row.birthPlaceLat,
    birthPlaceLng: row.birthPlaceLng,
    birthPlaceTimezone: row.birthPlaceTimezone,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Drizzle/Neon-backed {@link SubjectRepository}. Every query is scoped by `userId`. */
export class DrizzleSubjectRepository implements SubjectRepository {
  constructor(private readonly db: Database) {}

  async list(userId: string): Promise<Subject[]> {
    const rows = await this.db
      .select()
      .from(subjects)
      .where(eq(subjects.userId, userId))
      .orderBy(subjects.createdAt);
    return rows.map(toSubject);
  }

  async get(userId: string, id: string): Promise<Subject | null> {
    const [row] = await this.db
      .select()
      .from(subjects)
      .where(and(eq(subjects.userId, userId), eq(subjects.id, id)))
      .limit(1);
    return row ? toSubject(row) : null;
  }

  async create(userId: string, data: SubjectWriteData): Promise<Subject> {
    const [row] = await this.db
      .insert(subjects)
      .values({
        userId,
        name: data.name,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        patronymic: data.patronymic ?? null,
        birthDate: data.birthDate ?? null,
        birthTime: data.birthTime ?? null,
        birthTimeKnown: data.birthTimeKnown ?? false,
        birthPlaceName: data.birthPlaceName ?? null,
        birthPlaceLat: data.birthPlaceLat ?? null,
        birthPlaceLng: data.birthPlaceLng ?? null,
        birthPlaceTimezone: data.birthPlaceTimezone,
      })
      .returning();
    return toSubject(row!);
  }

  async update(userId: string, id: string, patch: SubjectPatchData): Promise<Subject | null> {
    // Only assign the columns the patch actually carries, so an update never
    // clobbers untouched fields.
    const values: Partial<typeof subjects.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if ('name' in patch) values.name = patch.name;
    if ('firstName' in patch) values.firstName = patch.firstName ?? null;
    if ('lastName' in patch) values.lastName = patch.lastName ?? null;
    if ('patronymic' in patch) values.patronymic = patch.patronymic ?? null;
    if ('birthDate' in patch) values.birthDate = patch.birthDate ?? null;
    if ('birthTime' in patch) values.birthTime = patch.birthTime ?? null;
    if ('birthTimeKnown' in patch) values.birthTimeKnown = patch.birthTimeKnown ?? false;
    if ('birthPlaceName' in patch) values.birthPlaceName = patch.birthPlaceName ?? null;
    if ('birthPlaceLat' in patch) values.birthPlaceLat = patch.birthPlaceLat ?? null;
    if ('birthPlaceLng' in patch) values.birthPlaceLng = patch.birthPlaceLng ?? null;
    if ('birthPlaceTimezone' in patch) values.birthPlaceTimezone = patch.birthPlaceTimezone ?? null;

    const [row] = await this.db
      .update(subjects)
      .set(values)
      .where(and(eq(subjects.userId, userId), eq(subjects.id, id)))
      .returning();
    return row ? toSubject(row) : null;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(subjects)
      .where(and(eq(subjects.userId, userId), eq(subjects.id, id)))
      .returning({ id: subjects.id });
    return rows.length > 0;
  }
}
