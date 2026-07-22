/**
 * A saved "other person" the signed-in user can compute a chart for (#s2).
 * Same birth-data shape as a profile, plus an owner and a required name.
 */
export interface Subject {
  id: string;
  userId: string;
  /** Combined name — composed from the parts, kept for numerology and the People list. */
  name: string;
  /** Name parts (Ad / Soyad / Ata adı) — the source of truth the form collects. */
  firstName: string | null;
  lastName: string | null;
  patronymic: string | null;
  birthDate: string | null;
  birthTime: string | null;
  birthTimeKnown: boolean;
  birthPlaceName: string | null;
  birthPlaceLat: number | null;
  birthPlaceLng: number | null;
  birthPlaceTimezone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Client-supplied fields when creating a subject. `birthPlaceTimezone` is
 * absent by design — the server derives it from the coordinates, never trusting
 * the client (the same rule as profiles).
 */
export interface SubjectCreateInput {
  /**
   * Legacy single-string name, still accepted (and used by older callers/tests).
   * When the name parts below are supplied, `name` is composed from them and any
   * `name` sent alongside is ignored.
   */
  name?: string;
  firstName?: string | null;
  lastName?: string | null;
  patronymic?: string | null;
  birthDate?: string | null;
  birthTime?: string | null;
  birthTimeKnown?: boolean;
  birthPlaceName?: string | null;
  birthPlaceLat?: number | null;
  birthPlaceLng?: number | null;
}

export type SubjectUpdateInput = Partial<SubjectCreateInput>;

/**
 * The persisted shape the repository writes: create/update inputs after the
 * service has resolved the server-owned `birthPlaceTimezone` and composed the
 * combined `name` from the parts.
 */
export type SubjectWriteData = SubjectCreateInput & {
  name: string;
  firstName: string | null;
  lastName: string | null;
  patronymic: string | null;
  birthPlaceTimezone: string | null;
};
export type SubjectPatchData = SubjectUpdateInput & { birthPlaceTimezone?: string | null };
