import { describe, expect, it } from 'vitest';
import { createAccountLinkService } from './accountLinkService';
import { createAccountLinkTokenService } from './accountLinkToken';
import { createTokenService } from './tokens';
import { InMemoryUserRepository } from './repository';
import { AccountLinkMismatchError } from './errors';

const tokenService = createTokenService({
  accessSecret: 'a',
  refreshSecret: 'r',
  accessTtl: '15m',
  refreshTtl: '30d',
});

function build() {
  const repo = new InMemoryUserRepository();
  const linkTokenService = createAccountLinkTokenService({
    secret: 'link-secret',
    ttlSeconds: 600,
  });
  const service = createAccountLinkService({ repo, tokenService, linkTokenService });
  return { repo, service, linkTokenService };
}

describe('createAccountLinkService.confirmLink', () => {
  it('attaches the Google id to the authenticated account, records an audit entry, and issues a session', async () => {
    const { repo, service, linkTokenService } = build();
    const existing = await repo.createUserWithPhone({ phone: '+15551234567' });
    const linkToken = linkTokenService.issue({
      candidateUserId: existing.id,
      googleId: 'g-1',
      email: 'user@example.com',
    });

    const result = await service.confirmLink(existing.id, linkToken);

    expect(result.user.id).toBe(existing.id);
    expect(result.user.googleId).toBe('g-1');
    expect(result.isNewUser).toBe(false);
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(repo.accountLinkCount()).toBe(1);
  });

  it('rejects when the authenticated user does not match the link token', async () => {
    const { repo, service, linkTokenService } = build();
    const existing = await repo.createUserWithPhone({ phone: '+15551234567' });
    const linkToken = linkTokenService.issue({
      candidateUserId: existing.id,
      googleId: 'g-1',
      email: 'user@example.com',
    });

    await expect(service.confirmLink('someone-else', linkToken)).rejects.toBeInstanceOf(
      AccountLinkMismatchError,
    );
    expect(repo.accountLinkCount()).toBe(0);
  });

  it('rejects a malformed or expired link token', async () => {
    const { service } = build();
    await expect(service.confirmLink('user-1', 'not-a-jwt')).rejects.toThrow();
  });
});
