import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/apiError';
import { classifyGateFailure } from './sessionGate';

describe('classifyGateFailure', () => {
  it('signs the user out when the session itself was rejected', () => {
    expect(classifyGateFailure(new ApiError('unauthorized', 'You need to sign in again.'))).toBe(
      'sign_out',
    );
  });

  it('keeps the session when the device cannot reach the server', () => {
    // Losing the session because a launch happened in a lift is exactly the
    // forced re-login #86 is about.
    expect(classifyGateFailure(new ApiError('network_error', 'offline'))).toBe('retry');
  });

  it('keeps the session when the backend is failing', () => {
    expect(classifyGateFailure(new ApiError('server_error', 'boom'))).toBe('retry');
    expect(classifyGateFailure(new ApiError('internal_error', 'boom'))).toBe('retry');
  });

  it('keeps the session for an unexpected error', () => {
    // A client-side bug is not evidence that the user's tokens are bad.
    expect(classifyGateFailure(new TypeError('undefined is not a function'))).toBe('retry');
    expect(classifyGateFailure('something odd')).toBe('retry');
  });
});
