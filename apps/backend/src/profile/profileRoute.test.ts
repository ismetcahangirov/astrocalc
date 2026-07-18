import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createProfileRouter } from './profileRoute';
import { createProfileService } from './profileService';
import { createTokenService } from '../auth/tokens';
import { InMemoryUserRepository } from '../auth/repository';
import { errorHandler } from '../auth/errorHandler';

const tokenService = createTokenService({
  accessSecret: 'a',
  refreshSecret: 'r',
  accessTtl: '15m',
  refreshTtl: '30d',
});

async function buildApp() {
  const repo = new InMemoryUserRepository();
  const service = createProfileService({ repo });
  const app = express();
  app.use(express.json());
  app.use('/profile', createProfileRouter(service, tokenService));
  app.use(errorHandler);

  const user = await repo.createUserWithProfile({
    email: 'ada@example.com',
    googleId: 'g-1',
    displayName: 'Ada',
    avatarUrl: null,
    locale: 'en',
  });
  const { accessToken } = tokenService.issueTokens(user.id, 'session-1');

  return { app, userId: user.id, accessToken };
}

describe('GET /profile', () => {
  it('requires auth', async () => {
    const { app } = await buildApp();
    const res = await request(app).get('/profile');
    expect(res.status).toBe(401);
  });

  it('returns the current user profile', async () => {
    const { app, accessToken } = await buildApp();
    const res = await request(app).get('/profile').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Ada');
  });
});

describe('PATCH /profile', () => {
  it('accepts avatarUrl and persists it', async () => {
    const { app, accessToken } = await buildApp();

    const res = await request(app)
      .patch('/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ avatarUrl: 'https://example.com/avatar.png' });

    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toBe('https://example.com/avatar.png');
  });

  it('rejects a non-URL avatarUrl', async () => {
    const { app, accessToken } = await buildApp();

    const res = await request(app)
      .patch('/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ avatarUrl: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });

  it('allows clearing avatarUrl with null', async () => {
    const { app, accessToken } = await buildApp();

    const res = await request(app)
      .patch('/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ avatarUrl: null });

    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toBeNull();
  });

  it('re-edits every onboarding field in one request, as the profile-edit screen does', async () => {
    const { app, accessToken } = await buildApp();

    const res = await request(app)
      .patch('/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        displayName: 'Ada Lovelace',
        avatarUrl: 'https://example.com/avatar.png',
        locale: 'az',
        birthDate: '1990-05-12',
        birthTime: '10:30',
        birthTimeKnown: true,
        birthPlaceName: 'Baku, Azerbaijan',
        birthPlaceLat: 40.4,
        birthPlaceLng: 49.8,
        birthPlaceTimezone: 'Asia/Baku',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      displayName: 'Ada Lovelace',
      avatarUrl: 'https://example.com/avatar.png',
      locale: 'az',
      birthDate: '1990-05-12',
      birthTime: '10:30',
      birthTimeKnown: true,
      birthPlaceName: 'Baku, Azerbaijan',
      birthPlaceLat: 40.4,
      birthPlaceLng: 49.8,
      birthPlaceTimezone: 'Asia/Baku',
    });
  });

  it('rejects a malformed birthDate', async () => {
    const { app, accessToken } = await buildApp();

    const res = await request(app)
      .patch('/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ birthDate: '05/12/1990' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
  });
});
