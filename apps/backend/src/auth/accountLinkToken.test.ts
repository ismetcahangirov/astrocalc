import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { createAccountLinkTokenService } from './accountLinkToken';
import { AccountLinkTokenError } from './errors';

const CLAIMS = { candidateUserId: 'user-1', googleId: 'g-1', email: 'user@example.com' };

describe('createAccountLinkTokenService', () => {
  it('issues a token that verifies back to the same claims', () => {
    const service = createAccountLinkTokenService({ secret: 'link-secret', ttlSeconds: 600 });

    const token = service.issue(CLAIMS);
    expect(service.verify(token)).toEqual(CLAIMS);
  });

  it('rejects a token signed with a different secret', () => {
    const service = createAccountLinkTokenService({ secret: 'link-secret', ttlSeconds: 600 });
    const other = createAccountLinkTokenService({ secret: 'someone-else', ttlSeconds: 600 });

    const token = other.issue(CLAIMS);
    expect(() => service.verify(token)).toThrow(AccountLinkTokenError);
  });

  it('rejects an expired token', () => {
    let clockMs = 1_700_000_000_000;
    const now = () => clockMs;
    const service = createAccountLinkTokenService({ secret: 'link-secret', ttlSeconds: 60, now });

    const token = service.issue(CLAIMS);
    clockMs += 61_000;

    expect(() => service.verify(token)).toThrow(AccountLinkTokenError);
  });

  it('rejects a malformed token', () => {
    const service = createAccountLinkTokenService({ secret: 'link-secret', ttlSeconds: 600 });
    expect(() => service.verify('not-a-jwt')).toThrow(AccountLinkTokenError);
  });

  it('rejects a token of a different type (e.g. a regular access/refresh token)', () => {
    const service = createAccountLinkTokenService({ secret: 'link-secret', ttlSeconds: 600 });
    // A structurally-valid JWT signed with the same secret, but missing the
    // `account_link` claims shape — must not be accepted.
    const foreignToken = jwt.sign({ type: 'access', sessionId: 's-1' }, 'link-secret', {
      subject: 'user-1',
    });
    expect(() => service.verify(foreignToken)).toThrow(AccountLinkTokenError);
  });
});
