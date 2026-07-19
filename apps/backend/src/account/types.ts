/** Lifecycle of a GDPR data-export job (#9). */
export type ExportJobStatus = 'pending' | 'processing' | 'ready' | 'failed';

/** How an account deletion was initiated. */
export type DeletionActor = 'self' | 'admin';

/** A data-export job as surfaced to services/routes (never exposes the token hash). */
export interface DataExportJob {
  id: string;
  userId: string;
  status: ExportJobStatus;
  objectKey: string | null;
  expiresAt: Date | null;
  downloadedAt: Date | null;
  error: string | null;
  createdAt: Date;
}

/** The audit record written whenever an account is deleted. */
export interface AccountDeletionRecord {
  deletedUserId: string;
  requestedBy: string;
  actor: DeletionActor;
}

/** Fields the worker sets when it finishes building an export bundle. */
export interface ExportReadyFields {
  objectKey: string;
  downloadTokenHash: string;
  expiresAt: Date;
}

/**
 * The structured personal-data bundle handed back to the user. This is the GDPR
 * "right to data portability" payload — it grows as new user-owned tables land
 * (natal charts, matrix results, PDFs, …); add each new dataset here and in the
 * repository's `collectUserData`.
 */
export interface UserDataExport {
  exportedAt: string;
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    createdAt: string;
  };
  profile: {
    displayName: string | null;
    locale: string | null;
    birthDate: string | null;
    birthTime: string | null;
    birthTimeKnown: boolean;
    birthPlaceName: string | null;
    birthPlaceLat: number | null;
    birthPlaceLng: number | null;
    birthPlaceTimezone: string | null;
    onboardingCompletedAt: string | null;
  } | null;
  /** Other people the user saved and can compute charts for (#s2). */
  subjects: {
    id: string;
    name: string;
    birthDate: string | null;
    birthTime: string | null;
    birthTimeKnown: boolean;
    birthPlaceName: string | null;
    birthPlaceLat: number | null;
    birthPlaceLng: number | null;
    birthPlaceTimezone: string | null;
    createdAt: string;
  }[];
}
