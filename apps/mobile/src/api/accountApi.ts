import { authedFetch, ApiError } from './httpClient';
import type { ExportJobStatus } from '../account/exportStatus';

export { ApiError } from './httpClient';

export interface ExportJob {
  jobId: string;
  status: ExportJobStatus;
  expiresAt: string | null;
  downloadedAt: string | null;
}

type ApiEnvelope<T> = (T & { error?: never }) | { error: { code: string; message: string } } | null;

async function parseJson<T>(res: Response, fallbackMessage: string): Promise<T> {
  const data = (await res.json().catch(() => null)) as ApiEnvelope<T>;
  if (!res.ok || !data || 'error' in data) {
    const err = data && 'error' in data ? data.error : null;
    throw new ApiError(err?.code ?? 'unknown_error', err?.message ?? fallbackMessage);
  }
  return data;
}

/**
 * Permanently delete the signed-in user's account (#9) — cascades to every
 * related row server-side and revokes all sessions. Requires echoing the
 * server-configured confirmation phrase (default `DELETE`); the backend is
 * the source of truth and rejects a mismatch with `deletion_not_confirmed`.
 */
export async function deleteAccount(confirmation: string): Promise<void> {
  const res = await authedFetch('/account', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmation }),
  });
  if (!res.ok) {
    await parseJson<{ deleted: true }>(res, "Couldn't delete your account. Please try again.");
  }
}

/**
 * Kick off an async GDPR data-export job. The download link itself is never
 * returned here — it's delivered out-of-band once the bundle is ready (see
 * `apps/backend/src/account/exportNotifier.ts`) — so the client only polls
 * {@link getExportStatus} until the job reaches a terminal state.
 */
export async function requestExport(): Promise<ExportJob> {
  const res = await authedFetch('/account/export', { method: 'POST' });
  return parseJson<ExportJob>(res, "Couldn't start your data export. Please try again.");
}

export async function getExportStatus(jobId: string): Promise<ExportJob> {
  const res = await authedFetch(`/account/export/${encodeURIComponent(jobId)}`, { method: 'GET' });
  return parseJson<ExportJob>(res, "Couldn't check your export status.");
}
