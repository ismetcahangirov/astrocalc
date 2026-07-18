import { describe, expect, it } from 'vitest';
import { createGoogleVerifier } from './googleVerifier';
import { TokenVerificationError } from './errors';
import type { GoogleTicketVerifier, GoogleTokenPayload } from './types';

const CLIENT_ID = 'web-client-id.apps.googleusercontent.com';

function fakeClient(
  payload: Partial<GoogleTokenPayload> | undefined,
  opts: { throwErr?: Error } = {},
): { client: GoogleTicketVerifier; calls: { idToken: string; audience: string | string[] }[] } {
  const calls: { idToken: string; audience: string | string[] }[] = [];
  const client: GoogleTicketVerifier = {
    async verifyIdToken(o) {
      calls.push(o);
      if (opts.throwErr) throw opts.throwErr;
      return { getPayload: () => payload as GoogleTokenPayload | undefined };
    },
  };
  return { client, calls };
}

const validPayload: GoogleTokenPayload = {
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  sub: '1234567890',
  email: 'user@example.com',
  email_verified: true,
  name: 'Ada Lovelace',
  given_name: 'Ada',
  family_name: 'Lovelace',
  picture: 'https://example.com/a.png',
  locale: 'en',
  exp: 9999999999,
};

describe('createGoogleVerifier', () => {
  it('returns a normalized profile for a valid token', async () => {
    const { client, calls } = fakeClient(validPayload);
    const verify = createGoogleVerifier({ client, allowedClientIds: [CLIENT_ID] });

    const profile = await verify('a.valid.token');

    expect(profile).toEqual({
      googleId: '1234567890',
      email: 'user@example.com',
      emailVerified: true,
      name: 'Ada Lovelace',
      givenName: 'Ada',
      familyName: 'Lovelace',
      picture: 'https://example.com/a.png',
      locale: 'en',
    });
    // audience must be passed to the library so it enforces the `aud` claim
    expect(calls[0]?.audience).toEqual([CLIENT_ID]);
    expect(calls[0]?.idToken).toBe('a.valid.token');
  });

  it('rejects a token whose issuer is not Google', async () => {
    const { client } = fakeClient({ ...validPayload, iss: 'https://evil.example.com' });
    const verify = createGoogleVerifier({ client, allowedClientIds: [CLIENT_ID] });

    await expect(verify('t')).rejects.toBeInstanceOf(TokenVerificationError);
  });

  it('accepts the bare accounts.google.com issuer', async () => {
    const { client } = fakeClient({ ...validPayload, iss: 'accounts.google.com' });
    const verify = createGoogleVerifier({ client, allowedClientIds: [CLIENT_ID] });

    await expect(verify('t')).resolves.toMatchObject({ googleId: '1234567890' });
  });

  it('rejects a token whose email is not verified', async () => {
    const { client } = fakeClient({ ...validPayload, email_verified: false });
    const verify = createGoogleVerifier({ client, allowedClientIds: [CLIENT_ID] });

    await expect(verify('t')).rejects.toBeInstanceOf(TokenVerificationError);
  });

  it('rejects a token with no payload', async () => {
    const { client } = fakeClient(undefined);
    const verify = createGoogleVerifier({ client, allowedClientIds: [CLIENT_ID] });

    await expect(verify('t')).rejects.toBeInstanceOf(TokenVerificationError);
  });

  it('rejects a token whose aud is not an allowed client id (defense in depth)', async () => {
    const { client } = fakeClient({ ...validPayload, aud: 'someone-elses-client-id' });
    const verify = createGoogleVerifier({ client, allowedClientIds: [CLIENT_ID] });

    await expect(verify('t')).rejects.toBeInstanceOf(TokenVerificationError);
  });

  it('wraps library errors (expired / bad signature) as TokenVerificationError', async () => {
    const { client } = fakeClient(validPayload, {
      throwErr: new Error('Token used too late, 1700000000 > 1699999999'),
    });
    const verify = createGoogleVerifier({ client, allowedClientIds: [CLIENT_ID] });

    await expect(verify('t')).rejects.toBeInstanceOf(TokenVerificationError);
  });

  it('requires at least one allowed client id at construction time', () => {
    const { client } = fakeClient(validPayload);
    expect(() => createGoogleVerifier({ client, allowedClientIds: [] })).toThrow();
  });
});
