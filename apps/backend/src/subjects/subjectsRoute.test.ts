import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createSubjectsRouter } from './subjectsRoute';
import type { SubjectsService } from './subjectsService';
import type { Subject } from './types';
import { SubjectNotFoundError } from '../auth/errors';
import { createTokenService } from '../auth/tokens';
import { errorHandler } from '../auth/errorHandler';

const tokenService = createTokenService({
  accessSecret: 'a',
  refreshSecret: 'r',
  accessTtl: '15m',
  refreshTtl: '30d',
});
const { accessToken } = tokenService.issueTokens('user-1', 'session-1');
const auth = `Bearer ${accessToken}`;

const sampleSubject: Subject = {
  id: 'subject-1',
  userId: 'user-1',
  name: 'Grandma',
  birthDate: '1950-03-04',
  birthTime: null,
  birthTimeKnown: false,
  birthPlaceName: 'Baku',
  birthPlaceLat: 40.4093,
  birthPlaceLng: 49.8671,
  birthPlaceTimezone: 'Asia/Baku',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

function makeApp(service: Partial<SubjectsService>) {
  const full: SubjectsService = {
    list: async () => [],
    get: async () => sampleSubject,
    create: async () => sampleSubject,
    update: async () => sampleSubject,
    remove: async () => undefined,
    getChart: async () => ({ chart: {} as never, interpretation: null }),
    ...service,
  };
  const app = express();
  app.use(express.json());
  app.use('/subjects', createSubjectsRouter(full, tokenService));
  app.use(errorHandler);
  return app;
}

describe('subjects routes — auth', () => {
  it('rejects every route without a bearer token', async () => {
    const app = makeApp({});
    expect((await request(app).get('/subjects')).status).toBe(401);
    expect((await request(app).post('/subjects').send({ name: 'x' })).status).toBe(401);
    expect((await request(app).get('/subjects/subject-1')).status).toBe(401);
    expect((await request(app).delete('/subjects/subject-1')).status).toBe(401);
  });
});

describe('POST /subjects', () => {
  it('creates a subject and returns 201', async () => {
    const app = makeApp({ create: async () => sampleSubject });
    const res = await request(app).post('/subjects').set('Authorization', auth).send({
      name: 'Grandma',
      birthDate: '1950-03-04',
      birthPlaceLat: 40.4093,
      birthPlaceLng: 49.8671,
    });
    expect(res.status).toBe(201);
    expect(res.body.subject.name).toBe('Grandma');
  });

  it('rejects a missing name with 400', async () => {
    const app = makeApp({});
    const res = await request(app).post('/subjects').set('Authorization', auth).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('rejects an out-of-range coordinate with 400', async () => {
    const app = makeApp({});
    const res = await request(app)
      .post('/subjects')
      .set('Authorization', auth)
      .send({ name: 'Bad', birthPlaceLat: 999 });
    expect(res.status).toBe(400);
  });
});

describe('GET /subjects and /subjects/:id', () => {
  it('lists subjects', async () => {
    const app = makeApp({ list: async () => [sampleSubject] });
    const res = await request(app).get('/subjects').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.subjects).toHaveLength(1);
  });

  it('returns 404 for a subject the caller does not own', async () => {
    const app = makeApp({
      get: async () => {
        throw new SubjectNotFoundError();
      },
    });
    const res = await request(app).get('/subjects/nope').set('Authorization', auth);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('subject_not_found');
  });
});

describe('DELETE /subjects/:id', () => {
  it('returns 204 on success', async () => {
    const app = makeApp({ remove: async () => undefined });
    const res = await request(app).delete('/subjects/subject-1').set('Authorization', auth);
    expect(res.status).toBe(204);
  });
});

describe('GET /subjects/:id/natal-chart', () => {
  it('returns the computed chart', async () => {
    const app = makeApp({
      getChart: async () => ({ chart: { positions: [] } as never, interpretation: null }),
    });
    const res = await request(app)
      .get('/subjects/subject-1/natal-chart')
      .set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.chart).toBeDefined();
    expect(res.body.interpretation).toBeNull();
  });
});
