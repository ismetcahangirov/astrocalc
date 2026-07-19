/**
 * Error carrying the backend's machine-readable code + human message. Kept in
 * its own dependency-free module (rather than alongside `authApi.ts`'s network
 * calls) so pure logic that only needs the error *shape* — like
 * `otp/errorMessages.ts` — doesn't drag in `config.ts` (and, transitively,
 * `expo-constants`) just to check an error code.
 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
