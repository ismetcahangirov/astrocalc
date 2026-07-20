import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../auth/errorHandler';
import { InMemoryUserRepository } from '../auth/repository';
import { createTokenService } from '../auth/tokens';
import { InMemoryNumerologyResultCache } from './numerologyResultCache';
import { createNumerologyRouter } from './numerologyRoute';
import { createNumerologyService } from './numerologyService';

const tokenService = createTokenService({
  accessSecret: 'a',
  refreshSecret: 'r',
  accessTtl: '15m',
  refreshTtl: '30d',
});

const KNOWN_NUMEROLOGY_DATA = {
  fullName: 'Ada Lovelace',
  birthDate: '1990-05-12',
};

async function buildApp() {
  const repo = new InMemoryUserRepository();
  const cache = new InMemoryNumerologyResultCache();
  const service = createNumerologyService({ repo, cache });

  const app = express();
  app.use(express.json());
  app.use('/numerology', createNumerologyRouter(service, tokenService));
  app.use(errorHandler);

  const user = await repo.createUserWithProfile({
    email: 'ada@example.com',
    googleId: 'g-1',
    displayName: 'Ada',
    avatarUrl: null,
    locale: 'en',
  });
  const { accessToken } = tokenService.issueTokens(user.id, 'session-1');

  return { app, repo, userId: user.id, accessToken };
}

describe('GET /numerology', () => {
  it('requires auth', async () => {
    const { app } = await buildApp();
    const res = await request(app).get('/numerology');
    expect(res.status).toBe(401);
  });

  it('returns 422 with the missing fields when the profile has no numerology data', async () => {
    const { app, accessToken } = await buildApp();
    const res = await request(app).get('/numerology').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('incomplete_profile');
    expect(res.body.error.missing).toContain('fullName');
  });

  it('returns 422 rather than computing from the displayName the profile already has', async () => {
    const { app, repo, userId, accessToken } = await buildApp();
    await repo.updateProfile(userId, { birthDate: '1990-05-12' });

    const res = await request(app).get('/numerology').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.missing).toEqual(['fullName']);
  });

  it('returns the computed profile with no Pro interpretation', async () => {
    const { app, repo, userId, accessToken } = await buildApp();
    await repo.updateProfile(userId, KNOWN_NUMEROLOGY_DATA);

    const res = await request(app)
      .get('/numerology')
      .query({ referenceDate: '2026-07-20' })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.interpretation).toBeNull();
    // Hand-checked: 1990 -> 1, month 05 -> 5, day 12 -> 3; 1 + 5 + 3 = 9.
    expect(res.body.profile.lifePath.value).toBe(9);
    expect(res.body.profile.personalMonth).toBe(7);
  });

  it('defaults referenceDate to the current date when the client sends none', async () => {
    const { app, repo, userId, accessToken } = await buildApp();
    await repo.updateProfile(userId, KNOWN_NUMEROLOGY_DATA);

    const res = await request(app).get('/numerology').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.profile.currentAge).toBeGreaterThan(0);
  });

  it('rejects a malformed referenceDate', async () => {
    const { app, repo, userId, accessToken } = await buildApp();
    await repo.updateProfile(userId, KNOWN_NUMEROLOGY_DATA);

    const res = await request(app)
      .get('/numerology')
      .query({ referenceDate: '20-07-2026' })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });
});
