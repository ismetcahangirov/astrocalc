import type { Subject, SubjectPatchData, SubjectWriteData } from './types';

/**
 * Persistence boundary for saved subjects (#s2). Every method is scoped by
 * `userId`, so ownership is enforced at the data layer: a query for another
 * user's subject simply returns nothing. Kept as an interface so the service
 * can be unit-tested against an in-memory store while production uses Drizzle.
 */
export interface SubjectRepository {
  list(userId: string): Promise<Subject[]>;
  get(userId: string, id: string): Promise<Subject | null>;
  create(userId: string, data: SubjectWriteData): Promise<Subject>;
  /** Returns the updated subject, or `null` if none is owned by `userId` with `id`. */
  update(userId: string, id: string, patch: SubjectPatchData): Promise<Subject | null>;
  /** Returns whether a row was deleted (false when not owned / not found). */
  delete(userId: string, id: string): Promise<boolean>;
}

/** In-memory {@link SubjectRepository} for tests and local dev. */
export class InMemorySubjectRepository implements SubjectRepository {
  private subjects = new Map<string, Subject>();
  private seq = 0;

  constructor(private readonly now: () => Date = () => new Date()) {}

  async list(userId: string): Promise<Subject[]> {
    return [...this.subjects.values()]
      .filter((s) => s.userId === userId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async get(userId: string, id: string): Promise<Subject | null> {
    const subject = this.subjects.get(id);
    return subject && subject.userId === userId ? subject : null;
  }

  async create(userId: string, data: SubjectWriteData): Promise<Subject> {
    const timestamp = this.now();
    const subject: Subject = {
      id: `subject-${++this.seq}`,
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
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.subjects.set(subject.id, subject);
    return subject;
  }

  async update(userId: string, id: string, patch: SubjectPatchData): Promise<Subject | null> {
    const existing = await this.get(userId, id);
    if (!existing) return null;
    // Only overwrite fields actually present in the patch.
    const next: Subject = { ...existing, updatedAt: this.now() };
    for (const key of Object.keys(patch) as (keyof SubjectPatchData)[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next as any)[key] = (patch as any)[key];
    }
    this.subjects.set(id, next);
    return next;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const existing = await this.get(userId, id);
    if (!existing) return false;
    this.subjects.delete(id);
    return true;
  }
}
