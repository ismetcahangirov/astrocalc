import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createGeocodingRouter } from './geocodingRoute';
import type { GeocodingService } from './geocodingService';
import { createTokenService } from '../auth/tokens';
import { errorHandler } from '../auth/errorHandler';

const tokenService = createTokenService({
  accessSecret: 'a',
  refreshSecret: 'r',
  accessTtl: '15m',
  refreshTtl: '30d',
});
const { accessToken } = tokenService.issueTokens('user-1', 'session-1');

function makeApp(service: Partial<GeocodingService>) {
  const full: GeocodingService = {
    search: async () => [],
    reverse: async () => ({ name: null, region: null, timezone: null }),
    ...service,
  };
  const app = express();
  app.use(express.json());
  app.use('/geocoding', createGeocodingRouter(full, tokenService));
  app.use(errorHandler);
  return app;
}

describe('GET /geocoding/search', () => {
  it('returns 401 without a bearer token', async () => {
    const app = makeApp({ search: async () => [] });
    const res = await request(app).get('/geocoding/search').query({ q: 'Bakı' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when q is missing', async () => {
    const app = makeApp({ search: async () => [] });
    const res = await request(app)
      .get('/geocoding/search')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('returns 200 with the service results', async () => {
    const results = [
      {
        id: 'baku',
        name: 'Bakı',
        region: 'Bakı şəhəri',
        lat: 40.4,
        lng: 49.9,
        source: 'az-local' as const,
      },
    ];
    const app = makeApp({ search: async () => results });

    const res = await request(app)
      .get('/geocoding/search')
      .query({ q: 'Bakı' })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual(results);
  });
});

describe('GET /geocoding/reverse', () => {
  it('returns 401 without a bearer token', async () => {
    const app = makeApp({});
    const res = await request(app).get('/geocoding/reverse').query({ lat: 40.4, lng: 49.8 });
    expect(res.status).toBe(401);
  });

  it('returns 400 when lat/lng are missing or out of range', async () => {
    const app = makeApp({});
    const auth = `Bearer ${accessToken}`;

    const missing = await request(app).get('/geocoding/reverse').set('Authorization', auth);
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('invalid_request');

    const outOfRange = await request(app)
      .get('/geocoding/reverse')
      .query({ lat: 200, lng: 49.8 })
      .set('Authorization', auth);
    expect(outOfRange.status).toBe(400);
  });

  it('returns 200 with the reverse-geocode result', async () => {
    const result = { name: 'Baku', region: 'Baku, Azerbaijan', timezone: 'Asia/Baku' };
    const app = makeApp({ reverse: async () => result });

    const res = await request(app)
      .get('/geocoding/reverse')
      .query({ lat: 40.4, lng: 49.8 })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(result);
  });
});
