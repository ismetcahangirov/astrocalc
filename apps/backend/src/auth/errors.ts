/**
 * Application-level auth errors. Each carries a stable machine-readable `code`
 * (for the mobile client to branch on) and an HTTP `status`. The route layer
 * translates these into a `{ error: { code, message } }` JSON body so the app
 * can show a clear, localizable message.
 */
export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 401,
    /** Extra client-facing fields merged into the error body (e.g. countdowns). */
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Raised whenever a Google ID token cannot be trusted for any reason. */
export class TokenVerificationError extends AuthError {
  constructor(message = 'Google token verification failed') {
    super('google_token_invalid', message, 401);
    this.name = 'TokenVerificationError';
  }
}

/** Raised for malformed / missing request input. */
export class InvalidRequestError extends AuthError {
  constructor(message = 'Invalid request') {
    super('invalid_request', message, 400);
    this.name = 'InvalidRequestError';
  }
}

/**
 * The refresh token is no longer valid because the session (or every session of
 * the user) has been revoked — e.g. a logout, an admin ban, or the theft
 * response below. The client must sign in again.
 */
export class SessionRevokedError extends AuthError {
  constructor(message = 'Your session has ended. Please sign in again.') {
    super('session_revoked', message, 401);
    this.name = 'SessionRevokedError';
  }
}

/**
 * An already-rotated (used) refresh token was replayed. This is the classic
 * signal of a stolen token, so we invalidate *all* of the user's sessions and
 * force a fresh sign-in everywhere.
 */
export class TokenReuseError extends AuthError {
  constructor(message = 'This session was ended for your security. Please sign in again.') {
    super('token_reuse_detected', message, 401);
    this.name = 'TokenReuseError';
  }
}

/** The caller is not authorized to perform an admin action. */
export class AdminUnauthorizedError extends AuthError {
  constructor(message = 'Not authorized') {
    super('admin_unauthorized', message, 401);
    this.name = 'AdminUnauthorizedError';
  }
}

/** No (or a malformed) `Authorization: Bearer <token>` header on a protected route. */
export class AuthenticationRequiredError extends AuthError {
  constructor(message = 'Authentication required') {
    super('unauthorized', message, 401);
    this.name = 'AuthenticationRequiredError';
  }
}

/**
 * The signed-in user's profile is missing birth data required to compute a
 * natal chart (birth date, birth-place coordinates, or the resolved
 * timezone) — the offline/backend parity #20 depends on assumes every field
 * `computeNatalChart` needs is present before either side computes anything.
 */
export class IncompleteProfileError extends AuthError {
  constructor(missing: string[]) {
    super(
      'incomplete_profile',
      'Complete your birth details before viewing your natal chart.',
      422,
      { missing },
    );
    this.name = 'IncompleteProfileError';
  }
}

/**
 * The profile is missing data numerology needs — most often `fullName`, which
 * profiles created before that column existed do not have. Mirrors
 * {@link IncompleteProfileError}'s code and shape so a client can handle both
 * the same way.
 */
export class IncompleteNumerologyProfileError extends AuthError {
  constructor(missing: string[]) {
    super('incomplete_profile', 'Profile is missing data required for numerology', 422, {
      missing,
    });
    this.name = 'IncompleteNumerologyProfileError';
  }
}

/** A saved subject (#s2) doesn't exist, or doesn't belong to the caller. */
export class SubjectNotFoundError extends AuthError {
  constructor(message = 'That person could not be found.') {
    super('subject_not_found', message, 404);
    this.name = 'SubjectNotFoundError';
  }
}

/** An account-link token is missing, malformed, expired, or already used (#4). */
export class AccountLinkTokenError extends AuthError {
  constructor(message = 'This link request has expired. Please try signing in again.') {
    super('account_link_token_invalid', message, 401);
    this.name = 'AccountLinkTokenError';
  }
}

/**
 * The account-link token names a different existing account than the one the
 * caller is currently authenticated as. Confirming a link must happen from a
 * session opened on the account being linked *to* — otherwise anyone who
 * intercepts a link token could attach their Google identity to someone
 * else's account.
 */
export class AccountLinkMismatchError extends AuthError {
  constructor(message = "This link request doesn't match your signed-in account.") {
    super('account_link_mismatch', message, 403);
    this.name = 'AccountLinkMismatchError';
  }
}
