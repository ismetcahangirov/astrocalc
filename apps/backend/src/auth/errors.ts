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
