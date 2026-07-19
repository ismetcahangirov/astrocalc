import type { AccountLinkTokenService } from './accountLinkToken';
import type { UserRepository } from './repository';
import type { TokenService } from './tokens';
import type { GoogleSignInOutcome, VerifyGoogleToken } from './types';

export interface AuthServiceDeps {
  verifyGoogleToken: VerifyGoogleToken;
  repo: UserRepository;
  tokenService: TokenService;
  linkTokenService: AccountLinkTokenService;
}

export interface AuthService {
  signInWithGoogle(idToken: string): Promise<GoogleSignInOutcome>;
}

/**
 * Orchestrates Google sign-in:
 *   1. verify the ID token → trusted profile
 *   2. find the user by Google id; else, if an existing account shares the
 *      email (signed up via another method first), offer a link instead of
 *      creating a duplicate or auto-linking (#4 — see the acceptance
 *      criteria: linking always requires explicit user confirmation); else
 *      create a brand-new user + profile record
 *   3. open a fresh session and issue an access + refresh token pair
 */
export function createAuthService(deps: AuthServiceDeps): AuthService {
  const { verifyGoogleToken, repo, tokenService, linkTokenService } = deps;

  return {
    async signInWithGoogle(idToken: string): Promise<GoogleSignInOutcome> {
      // Throws TokenVerificationError before any DB work on an untrusted token.
      const profile = await verifyGoogleToken(idToken);

      let isNewUser = false;
      let user = await repo.findByGoogleId(profile.googleId);

      if (!user) {
        const existingByEmail = await repo.findByEmail(profile.email);
        if (existingByEmail) {
          // Same email, but not yet linked to this Google identity — never link
          // automatically (email/phone spoofing risk). The caller must confirm
          // from a session already authenticated as `existingByEmail`.
          const linkToken = linkTokenService.issue({
            candidateUserId: existingByEmail.id,
            googleId: profile.googleId,
            email: profile.email,
          });
          return { status: 'link_required', linkToken, maskedEmail: maskEmail(profile.email) };
        }
        user = await repo.createUserWithProfile({
          email: profile.email,
          googleId: profile.googleId,
          displayName: profile.name,
          avatarUrl: profile.picture,
          locale: profile.locale,
        });
        isNewUser = true;
      }

      const session = await repo.createSession(user.id);
      const { accessToken, refreshToken } = tokenService.issueTokens(user.id, session.id);

      return { status: 'signed_in', user, accessToken, refreshToken, isNewUser };
    },
  };
}

/** `jo****@example.com` — enough for the user to recognize the account, not enough to leak it. */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}
