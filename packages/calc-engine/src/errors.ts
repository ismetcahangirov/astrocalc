/**
 * Base error type for all calc-engine failures (invalid input, calculation
 * failures, unsupported cases). Callers in apps/backend and apps/mobile can
 * `instanceof CalcEngineError` to distinguish engine errors from unrelated
 * ones, and branch on `code` for stable, non-message-string-matching handling.
 */
export class CalcEngineError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CalcEngineError';
    Object.setPrototypeOf(this, CalcEngineError.prototype);
  }
}
