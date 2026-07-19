import { useCallback, useState } from 'react';
import { ApiError } from '../api/authApi';
import { OtpApiError, requestOtp, verifyOtp, type OtpVerifyResponse } from '../api/otpApi';
import { saveTokens } from './tokenStorage';

export type OtpStep = 'phone' | 'code';

interface State {
  step: OtpStep;
  phone: string;
  loading: boolean;
  error: string | null;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
  attemptsRemaining: number | null;
  retryAfterSeconds: number | null;
  /** Set when WhatsApp delivery is unavailable (quota exhausted) — offer Google instead. */
  alternative: 'google' | null;
}

const INITIAL: State = {
  step: 'phone',
  phone: '',
  loading: false,
  error: null,
  expiresInSeconds: 0,
  resendAvailableInSeconds: 0,
  attemptsRemaining: null,
  retryAfterSeconds: null,
  alternative: null,
};

/**
 * Drives the WhatsApp OTP login flow (#3) from the UI's perspective:
 *   request a code for a phone number -> verify it -> persisted session.
 * Mirrors `useGoogleAuth`'s `loading`/`error` contract; the extra fields
 * surface the backend's abuse-protection state (#10) — cooldown/lockout
 * countdowns, remaining verification attempts, and the Google fallback signal
 * — so the screen can render a countdown, a warning, or a switch-provider
 * prompt instead of a generic error.
 */
export function useOtpAuth() {
  const [state, setState] = useState<State>(INITIAL);

  const requestCode = useCallback(async (phone: string): Promise<boolean> => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await requestOtp(phone);
      setState((s) => ({
        ...s,
        step: 'code',
        phone,
        loading: false,
        error: null,
        expiresInSeconds: result.expiresInSeconds,
        resendAvailableInSeconds: result.resendAvailableInSeconds,
        attemptsRemaining: null,
        retryAfterSeconds: null,
      }));
      return true;
    } catch (err) {
      setState((s) => applyError(s, err));
      return false;
    }
  }, []);

  const verifyCode = useCallback(
    async (code: string): Promise<OtpVerifyResponse | null> => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await verifyOtp(state.phone, code);
        await saveTokens(result.accessToken, result.refreshToken);
        setState((s) => ({ ...s, loading: false, error: null }));
        return result;
      } catch (err) {
        setState((s) => applyError(s, err));
        return null;
      }
    },
    [state.phone],
  );

  const reset = useCallback(() => setState(INITIAL), []);

  return { ...state, requestCode, verifyCode, reset };
}

function applyError(state: State, err: unknown): State {
  const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
  return {
    ...state,
    loading: false,
    error: message,
    attemptsRemaining: err instanceof OtpApiError ? (err.attemptsRemaining ?? null) : null,
    retryAfterSeconds: err instanceof OtpApiError ? (err.retryAfterSeconds ?? null) : null,
    alternative: err instanceof OtpApiError ? (err.alternative ?? null) : null,
  };
}
