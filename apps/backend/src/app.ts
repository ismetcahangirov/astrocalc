import express, { type Express } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { createAuthService } from './auth/authService';
import { createGoogleVerifier } from './auth/googleVerifier';
import { createGoogleAuthRouter } from './auth/googleRoute';
import { createSessionRouter } from './auth/sessionRoute';
import { createSessionService } from './auth/sessionService';
import { createProfileRouter } from './profile/profileRoute';
import { createProfileService } from './profile/profileService';
import { InMemoryRevocationStore, type RevocationStore } from './auth/revocationStore';
import { RedisRevocationStore } from './auth/redisRevocationStore';
import { errorHandler } from './auth/errorHandler';
import { createTokenService } from './auth/tokens';
import { DrizzleUserRepository } from './db/drizzleUserRepository';
import { createDb } from './db/client';
import { createRedis } from './redis/client';
import { parseDurationToSeconds } from './config/duration';
import type { Env } from './config/env';

/**
 * Build the Express app from validated config. Wires the production Google
 * verifier (backed by `OAuth2Client`), the Drizzle repository and the JWT
 * token service into the auth routes, plus the refresh/rotation + revocation
 * routes backed by Upstash Redis (or an in-memory fallback for local dev).
 */
export function createApp(env: Env): Express {
  const db = createDb(env.DATABASE_URL);
  const repo = new DrizzleUserRepository(db);

  const verifyGoogleToken = createGoogleVerifier({
    client: new OAuth2Client(),
    allowedClientIds: env.GOOGLE_CLIENT_IDS,
  });

  const tokenService = createTokenService({
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtl: env.JWT_ACCESS_TTL,
    refreshTtl: env.JWT_REFRESH_TTL,
  });

  const authService = createAuthService({ verifyGoogleToken, repo, tokenService });

  const revocationStore = buildRevocationStore(env);
  const sessionService = createSessionService({
    tokenService,
    store: revocationStore,
    config: { refreshTtlSeconds: parseDurationToSeconds(env.JWT_REFRESH_TTL) },
  });

  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const profileService = createProfileService({ repo });

  app.use('/auth', createGoogleAuthRouter(authService));
  app.use('/auth', createSessionRouter(sessionService, { adminApiToken: env.ADMIN_API_TOKEN }));
  app.use('/profile', createProfileRouter(profileService, tokenService));

  // Terminal error handler — must be registered last.
  app.use(errorHandler);

  return app;
}

/**
 * Use the shared Upstash Redis blacklist when configured; otherwise fall back to
 * a per-process in-memory store (fine for local dev, but revocation would not be
 * shared across instances — hence the loud warning).
 */
function buildRevocationStore(env: Env): RevocationStore {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = createRedis(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
    return new RedisRevocationStore(redis);
  }
  // eslint-disable-next-line no-console
  console.warn(
    '[auth] UPSTASH_REDIS_REST_URL/TOKEN not set — using in-memory revocation store. ' +
      'Refresh-token revocation will NOT persist or be shared across instances.',
  );
  return new InMemoryRevocationStore();
}
