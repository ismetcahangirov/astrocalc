import { authedFetch, ApiError } from './httpClient';
import type { NatalChartResponse } from './natalChartApi';

export { ApiError } from './httpClient';

/** A saved person the user can compute a chart for (mirrors the backend `Subject`). */
export interface Subject {
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
  updatedAt: string;
}

/** Create/update input. `birthPlaceTimezone` is intentionally absent — the server derives it. */
export interface SubjectInput {
  name: string;
  birthDate?: string | null;
  birthTime?: string | null;
  birthTimeKnown?: boolean;
  birthPlaceName?: string | null;
  birthPlaceLat?: number | null;
  birthPlaceLng?: number | null;
}

type ApiEnvelope<T> = (T & { error?: never }) | { error: { code: string; message: string } } | null;

async function parse<T>(res: Response, fallback: string): Promise<T> {
  const data = (await res.json().catch(() => null)) as ApiEnvelope<T>;
  if (!res.ok || !data || 'error' in data) {
    const err = data && 'error' in data ? data.error : null;
    throw new ApiError(err?.code ?? 'unknown_error', err?.message ?? fallback);
  }
  return data;
}

export async function listSubjects(): Promise<Subject[]> {
  const res = await authedFetch('/subjects', { method: 'GET' });
  const { subjects } = await parse<{ subjects: Subject[] }>(res, 'Could not load your people.');
  return subjects;
}

export async function createSubject(input: SubjectInput): Promise<Subject> {
  const res = await authedFetch('/subjects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const { subject } = await parse<{ subject: Subject }>(res, 'Could not save this person.');
  return subject;
}

export async function getSubject(id: string): Promise<Subject> {
  const res = await authedFetch(`/subjects/${id}`, { method: 'GET' });
  const { subject } = await parse<{ subject: Subject }>(res, 'Could not load this person.');
  return subject;
}

export async function updateSubject(id: string, patch: SubjectInput): Promise<Subject> {
  const res = await authedFetch(`/subjects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const { subject } = await parse<{ subject: Subject }>(res, 'Could not save this person.');
  return subject;
}

export async function deleteSubject(id: string): Promise<void> {
  const res = await authedFetch(`/subjects/${id}`, { method: 'DELETE' });
  if (!res.ok) await parse<{ ok: true }>(res, 'Could not delete this person.');
}

/** Fetch a saved person's natal chart from the backend (online only). */
export async function getSubjectChart(id: string): Promise<NatalChartResponse> {
  const res = await authedFetch(`/subjects/${id}/natal-chart`, { method: 'GET' });
  return parse<NatalChartResponse>(res, 'Could not load this chart. Please try again.');
}
