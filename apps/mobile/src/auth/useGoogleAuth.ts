import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import {
  ApiError,
  signInWithGoogle,
  type LinkRequiredResponse,
  type SignedInResponse,
} from '../api/authApi';
import { getGoogleIdToken, GoogleSignInError } from './googleSignIn';
import { getGoogleIdTokenViaAuthSession } from './googleSignInFallback';
import { saveTokens } from './tokenStorage';

interface State {
  loading: boolean;
  error: string | null;
  session: SignedInResponse | null;
  /** Set instead of `session` when the email already belongs to another account (#4). */
  linkRequired: LinkRequiredResponse | null;
}

const INITIAL: State = { loading: false, error: null, session: null, linkRequired: null };

/**
 * Drives the full Google sign-in flow from the UI's perspective:
 *   native ID token (with expo-auth-session fallback) → backend verification →
 *   persisted session. Exposes a `loading`/`error` state so the screen can show
 *   a spinner and a clear error message. A `link_required` outcome (#4) is
 *   surfaced via `linkRequired` rather than `error` — it isn't a failure, it's
 *   a prompt to sign in with another method first and confirm the link.
 */
export function useGoogleAuth() {
  const [state, setState] = useState<State>(INITIAL);

  const signIn = useCallback(async (): Promise<SignedInResponse | null> => {
    setState({ loading: true, error: null, session: null, linkRequired: null });
    try {
      let idToken: string;
      try {
        idToken = await getGoogleIdToken();
      } catch (nativeErr) {
        // If the native module is unavailable (e.g. Expo Go), fall back to the
        // web auth-session flow. Genuine cancellations are not retried.
        if (nativeErr instanceof GoogleSignInError && nativeErr.code === 'cancelled') {
          throw nativeErr;
        }
        if (Platform.OS === 'web') throw nativeErr;
        // Surface the native failure before falling back — a silent fallback hides
        // root causes like DEVELOPER_ERROR (SHA-1/package mismatch in the console).
        console.warn(
          '[auth] Native Google Sign-In failed, falling back to auth-session:',
          nativeErr,
        );
        idToken = await getGoogleIdTokenViaAuthSession();
      }

      const outcome = await signInWithGoogle(idToken);
      if (outcome.status === 'link_required') {
        setState({ loading: false, error: null, session: null, linkRequired: outcome });
        return null;
      }

      await saveTokens(outcome.accessToken, outcome.refreshToken);
      setState({ loading: false, error: null, session: outcome, linkRequired: null });
      return outcome;
    } catch (err) {
      const message = resolveErrorMessage(err);
      setState({ loading: false, error: message, session: null, linkRequired: null });
      return null;
    }
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);

  return { ...state, signIn, reset };
}

function resolveErrorMessage(err: unknown): string {
  if (err instanceof ApiError || err instanceof GoogleSignInError) {
    return err.message;
  }
  return 'Something went wrong during sign-in. Please try again.';
}
