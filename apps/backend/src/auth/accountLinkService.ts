import type { AccountLinkTokenService } from './accountLinkToken';
import { AccountLinkMismatchError } from './errors';
import type { UserRepository } from './repository';
import type { TokenService } from './tokens';
import type { SignInResult } from './types';

export interface AccountLinkServiceDeps {
  repo: UserRepository;
  tokenService: TokenService;
  linkTokenService: AccountLinkTokenService;
}

export interface AccountLinkService {
  /**
   * Complete a pending Google-account link (#4). `authenticatedUserId` is
   * whoever the caller is signed in as *right now* (via `requireAuth` on the
   * confirming request) — it must be the same account the link token names,
   * so the confirmation can only come from someone who has actually proven
   * they own that account (e.g. by signing in with WhatsApp OTP).
   */
  confirmLink(authenticatedUserId: string, linkToken: string): Promise<SignInResult>;
}

export function createAccountLinkService(deps: AccountLinkServiceDeps): AccountLinkService {
  const { repo, tokenService, linkTokenService } = deps;

  return {
    async confirmLink(authenticatedUserId, linkToken) {
      const claims = linkTokenService.verify(linkToken);
      if (claims.candidateUserId !== authenticatedUserId) {
        throw new AccountLinkMismatchError();
      }

      const user = await repo.linkGoogleId(authenticatedUserId, claims.googleId);
      await repo.recordAccountLink({ userId: authenticatedUserId, googleId: claims.googleId });

      const session = await repo.createSession(authenticatedUserId);
      const { accessToken, refreshToken } = tokenService.issueTokens(
        authenticatedUserId,
        session.id,
      );

      return { user, accessToken, refreshToken, isNewUser: false };
    },
  };
}
