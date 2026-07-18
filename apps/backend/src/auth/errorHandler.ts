import type { ErrorRequestHandler } from 'express';
import { AuthError } from './errors';

/**
 * Terminal Express error handler. Maps known `AuthError`s to their status +
 * machine-readable code, and anything unexpected to a generic 500 (without
 * leaking internals to the client).
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AuthError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ?? {}) },
    });
    return;
  }

  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: { code: 'internal_error', message: 'An unexpected error occurred' },
  });
};
