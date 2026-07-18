import type { UserRepository } from './repository';
import type { TokenService } from './tokens';
import type { SignInResult, VerifyGoogleToken } from './types';

export interface AuthServiceDeps {
  verifyGoogleToken: VerifyGoogleToken;
  repo: UserRepository;
  tokenService: TokenService;
}

export interface AuthService {
  signInWithGoogle(idToken: string): Promise<SignInResult>;
}

/**
 * Orchestrates Google sign-in:
 *   1. verify the ID token → trusted profile
 *   2. find the user by Google id; else link an existing email account; else
 *      create a brand-new user + profile record
 *   3. open a fresh session and issue an access + refresh token pair
 */
export function createAuthService(deps: AuthServiceDeps): AuthService {
  const { verifyGoogleToken, repo, tokenService } = deps;

  return {
    async signInWithGoogle(idToken: string): Promise<SignInResult> {
      // Throws TokenVerificationError before any DB work on an untrusted token.
      const profile = await verifyGoogleToken(idToken);

      let isNewUser = false;
      let user = await repo.findByGoogleId(profile.googleId);

      if (!user) {
        const existingByEmail = await repo.findByEmail(profile.email);
        if (existingByEmail) {
          // Same person signed up via another method first — link the accounts.
          user = await repo.linkGoogleId(existingByEmail.id, profile.googleId);
        } else {
          user = await repo.createUserWithProfile({
            email: profile.email,
            googleId: profile.googleId,
            displayName: profile.name,
            avatarUrl: profile.picture,
            locale: profile.locale,
          });
          isNewUser = true;
        }
      }

      const session = await repo.createSession(user.id);
      const { accessToken, refreshToken } = tokenService.issueTokens(user.id, session.id);

      return { user, accessToken, refreshToken, isNewUser };
    },
  };
}
