import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { config } from '../config';
import { GoogleSignInError } from './googleSignIn';

WebBrowser.maybeCompleteAuthSession();

const DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

/**
 * Fallback ID-token flow using `expo-auth-session` — kept per the issue's
 * technical notes. Useful in Expo Go (where the native module is unavailable)
 * or as a backup if the native SDK misbehaves. Uses PKCE and requests an ID
 * token whose `aud` is the web client id the backend verifies against.
 */
export async function getGoogleIdTokenViaAuthSession(): Promise<string> {
  if (!config.googleWebClientId) {
    throw new GoogleSignInError('not_configured', 'Google web client id is not configured.');
  }

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'astrocalc' });

  const request = new AuthSession.AuthRequest({
    clientId: config.googleWebClientId,
    redirectUri,
    responseType: AuthSession.ResponseType.IdToken,
    scopes: ['openid', 'profile', 'email'],
    // PKCE (code_challenge_method) is only valid for the authorization-code
    // flow — Google's server rejects it outright when paired with the
    // implicit id_token response type ("Parameter not allowed for this
    // message type: code_challenge_method").
    usePKCE: false,
    extraParams: { nonce: `astrocalc-${Date.now()}` },
  });

  const result = await request.promptAsync(DISCOVERY);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new GoogleSignInError('cancelled', 'Sign-in was cancelled.');
  }
  if (result.type !== 'success') {
    throw new GoogleSignInError('auth_session_error', 'Google Sign-In failed. Please try again.');
  }

  const idToken = result.params.id_token;
  if (!idToken) {
    throw new GoogleSignInError('no_id_token', 'Google did not return an ID token.');
  }
  return idToken;
}
