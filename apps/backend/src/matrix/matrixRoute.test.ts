import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../auth/errorHandler';
import { InMemoryUserRepository } from '../auth/repository';
import { createTokenService } from '../auth/tokens';
import { InMemoryMatrixResultCache } from './matrixResultCache';
import { createMatrixRouter } from './matrixRoute';
import { createMatrixService } from './matrixService';

const tokenService = createTokenService({
  accessSecret: 'a',
  refreshSecret: 'r',
  accessTtl: '15m',
  refreshTtl: '30d',
});

async function buildApp() {
  const repo = new InMemoryUserRepository();
  const cache = new InMemoryMatrixResultCache();
  const service = createMatrixService({ repo, cache });

  const app = express();
  app.use(express.json());
  app.use('/matrix', createMatrixRouter(service, tokenService));
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

describe('GET /matrix', () => {
  it('requires auth', async () => {
    const { app } = await buildApp();
    const res = await request(app).get('/matrix');
    expect(res.status).toBe(401);
  });

  it('returns 422 naming birthDate when the profile has none', async () => {
    const { app, accessToken } = await buildApp();
    const res = await request(app).get('/matrix').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('incomplete_profile');
    expect(res.body.error.missing).toEqual(['birthDate']);
  });

  it('returns the computed Matrix with no Pro interpretation', async () => {
    const { app, repo, userId, accessToken } = await buildApp();
    await repo.updateProfile(userId, { birthDate: '1990-11-22' });

    const res = await request(app).get('/matrix').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.interpretation).toBeNull();
    // Reference case from the method spec §6.
    expect(res.body.matrix.core).toMatchObject({
      day: 22,
      month: 11,
      year: 19,
      sum: 7,
      centre: 14,
    });
    expect(res.body.matrix.purposes.spiritual).toBe(15);
    expect(res.body.matrix.health).toHaveLength(7);
  });

  it('succeeds for a profile with only a birth date — no time, place or name', async () => {
    const { app, repo, userId, accessToken } = await buildApp();
    await repo.updateProfile(userId, { birthDate: '1990-05-12' });

    const res = await request(app).get('/matrix').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.matrix.core.day).toBe(12);
  });

  it('ignores a referenceDate query param rather than failing on it', async () => {
    // The route intentionally parses no query at all. A client that copies the
    // numerology call and sends a reference date should still get its Matrix —
    // the parameter is meaningless here, not invalid.
    const { app, repo, userId, accessToken } = await buildApp();
    await repo.updateProfile(userId, { birthDate: '1990-11-22' });

    const res = await request(app)
      .get('/matrix')
      .query({ referenceDate: 'nonsense' })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.matrix.core.centre).toBe(14);
  });

  it('serves an identical body on a repeat request', async () => {
    const { app, repo, userId, accessToken } = await buildApp();
    await repo.updateProfile(userId, { birthDate: '1987-01-29' });

    const first = await request(app).get('/matrix').set('Authorization', `Bearer ${accessToken}`);
    const second = await request(app).get('/matrix').set('Authorization', `Bearer ${accessToken}`);

    expect(second.body).toEqual(first.body);
  });
});
