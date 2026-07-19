import { useCallback, useState } from 'react';
import { OtpApiError, requestOtp, verifyOtp, type OtpVerifyResponse } from '../api/otpApi';
import { useTranslation } from '../i18n/LocaleContext';
import type { TranslationKey } from '../i18n/translations';
import { localizeOtpError } from '../otp/errorMessages';
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
  const { t } = useTranslation();

  const requestCode = useCallback(
    async (phone: string): Promise<boolean> => {
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
        setState((s) => applyError(s, err, t));
        return false;
      }
    },
    [t],
  );

  const verifyCode = useCallback(
    async (code: string): Promise<OtpVerifyResponse | null> => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const result = await verifyOtp(state.phone, code);
        await saveTokens(result.accessToken, result.refreshToken);
        setState((s) => ({ ...s, loading: false, error: null }));
        return result;
      } catch (err) {
        setState((s) => applyError(s, err, t));
        return null;
      }
    },
    [state.phone, t],
  );

  const reset = useCallback(() => setState(INITIAL), []);

  return { ...state, requestCode, verifyCode, reset };
}

function applyError(state: State, err: unknown, t: (key: TranslationKey) => string): State {
  return {
    ...state,
    loading: false,
    error: localizeOtpError(err, t),
    attemptsRemaining: err instanceof OtpApiError ? (err.attemptsRemaining ?? null) : null,
    retryAfterSeconds: err instanceof OtpApiError ? (err.retryAfterSeconds ?? null) : null,
    alternative: err instanceof OtpApiError ? (err.alternative ?? null) : null,
  };
}
