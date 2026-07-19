import { describe, expect, it } from 'vitest';
import { createAuthService } from './authService';
import { createAccountLinkTokenService } from './accountLinkToken';
import { createTokenService } from './tokens';
import { InMemoryUserRepository } from './repository';
import { TokenVerificationError } from './errors';
import type { GoogleProfile } from './types';

const profile: GoogleProfile = {
  googleId: 'g-1',
  email: 'user@example.com',
  emailVerified: true,
  name: 'Ada Lovelace',
  givenName: 'Ada',
  familyName: 'Lovelace',
  picture: 'https://example.com/a.png',
  locale: 'en',
};

const tokenService = createTokenService({
  accessSecret: 'a',
  refreshSecret: 'r',
  accessTtl: '15m',
  refreshTtl: '30d',
});

function build(verify: (idToken: string) => Promise<GoogleProfile>) {
  const repo = new InMemoryUserRepository();
  const linkTokenService = createAccountLinkTokenService({
    secret: 'link-secret',
    ttlSeconds: 600,
  });
  const service = createAuthService({
    verifyGoogleToken: verify,
    repo,
    tokenService,
    linkTokenService,
  });
  return { repo, service, linkTokenService };
}

describe('createAuthService.signInWithGoogle', () => {
  it('creates a new user + profile on first sign-in and flags isNewUser', async () => {
    const { repo, service } = build(async () => profile);

    const result = await service.signInWithGoogle('id-token');
    if (result.status !== 'signed_in') throw new Error('expected signed_in');

    expect(result.isNewUser).toBe(true);
    expect(result.user.email).toBe('user@example.com');
    expect(result.user.googleId).toBe('g-1');
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();

    // a profile row was created for the new user
    const stored = await repo.getProfile(result.user.id);
    expect(stored).toMatchObject({ displayName: 'Ada Lovelace', locale: 'en' });
  });

  it('opens a session for a returning user without creating a duplicate', async () => {
    const { repo, service } = build(async () => profile);

    const first = await service.signInWithGoogle('id-token');
    const second = await service.signInWithGoogle('id-token');
    if (first.status !== 'signed_in' || second.status !== 'signed_in') {
      throw new Error('expected signed_in');
    }

    expect(second.isNewUser).toBe(false);
    expect(second.user.id).toBe(first.user.id);
    expect(repo.userCount()).toBe(1);
    // each sign-in opens a fresh session
    expect(repo.sessionCount()).toBe(2);
  });

  it('never auto-links: a same-email existing account gets a link offer, not a session (#4)', async () => {
    const { repo, service, linkTokenService } = build(async () => profile);
    // pre-existing account created via another method (no google id yet)
    const existing = await repo.createUserWithProfile({
      email: 'user@example.com',
      googleId: null,
      displayName: 'Ada',
      avatarUrl: null,
      locale: 'en',
    });

    const result = await service.signInWithGoogle('id-token');
    if (result.status !== 'link_required') throw new Error('expected link_required');

    expect(result.maskedEmail).not.toBe('user@example.com');
    expect(result.maskedEmail).toContain('@example.com');
    // no session/tokens were issued, and the account is not linked yet
    expect(repo.userCount()).toBe(1);
    expect(repo.sessionCount()).toBe(0);
    const untouched = await repo.findByEmail('user@example.com');
    expect(untouched?.googleId).toBeNull();

    // the link token names the right candidate account
    const claims = linkTokenService.verify(result.linkToken);
    expect(claims).toMatchObject({ candidateUserId: existing.id, googleId: 'g-1' });
  });

  it('propagates verification failures without touching the database', async () => {
    const { repo, service } = build(async () => {
      throw new TokenVerificationError();
    });

    await expect(service.signInWithGoogle('bad')).rejects.toBeInstanceOf(TokenVerificationError);
    expect(repo.userCount()).toBe(0);
  });
});
