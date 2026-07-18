import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createGoogleAuthRouter } from './googleRoute';
import { createAuthService } from './authService';
import { createTokenService } from './tokens';
import { InMemoryUserRepository } from './repository';
import { TokenVerificationError } from './errors';
import { errorHandler } from './errorHandler';
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

function makeApp(verify: (idToken: string) => Promise<GoogleProfile>) {
  const repo = new InMemoryUserRepository();
  const service = createAuthService({ verifyGoogleToken: verify, repo, tokenService });
  const app = express();
  app.use(express.json());
  app.use('/auth', createGoogleAuthRouter(service));
  app.use(errorHandler);
  return app;
}

describe('POST /auth/google', () => {
  it('returns 200 with user + tokens on success', async () => {
    const app = makeApp(async () => profile);

    const res = await request(app).post('/auth/google').send({ idToken: 'valid' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('user@example.com');
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.isNewUser).toBe(true);
  });

  it('returns 400 with a clear message when idToken is missing', async () => {
    const app = makeApp(async () => profile);

    const res = await request(app).post('/auth/google').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
    expect(typeof res.body.error.message).toBe('string');
  });

  it('returns 401 with a clear message when verification fails', async () => {
    const app = makeApp(async () => {
      throw new TokenVerificationError('Google token verification failed');
    });

    const res = await request(app).post('/auth/google').send({ idToken: 'bad' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('google_token_invalid');
    expect(res.body.error.message).toMatch(/verification failed/i);
  });
});
