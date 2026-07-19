import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../auth/errorHandler';
import { InMemoryUserRepository } from '../auth/repository';
import { createTokenService } from '../auth/tokens';
import { InMemoryOrbConfigCache } from '../orbConfig/cache';
import { createOrbConfigService } from '../orbConfig/orbConfigService';
import { InMemoryOrbConfigRepository } from '../orbConfig/repository';
import { InMemoryChartResultCache } from './chartResultCache';
import { createNatalChartRouter } from './natalChartRoute';
import { createNatalChartService } from './natalChartService';

const tokenService = createTokenService({
  accessSecret: 'a',
  refreshSecret: 'r',
  accessTtl: '15m',
  refreshTtl: '30d',
});

const KNOWN_BIRTH_DATA = {
  birthDate: '1990-05-12',
  birthTime: '10:30',
  birthTimeKnown: true,
  birthPlaceName: 'Baku, Azerbaijan',
  birthPlaceLat: 40.4093,
  birthPlaceLng: 49.8671,
  birthPlaceTimezone: 'Asia/Baku',
};

async function buildApp() {
  const repo = new InMemoryUserRepository();
  const cache = new InMemoryChartResultCache();
  const orbConfig = createOrbConfigService({
    repo: new InMemoryOrbConfigRepository(),
    cache: new InMemoryOrbConfigCache(),
    config: { cacheTtlSeconds: 3600 },
  });
  const service = createNatalChartService({ repo, cache, orbConfig });

  const app = express();
  app.use(express.json());
  app.use('/natal-chart', createNatalChartRouter(service, tokenService));
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

describe('GET /natal-chart', () => {
  it('requires auth', async () => {
    const { app } = await buildApp();
    const res = await request(app).get('/natal-chart');
    expect(res.status).toBe(401);
  });

  it('returns 422 with the missing fields when the profile has no birth data', async () => {
    const { app, accessToken } = await buildApp();
    const res = await request(app)
      .get('/natal-chart')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('incomplete_profile');
    expect(res.body.error.missing).toContain('birthDate');
  });

  it('returns the computed chart with no Pro interpretation', async () => {
    const { app, repo, userId, accessToken } = await buildApp();
    await repo.updateProfile(userId, KNOWN_BIRTH_DATA);

    const res = await request(app)
      .get('/natal-chart')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.interpretation).toBeNull();
    expect(res.body.chart.positions.length).toBeGreaterThan(0);
    expect(res.body.chart.houses).not.toBeNull();
  });
});

describe('POST /natal-chart/sync', () => {
  it('requires auth', async () => {
    const { app } = await buildApp();
    const res = await request(app).post('/natal-chart/sync').send({ chart: {} });
    expect(res.status).toBe(401);
  });

  it('rejects a request body with no chart field', async () => {
    const { app, accessToken } = await buildApp();
    const res = await request(app)
      .post('/natal-chart/sync')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('recomputes and caches the chart, ignoring the submitted payload content', async () => {
    const { app, repo, userId, accessToken } = await buildApp();
    await repo.updateProfile(userId, KNOWN_BIRTH_DATA);

    const syncRes = await request(app)
      .post('/natal-chart/sync')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ chart: { bogus: true } });
    expect(syncRes.status).toBe(200);
    expect(syncRes.body).toEqual({ ok: true });

    const readRes = await request(app)
      .get('/natal-chart')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(readRes.body.chart.positions.length).toBeGreaterThan(0);
  });

  it('returns 422 the same way GET does when birth data is missing', async () => {
    const { app, accessToken } = await buildApp();
    const res = await request(app)
      .post('/natal-chart/sync')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ chart: {} });
    expect(res.status).toBe(422);
  });
});
