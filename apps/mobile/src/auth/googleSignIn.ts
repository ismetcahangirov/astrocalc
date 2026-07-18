import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { config } from '../config';

/** Raised when the native Google Sign-In flow fails or is cancelled. */
export class GoogleSignInError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'GoogleSignInError';
  }
}

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  GoogleSignin.configure({
    // `webClientId` is what makes Google return an ID token whose `aud` is the
    // web client id — the value the backend verifies against.
    webClientId: config.googleWebClientId,
    iosClientId: config.googleIosClientId || undefined,
    offlineAccess: false,
  });
  configured = true;
}

/**
 * Run the native Google Sign-In flow (iOS + Android) and return the ID token.
 * Requires a custom dev client / production build — not available in Expo Go.
 */
export async function getGoogleIdToken(): Promise<string> {
  ensureConfigured();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      // The user dismissed the sheet without picking an account.
      throw new GoogleSignInError('cancelled', 'Sign-in was cancelled.');
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      throw new GoogleSignInError(
        'no_id_token',
        'Google did not return an ID token. Check the configured web client id.',
      );
    }
    return idToken;
  } catch (err) {
    if (err instanceof GoogleSignInError) throw err;
    if (isErrorWithCode(err)) {
      switch (err.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          throw new GoogleSignInError('cancelled', 'Sign-in was cancelled.');
        case statusCodes.IN_PROGRESS:
          throw new GoogleSignInError('in_progress', 'A sign-in is already in progress.');
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new GoogleSignInError(
            'play_services_unavailable',
            'Google Play Services is unavailable or out of date.',
          );
        default:
          throw new GoogleSignInError('native_error', 'Google Sign-In failed. Please try again.');
      }
    }
    throw new GoogleSignInError('native_error', 'Google Sign-In failed. Please try again.');
  }
}

export async function signOutGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Best-effort: ignore native sign-out errors.
  }
}
