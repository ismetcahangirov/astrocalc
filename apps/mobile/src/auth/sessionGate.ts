import { ApiError } from '../api/apiError';

/** What the launch gate should do when the first authenticated call fails. */
export type GateFailure = 'sign_out' | 'retry';

/**
 * Decide whether a failed launch-time profile fetch means the session is over.
 *
 * Only an explicit `unauthorized` does — and since `authedFetch` now refreshes
 * expired access tokens (#86), that answer means the *refresh* token was
 * rejected too, i.e. the session really is finished.
 *
 * Everything else keeps the session. Being offline, a backend outage, or a
 * client-side bug says nothing about the validity of the user's tokens, and
 * throwing them away costs a sign-in for a condition that usually clears
 * itself. The gate offers a retry (and a manual sign-in) instead.
 */
export function classifyGateFailure(error: unknown): GateFailure {
  return error instanceof ApiError && error.code === 'unauthorized' ? 'sign_out' : 'retry';
}
