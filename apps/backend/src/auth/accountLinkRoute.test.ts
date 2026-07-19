import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAccountLinkRouter } from './accountLinkRoute';
import { createAccountLinkService } from './accountLinkService';
import { createAccountLinkTokenService } from './accountLinkToken';
import { createTokenService } from './tokens';
import { InMemoryUserRepository } from './repository';
import { errorHandler } from './errorHandler';

const tokenService = createTokenService({
  accessSecret: 'a',
  refreshSecret: 'r',
  accessTtl: '15m',
  refreshTtl: '30d',
});

function makeApp() {
  const repo = new InMemoryUserRepository();
  const linkTokenService = createAccountLinkTokenService({
    secret: 'link-secret',
    ttlSeconds: 600,
  });
  const service = createAccountLinkService({ repo, tokenService, linkTokenService });
  const app = express();
  app.use(express.json());
  app.use('/auth', createAccountLinkRouter(service, tokenService));
  app.use(errorHandler);
  return { app, repo, linkTokenService };
}

describe('POST /auth/link/confirm', () => {
  it('links the Google id to the authenticated (existing) account and returns a fresh session', async () => {
    const { app, repo, linkTokenService } = makeApp();
    const existing = await repo.createUserWithPhone({ phone: '+15551234567' });
    const existingSession = await repo.createSession(existing.id);
    const { accessToken } = tokenService.issueTokens(existing.id, existingSession.id);
    const linkToken = linkTokenService.issue({
      candidateUserId: existing.id,
      googleId: 'g-1',
      email: 'user@example.com',
    });

    const res = await request(app)
      .post('/auth/link/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ linkToken });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(existing.id);
    expect(res.body.user.googleId).toBe('g-1');
    expect(res.body.accessToken).toBeTruthy();
  });

  it('rejects without a bearer token', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/auth/link/confirm').send({ linkToken: 'x' });
    expect(res.status).toBe(401);
  });

  it("rejects when the link token names a different account than the caller's session", async () => {
    const { app, repo, linkTokenService } = makeApp();
    const existing = await repo.createUserWithPhone({ phone: '+15551234567' });
    const impostor = await repo.createUserWithPhone({ phone: '+15559999999' });
    const impostorSession = await repo.createSession(impostor.id);
    const { accessToken } = tokenService.issueTokens(impostor.id, impostorSession.id);
    const linkToken = linkTokenService.issue({
      candidateUserId: existing.id,
      googleId: 'g-1',
      email: 'user@example.com',
    });

    const res = await request(app)
      .post('/auth/link/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ linkToken });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('account_link_mismatch');
  });
});
