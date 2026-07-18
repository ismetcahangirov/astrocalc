import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { ApiError, signInWithGoogle, type SignInResponse } from '../api/authApi';
import { getGoogleIdToken, GoogleSignInError } from './googleSignIn';
import { getGoogleIdTokenViaAuthSession } from './googleSignInFallback';
import { saveTokens } from './tokenStorage';

interface State {
  loading: boolean;
  error: string | null;
  session: SignInResponse | null;
}

const INITIAL: State = { loading: false, error: null, session: null };

/**
 * Drives the full Google sign-in flow from the UI's perspective:
 *   native ID token (with expo-auth-session fallback) → backend verification →
 *   persisted session. Exposes a `loading`/`error` state so the screen can show
 *   a spinner and a clear error message.
 */
export function useGoogleAuth() {
  const [state, setState] = useState<State>(INITIAL);

  const signIn = useCallback(async (): Promise<SignInResponse | null> => {
    setState({ loading: true, error: null, session: null });
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
        idToken = await getGoogleIdTokenViaAuthSession();
      }

      const session = await signInWithGoogle(idToken);
      await saveTokens(session.accessToken, session.refreshToken);
      setState({ loading: false, error: null, session });
      return session;
    } catch (err) {
      const message = resolveErrorMessage(err);
      setState({ loading: false, error: message, session: null });
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
