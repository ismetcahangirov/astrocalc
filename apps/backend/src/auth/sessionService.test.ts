import { describe, expect, it } from 'vitest';
import { createSessionService } from './sessionService';
import { createTokenService } from './tokens';
import { InMemoryRevocationStore } from './revocationStore';
import { SessionRevokedError, TokenReuseError, AuthError } from './errors';

const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * A mutable clock shared by the token service and the session service so `iat`
 * and the revocation cutoff advance together — fully deterministic, no reliance
 * on wall-clock timing.
 */
function build(start = 1_700_000_000_000) {
  let clockMs = start;
  const now = () => clockMs;
  const advanceSeconds = (s: number) => {
    clockMs += s * 1000;
  };
  const tokenService = createTokenService({
    accessSecret: 'access-secret',
    refreshSecret: 'refresh-secret',
    accessTtl: '15m',
    refreshTtl: '30d',
    now,
  });
  const store = new InMemoryRevocationStore(now);
  const service = createSessionService({
    tokenService,
    store,
    config: { refreshTtlSeconds: REFRESH_TTL_SECONDS },
    now,
  });
  return { store, service, tokenService, advanceSeconds, now };
}

describe('createSessionService.refresh', () => {
  it('rotates: issues a new, different refresh token on every use', async () => {
    const { service, tokenService } = build();
    const { refreshToken } = tokenService.issueTokens('user-1', 'session-1');

    const rotated = await service.refresh(refreshToken);

    expect(rotated.accessToken).toBeTruthy();
    expect(rotated.refreshToken).toBeTruthy();
    expect(rotated.refreshToken).not.toBe(refreshToken);
    const claims = tokenService.verifyRefreshToken(rotated.refreshToken);
    expect(claims).toMatchObject({ userId: 'user-1', sessionId: 'session-1' });
  });

  it('invalidates the old token once rotated (single-use)', async () => {
    const { service, tokenService } = build();
    const { refreshToken } = tokenService.issueTokens('user-1', 'session-1');

    await service.refresh(refreshToken); // consumes it

    // replaying the same (now consumed) token is treated as theft
    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(TokenReuseError);
  });

  it("theft response: replaying a rotated token invalidates ALL the user's sessions", async () => {
    const { service, tokenService } = build();
    // two independent sessions for the same user (e.g. phone + tablet)
    const a = tokenService.issueTokens('user-1', 'session-a');
    const b = tokenService.issueTokens('user-1', 'session-b');

    // session A rotates normally, yielding a fresh token
    const aRotated = await service.refresh(a.refreshToken);

    // attacker replays the stolen, already-rotated original token from A
    await expect(service.refresh(a.refreshToken)).rejects.toBeInstanceOf(TokenReuseError);

    // now every session of user-1 is dead: the just-rotated A token AND session B
    await expect(service.refresh(aRotated.refreshToken)).rejects.toBeInstanceOf(
      SessionRevokedError,
    );
    await expect(service.refresh(b.refreshToken)).rejects.toBeInstanceOf(SessionRevokedError);
  });

  it('does not affect other users when one user is compromised', async () => {
    const { service, tokenService } = build();
    const victim = tokenService.issueTokens('victim', 'session-v');
    const bystander = tokenService.issueTokens('bystander', 'session-x');

    await service.refresh(victim.refreshToken);
    await expect(service.refresh(victim.refreshToken)).rejects.toBeInstanceOf(TokenReuseError);

    // the unrelated user can still rotate freely
    const ok = await service.refresh(bystander.refreshToken);
    expect(ok.refreshToken).toBeTruthy();
  });

  it('rejects a token for a user whose sessions were revoked (admin ban)', async () => {
    const { service, tokenService, advanceSeconds } = build();
    const { refreshToken } = tokenService.issueTokens('banned-user', 'session-1');

    advanceSeconds(5); // ban happens strictly after issuance
    await service.revokeAllForUser('banned-user');

    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(SessionRevokedError);
  });

  it('lets a user sign in again (new token) after a revocation', async () => {
    const { service, tokenService, advanceSeconds } = build();
    const first = tokenService.issueTokens('user-1', 'session-1');

    advanceSeconds(5);
    await service.revokeAllForUser('user-1');
    await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(SessionRevokedError);

    // a fresh login mints a token issued after the cutoff — it works
    advanceSeconds(5);
    const fresh = tokenService.issueTokens('user-1', 'session-2');
    const rotated = await service.refresh(fresh.refreshToken);
    expect(rotated.refreshToken).toBeTruthy();
  });

  it('rejects a structurally invalid / forged refresh token', async () => {
    const { service } = build();
    await expect(service.refresh('not-a-jwt')).rejects.toBeInstanceOf(AuthError);
  });

  it('rejects an access token presented as a refresh token', async () => {
    const { service, tokenService } = build();
    const { accessToken } = tokenService.issueTokens('user-1', 'session-1');
    await expect(service.refresh(accessToken)).rejects.toBeInstanceOf(AuthError);
  });
});

describe('createSessionService.revokeAllForUser', () => {
  it('records a per-user cutoff that blacklists pre-existing tokens', async () => {
    const { store, service, now } = build();

    await service.revokeAllForUser('user-9');

    const cutoff = await store.getUserRevokedAt('user-9');
    expect(cutoff).toBe(Math.floor(now() / 1000));
  });
});
