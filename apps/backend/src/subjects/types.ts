/**
 * A saved "other person" the signed-in user can compute a chart for (#s2).
 * Same birth-data shape as a profile, plus an owner and a required name.
 */
export interface Subject {
  id: string;
  userId: string;
  name: string;
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
  name: string;
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
 * service has resolved the server-owned `birthPlaceTimezone`.
 */
export type SubjectWriteData = SubjectCreateInput & { birthPlaceTimezone: string | null };
export type SubjectPatchData = SubjectUpdateInput & { birthPlaceTimezone?: string | null };
