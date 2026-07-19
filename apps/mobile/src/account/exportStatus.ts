import type { TranslationKey } from '../i18n/translations';

/** Mirrors the backend's `ExportJobStatus` (`apps/backend/src/account/types.ts`). */
export type ExportJobStatus = 'pending' | 'processing' | 'ready' | 'failed';

/** Maps a job status to the translation key shown to the user (#9). */
export function describeExportStatus(status: ExportJobStatus): TranslationKey {
  switch (status) {
    case 'pending':
    case 'processing':
      return 'account.export.status.inProgress';
    case 'ready':
      return 'account.export.status.ready';
    case 'failed':
      return 'account.export.status.failed';
  }
}

/** Whether a status is final — the screen can stop polling once it is. */
export function isExportTerminal(status: ExportJobStatus): boolean {
  return status === 'ready' || status === 'failed';
}
