import { AuthError } from '../auth/errors';

/**
 * Account/export errors. They extend {@link AuthError} purely to reuse its
 * `{ code, status }` carrier and the shared `errorHandler` serialization — it
 * is the app's de-facto HTTP-error base, not an authentication concern per se.
 */

/** The account-deletion request did not include the required confirmation. */
export class DeletionNotConfirmedError extends AuthError {
  constructor(message = 'Account deletion must be explicitly confirmed') {
    super('deletion_not_confirmed', message, 400);
    this.name = 'DeletionNotConfirmedError';
  }
}

/** No export job with the given id (for this user). */
export class ExportJobNotFoundError extends AuthError {
  constructor(message = 'Export job not found') {
    super('export_not_found', message, 404);
    this.name = 'ExportJobNotFoundError';
  }
}

/** The export bundle is not ready to download yet. */
export class ExportNotReadyError extends AuthError {
  constructor(message = 'Your data export is not ready yet') {
    super('export_not_ready', message, 409);
    this.name = 'ExportNotReadyError';
  }
}

/** The download link is wrong, already used, or otherwise unusable. */
export class ExportLinkInvalidError extends AuthError {
  constructor(message = 'This download link is invalid or has already been used') {
    // 410 Gone — the one-time link no longer represents a downloadable resource.
    super('export_link_invalid', message, 410);
    this.name = 'ExportLinkInvalidError';
  }
}

/** The download link has passed its expiry window. */
export class ExportLinkExpiredError extends AuthError {
  constructor(message = 'This download link has expired') {
    super('export_link_expired', message, 410);
    this.name = 'ExportLinkExpiredError';
  }
}

/** The QStash worker callback presented a missing/incorrect shared secret. */
export class WorkerUnauthorizedError extends AuthError {
  constructor(message = 'Not authorized') {
    super('worker_unauthorized', message, 401);
    this.name = 'WorkerUnauthorizedError';
  }
}
