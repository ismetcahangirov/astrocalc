import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../auth/errorHandler';
import { createTokenService } from '../auth/tokens';
import { InMemoryOrbConfigCache } from './cache';
import { createOrbConfigRouter } from './orbConfigRoute';
import { createOrbConfigService } from './orbConfigService';
import { InMemoryOrbConfigRepository } from './repository';

const tokenService = createTokenService({
  accessSecret: 'a',
  refreshSecret: 'r',
  accessTtl: '15m',
  refreshTtl: '30d',
});
const { accessToken } = tokenService.issueTokens('user-1', 'session-1');

const ADMIN_TOKEN = 'admin-secret-token-value';

function makeApp() {
  const repo = new InMemoryOrbConfigRepository();
  const cache = new InMemoryOrbConfigCache();
  const service = createOrbConfigService({ repo, cache, config: { cacheTtlSeconds: 3600 } });
  const app = express();
  app.use(express.json());
  app.use(
    '/orb-config',
    createOrbConfigRouter(service, tokenService, { adminApiToken: ADMIN_TOKEN }),
  );
  app.use(errorHandler);
  return { app, repo };
}

describe('GET /orb-config', () => {
  it('requires auth', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/orb-config');
    expect(res.status).toBe(401);
  });

  it('returns an empty override set when nothing has been configured', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/orb-config').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ orbs: {}, rows: [] });
  });
});

describe('PUT /orb-config/:aspectType (admin edit)', () => {
  it('rejects without the admin token', async () => {
    const { app } = makeApp();
    const res = await request(app).put('/orb-config/trine').send({ orbDegrees: 5 });
    expect(res.status).toBe(401);
  });

  it('rejects the wrong admin token', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .put('/orb-config/trine')
      .set('Authorization', 'Bearer wrong-token')
      .send({ orbDegrees: 5 });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown aspect type', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .put('/orb-config/quincunx')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ orbDegrees: 5 });
    expect(res.status).toBe(400);
  });

  it('rejects an out-of-range orb value', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .put('/orb-config/trine')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ orbDegrees: 45 });
    expect(res.status).toBe(400);
  });

  it('creates or overwrites the row with a valid admin token — no deploy required', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .put('/orb-config/trine')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ orbDegrees: 5, updatedBy: 'admin-1' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ aspectType: 'trine', orbDegrees: 5, updatedBy: 'admin-1' });

    // Immediately visible to a normal read — no deploy, no restart.
    const read = await request(app)
      .get('/orb-config')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(read.body.orbs).toEqual({ trine: 5 });
  });
});
