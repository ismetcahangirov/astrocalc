import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../auth/errorHandler';
import { createTokenService } from '../auth/tokens';
import { InMemoryInterpretationCache } from './cache';
import { createInterpretationService } from './interpretationService';
import { createInterpretationRouter } from './interpretationRoute';
import { InMemoryInterpretationRepository } from './repository';

const tokenService = createTokenService({
  accessSecret: 'a',
  refreshSecret: 'r',
  accessTtl: '15m',
  refreshTtl: '30d',
});
const { accessToken } = tokenService.issueTokens('user-1', 'session-1');

const ADMIN_TOKEN = 'admin-secret-token-value';

function makeApp() {
  const repo = new InMemoryInterpretationRepository();
  const cache = new InMemoryInterpretationCache();
  const service = createInterpretationService({ repo, cache, config: { cacheTtlSeconds: 3600 } });
  const app = express();
  app.use(express.json());
  app.use(
    '/interpretations',
    createInterpretationRouter(service, tokenService, { adminApiToken: ADMIN_TOKEN }),
  );
  app.use(errorHandler);
  return { app, repo };
}

describe('GET /interpretations/:category/:subjectKey', () => {
  it('returns 401 without a bearer token', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .get('/interpretations/planet-sign/sun-Aries')
      .query({ locale: 'en' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for an invalid locale', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .get('/interpretations/planet-sign/sun-Aries')
      .query({ locale: 'fr' })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 when no content exists', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .get('/interpretations/planet-sign/sun-Aries')
      .query({ locale: 'en' })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 200 with the resolved text', async () => {
    const { app, repo } = makeApp();
    await repo.upsert(
      { category: 'planet-sign', subjectKey: 'sun-Aries', locale: 'en' },
      { content: 'Bold self-expression.', updatedBy: null },
    );

    const res = await request(app)
      .get('/interpretations/planet-sign/sun-Aries')
      .query({ locale: 'en' })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      category: 'planet-sign',
      subjectKey: 'sun-Aries',
      content: 'Bold self-expression.',
      locale: 'en',
      isFallback: false,
    });
  });
});

describe('POST /interpretations/batch', () => {
  it('requires auth', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/interpretations/batch')
      .send({ locale: 'en', subjects: [] });
    expect(res.status).toBe(401);
  });

  it('rejects an empty subjects array', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/interpretations/batch')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ locale: 'en', subjects: [] });
    expect(res.status).toBe(400);
  });

  it('returns only the subjects that have content', async () => {
    const { app, repo } = makeApp();
    await repo.upsert(
      { category: 'planet-sign', subjectKey: 'sun-Aries', locale: 'en' },
      { content: 'sun content', updatedBy: null },
    );

    const res = await request(app)
      .post('/interpretations/batch')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        locale: 'en',
        subjects: [
          { category: 'planet-sign', subjectKey: 'sun-Aries' },
          { category: 'planet-sign', subjectKey: 'moon-Aries' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].subjectKey).toBe('sun-Aries');
  });
});

describe('POST /interpretations/for-chart', () => {
  const chart = {
    positions: [
      { body: 'sun', sign: 'Aries', longitude: 15 },
      { body: 'moon', sign: 'Cancer', longitude: 95 },
    ],
    cusps: Array.from({ length: 12 }, (_, i) => ({
      house: i + 1,
      longitude: i * 30,
      sign: 'Aries' as const,
      degree: 0,
    })),
    aspects: [{ bodyA: 'sun', bodyB: 'moon', type: 'square' }],
  };

  it('requires auth', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/interpretations/for-chart').send({ locale: 'en', chart });
    expect(res.status).toBe(401);
  });

  it('rejects an invalid chart shape', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/interpretations/for-chart')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        locale: 'en',
        chart: { positions: [{ body: 'sun', sign: 'NotASign', longitude: 15 }] },
      });
    expect(res.status).toBe(400);
  });

  it('composes planet-sign, planet-house, and aspect readings for the computed chart', async () => {
    const { app, repo } = makeApp();
    await repo.upsert(
      { category: 'planet-sign', subjectKey: 'sun-Aries', locale: 'en' },
      { content: 'Sun in Aries text.', updatedBy: null },
    );
    await repo.upsert(
      { category: 'planet-house', subjectKey: 'sun-1', locale: 'en' },
      { content: 'Sun in house 1 text.', updatedBy: null },
    );
    await repo.upsert(
      { category: 'aspect', subjectKey: 'square-moon-sun', locale: 'en' },
      { content: 'Sun square Moon text.', updatedBy: null },
    );

    const res = await request(app)
      .post('/interpretations/for-chart')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ locale: 'en', chart });

    expect(res.status).toBe(200);
    expect(res.body.planetSign).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subjectKey: 'sun-Aries', content: 'Sun in Aries text.' }),
      ]),
    );
    expect(res.body.planetHouse).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subjectKey: 'sun-1', content: 'Sun in house 1 text.' }),
      ]),
    );
    expect(res.body.aspects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subjectKey: 'square-moon-sun',
          content: 'Sun square Moon text.',
        }),
      ]),
    );
  });

  it('omits planet-house readings when the chart has no house cusps (birth time unknown)', async () => {
    const { app, repo } = makeApp();
    await repo.upsert(
      { category: 'planet-sign', subjectKey: 'sun-Aries', locale: 'en' },
      { content: 'Sun in Aries text.', updatedBy: null },
    );

    const res = await request(app)
      .post('/interpretations/for-chart')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ locale: 'en', chart: { positions: chart.positions } });

    expect(res.status).toBe(200);
    expect(res.body.planetHouse).toEqual([]);
  });
});

describe('PUT /interpretations/:category/:subjectKey/:locale (admin edit)', () => {
  it('rejects without the admin token', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .put('/interpretations/planet-sign/sun-Aries/en')
      .send({ content: 'new text' });
    expect(res.status).toBe(401);
  });

  it('rejects the wrong admin token', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .put('/interpretations/planet-sign/sun-Aries/en')
      .set('Authorization', 'Bearer wrong-token')
      .send({ content: 'new text' });
    expect(res.status).toBe(401);
  });

  it('creates or overwrites the row with a valid admin token — no deploy required', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .put('/interpretations/planet-sign/sun-Aries/en')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ content: 'Admin-edited text' });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe('Admin-edited text');

    // Immediately visible to a normal read — no deploy, no restart.
    const read = await request(app)
      .get('/interpretations/planet-sign/sun-Aries')
      .query({ locale: 'en' })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(read.body.content).toBe('Admin-edited text');
  });
});

describe('GET /interpretations/admin/missing', () => {
  it('rejects without the admin token', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/interpretations/admin/missing');
    expect(res.status).toBe(401);
  });

  it('reports the full required count on an empty store', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .get('/interpretations/admin/missing')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    // 465 astrology + 185 numerology + 682 matrix subjects (folded in by #82
    // and #80/#81), x4 locales.
    expect(res.body.count).toBe((10 * 12 + 10 * 12 + 45 * 5 + 185 + 682) * 4);
  });
});
