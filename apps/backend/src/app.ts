import express, { type Express } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { createAccountLinkService } from './auth/accountLinkService';
import { createAccountLinkTokenService } from './auth/accountLinkToken';
import { createAccountLinkRouter } from './auth/accountLinkRoute';
import { createAuthService } from './auth/authService';
import { createGoogleVerifier } from './auth/googleVerifier';
import { createGoogleAuthRouter } from './auth/googleRoute';
import { createSessionRouter } from './auth/sessionRoute';
import { createSessionService } from './auth/sessionService';
import { createProfileRouter } from './profile/profileRoute';
import { createProfileService } from './profile/profileService';
import { InMemoryChartResultCache, type ChartResultCache } from './chart/chartResultCache';
import { RedisChartResultCache } from './chart/redisChartResultCache';
import { InMemoryRevocationStore, type RevocationStore } from './auth/revocationStore';
import { RedisRevocationStore } from './auth/redisRevocationStore';
import { errorHandler } from './auth/errorHandler';
import { createTokenService } from './auth/tokens';
import { DrizzleUserRepository } from './db/drizzleUserRepository';
import { DrizzleAccountRepository } from './db/drizzleAccountRepository';
import { DrizzleInterpretationRepository } from './db/drizzleInterpretationRepository';
import {
  InMemoryInterpretationCache,
  RedisInterpretationCache,
  type InterpretationCache,
} from './interpretations/cache';
import { createInterpretationService } from './interpretations/interpretationService';
import { createInterpretationRouter } from './interpretations/interpretationRoute';
import { DrizzleOrbConfigRepository } from './db/drizzleOrbConfigRepository';
import {
  InMemoryOrbConfigCache,
  RedisOrbConfigCache,
  type OrbConfigCache,
} from './orbConfig/cache';
import { createOrbConfigService } from './orbConfig/orbConfigService';
import { createOrbConfigRouter } from './orbConfig/orbConfigRoute';
import { createNatalChartService } from './chart/natalChartService';
import { createNatalChartRouter } from './chart/natalChartRoute';
import { createNumerologyService } from './numerology/numerologyService';
import { createNumerologyRouter } from './numerology/numerologyRoute';
import {
  InMemoryNumerologyResultCache,
  type NumerologyResultCache,
} from './numerology/numerologyResultCache';
import { RedisNumerologyResultCache } from './numerology/redisNumerologyResultCache';
import { createSubjectsService } from './subjects/subjectsService';
import { createSubjectsRouter } from './subjects/subjectsRoute';
import { DrizzleSubjectRepository } from './db/drizzleSubjectRepository';
import { createAccountService, type AccountService } from './account/accountService';
import { createAccountRouter } from './account/accountRoute';
import { InMemoryObjectStorage, type ObjectStorage } from './account/objectStorage';
import { R2ObjectStorage } from './account/r2ObjectStorage';
import { InlineExportQueue, type ExportQueue } from './account/exportQueue';
import { QStashExportQueue } from './account/qstashExportQueue';
import { LogExportNotifier } from './account/exportNotifier';
import { InMemoryOtpStore, type OtpStore } from './otp/otpStore';
import { RedisOtpStore } from './otp/redisOtpStore';
import { createOtpService } from './otp/otpService';
import { createOtpRouter } from './otp/otpRoute';
import { createGeocodingRouter } from './geocoding/geocodingRoute';
import { createGeocodingService } from './geocoding/geocodingService';
import {
  InMemoryGeocodeCache,
  RedisGeocodeCache,
  type GeocodeCache,
} from './geocoding/geocodeCache';
import { createNominatimClient } from './geocoding/nominatimClient';
import {
  InMemoryNominatimRateLimiter,
  RedisNominatimRateLimiter,
  type NominatimRateLimiter,
} from './geocoding/nominatimRateLimiter';
import {
  FakeWhatsAppSender,
  createMetaWhatsAppSender,
  type WhatsAppSender,
} from './otp/whatsappSender';
import { createLoggingAdminAlerter } from './otp/adminAlerter';
import {
  createSlidingWindowRateLimiter,
  InMemoryRateLimiter,
  type RateLimiter,
} from './security/rateLimiter';
import { createDb } from './db/client';
import { createRedis } from './redis/client';
import type { RedisClient } from './redis/client';
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

  // Account linking (#4): a Google sign-in that matches an existing account's
  // email never auto-links — it mints this short-lived token instead, and the
  // caller must confirm via `POST /auth/link/confirm` while authenticated as
  // that existing account (e.g. having just signed in with WhatsApp OTP).
  if (!env.ACCOUNT_LINK_TOKEN_SECRET) {
    console.warn(
      '[auth] ACCOUNT_LINK_TOKEN_SECRET not set — falling back to JWT_ACCESS_SECRET. ' +
        'Set a dedicated secret in production.',
    );
  }
  const linkTokenService = createAccountLinkTokenService({
    secret: env.ACCOUNT_LINK_TOKEN_SECRET ?? env.JWT_ACCESS_SECRET,
    ttlSeconds: env.ACCOUNT_LINK_TOKEN_TTL_SECONDS,
  });

  const authService = createAuthService({
    verifyGoogleToken,
    repo,
    tokenService,
    linkTokenService,
  });
  const accountLinkService = createAccountLinkService({ repo, tokenService, linkTokenService });

  // Shared Upstash Redis client (or null for local dev/tests without it) — reused
  // by revocation, the OTP store and OTP rate limiters so every instance of the
  // API enforces the same abuse-protection state (#10).
  const redis = buildRedisClient(env);

  const revocationStore = buildRevocationStore(redis);
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

  // Natal-chart/matrix result cache (#19) — shared Upstash Redis when
  // configured, otherwise a per-process in-memory fallback. Also implements
  // `ChartCacheInvalidator`, so it doubles as `profileService`'s invalidation
  // port: a birth-data edit drops every chart cached for that user.
  const chartCache = buildChartResultCache(redis, env);
  // Numerology results cache separately (#64) — a `fullName` edit must drop the
  // cached numbers without discarding the still-valid chart, and vice versa.
  const numerologyCache = buildNumerologyResultCache(redis, env);
  const profileService = createProfileService({ repo, cache: chartCache, numerologyCache });

  // Account deletion & GDPR data export (#9). The inline-queue fallback needs
  // `processExport`, and the service needs the queue — resolve the cycle with a
  // late-bound reference captured by the processor closure.
  const accountRepo = new DrizzleAccountRepository(db);
  // Must stay `let`: declared ahead of the exportQueue closure that captures
  // it by reference, then assigned once the circular dependency is resolved.
  // eslint-disable-next-line prefer-const
  let accountService: AccountService;
  const exportQueue = buildExportQueue(env, (jobId) => accountService.processExport(jobId));
  accountService = createAccountService({
    repo: accountRepo,
    storage: buildObjectStorage(env),
    queue: exportQueue,
    notifier: new LogExportNotifier(),
    sessionService,
    config: {
      deletionConfirmationPhrase: env.DELETION_CONFIRMATION_PHRASE,
      exportTtlSeconds: env.DATA_EXPORT_TTL_HOURS * 60 * 60,
      publicApiUrl: env.PUBLIC_API_URL ?? `http://localhost:${env.PORT}`,
      downloadTokenSecret: env.DATA_EXPORT_TOKEN_SECRET ?? env.JWT_REFRESH_SECRET,
    },
  });

  // WhatsApp OTP login (#3) + rate-limiting/abuse protection (#10): per-phone
  // and per-IP request throttling, a temporary account lockout after repeated
  // failed verification attempts, and admin-panel logging of anomalous activity.
  const adminAlerter = createLoggingAdminAlerter();
  const otpService = createOtpService({
    store: buildOtpStore(redis),
    sender: buildWhatsAppSender(env),
    repo,
    tokenService,
    alerter: adminAlerter,
    phoneRequestLimiter: buildRateLimiter(redis, {
      limit: env.OTP_PHONE_REQUEST_LIMIT,
      windowSeconds: env.OTP_PHONE_REQUEST_WINDOW_SECONDS,
      prefix: 'otp-phone-limit',
    }),
    hashSecret: env.OTP_HASH_SECRET ?? env.JWT_REFRESH_SECRET,
    config: {
      ttlSeconds: env.OTP_TTL_SECONDS,
      resendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
      maxAttempts: env.OTP_MAX_ATTEMPTS,
      codeLength: env.OTP_CODE_LENGTH,
      lockoutSeconds: env.OTP_LOCKOUT_SECONDS,
    },
  });

  app.use('/auth', createGoogleAuthRouter(authService));
  app.use('/auth', createAccountLinkRouter(accountLinkService, tokenService));
  app.use('/auth', createSessionRouter(sessionService, { adminApiToken: env.ADMIN_API_TOKEN }));
  app.use(
    '/otp',
    createOtpRouter({
      otpService,
      ipRequestLimiter: buildRateLimiter(redis, {
        limit: env.OTP_IP_REQUEST_LIMIT,
        windowSeconds: env.OTP_IP_REQUEST_WINDOW_SECONDS,
        prefix: 'otp-ip-limit',
      }),
      alerter: adminAlerter,
    }),
  );
  app.use('/profile', createProfileRouter(profileService, tokenService));
  app.use(
    '/account',
    createAccountRouter(accountService, tokenService, {
      workerToken: env.DATA_EXPORT_WORKER_TOKEN,
    }),
  );

  // Birth-place search (#8): offline AZ gazetteer + rate-limited/cached
  // Nominatim fallback, used by the onboarding (#6) and profile-edit (#7)
  // birth-place autocomplete fields.
  const geocodingService = createGeocodingService({
    nominatim: createNominatimClient({
      baseUrl: env.NOMINATIM_BASE_URL,
      userAgent: env.NOMINATIM_USER_AGENT,
    }),
    cache: buildGeocodeCache(redis),
    rateLimiter: buildNominatimRateLimiter(redis),
    config: {
      cacheTtlSeconds: env.GEOCODE_CACHE_TTL_SECONDS,
      localLimit: 8,
      remoteLimit: 8,
      minLocalResultsBeforeRemote: 3,
    },
  });
  app.use('/geocoding', createGeocodingRouter(geocodingService, tokenService));

  // Multilingual natal-chart interpretation text (#18), admin-editable (EPIC 10).
  const interpretationService = createInterpretationService({
    repo: new DrizzleInterpretationRepository(db),
    cache: buildInterpretationCache(redis),
    config: { cacheTtlSeconds: env.INTERPRETATION_CACHE_TTL_SECONDS },
  });
  app.use(
    '/interpretations',
    createInterpretationRouter(interpretationService, tokenService, {
      adminApiToken: env.ADMIN_API_TOKEN,
    }),
  );

  // Admin-configurable aspect orb config (#15), admin-editable (EPIC 10) — the
  // effective values `/natal-chart` passes into `computeNatalChart`.
  const orbConfigService = createOrbConfigService({
    repo: new DrizzleOrbConfigRepository(db),
    cache: buildOrbConfigCache(redis),
    config: { cacheTtlSeconds: env.ORB_CONFIG_CACHE_TTL_SECONDS },
  });
  app.use(
    '/orb-config',
    createOrbConfigRouter(orbConfigService, tokenService, { adminApiToken: env.ADMIN_API_TOKEN }),
  );

  // Natal-chart computation (#19's missing endpoint, #20's sync target): ties the
  // chart cache, the effective orb config, and `@astrocalc/calc-engine`'s shared
  // `computeNatalChart` together behind the routes the mobile client already calls.
  const natalChartService = createNatalChartService({
    repo,
    cache: chartCache,
    orbConfig: orbConfigService,
  });
  app.use('/natal-chart', createNatalChartRouter(natalChartService, tokenService));

  // Saved subjects (#s2, #64): charts and numerology profiles for other people.
  // Reuses the same chart cache, numerology cache (each namespaced per subject)
  // and orb config as the user's own chart/numerology.
  const subjectsService = createSubjectsService({
    repo: new DrizzleSubjectRepository(db),
    chartCache,
    numerologyCache,
    orbConfig: orbConfigService,
  });
  app.use('/subjects', createSubjectsRouter(subjectsService, tokenService));

  // Numerology (#64): same cache/port shape as the natal chart, but keyed by
  // month so the personal-year/month cycle numbers cannot be served stale.
  const numerologyService = createNumerologyService({ repo, cache: numerologyCache });
  app.use('/numerology', createNumerologyRouter(numerologyService, tokenService));

  // Terminal error handler — must be registered last.
  app.use(errorHandler);

  return app;
}

/**
 * Use Cloudflare R2 when fully configured; otherwise fall back to a per-process
 * in-memory store (local dev/tests only — bundles would not survive a restart
 * or be shared across instances, hence the warning).
 */
function buildObjectStorage(env: Env): ObjectStorage {
  if (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET) {
    return new R2ObjectStorage({
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
      endpoint: env.R2_ENDPOINT,
    });
  }

  console.warn(
    '[account] R2_* not fully set — using in-memory export storage. ' +
      'Data-export bundles will NOT persist or be shared across instances.',
  );
  return new InMemoryObjectStorage();
}

/**
 * Publish export jobs to Upstash QStash (true async + retries) when configured;
 * otherwise process them inline in-process (fine for local dev — no retries).
 */
function buildExportQueue(env: Env, process: (jobId: string) => Promise<void>): ExportQueue {
  if (env.QSTASH_TOKEN && env.DATA_EXPORT_WORKER_TOKEN && env.PUBLIC_API_URL) {
    return new QStashExportQueue({
      token: env.QSTASH_TOKEN,
      workerUrl: `${env.PUBLIC_API_URL.replace(/\/$/, '')}/account/export/process`,
      workerSecret: env.DATA_EXPORT_WORKER_TOKEN,
    });
  }

  console.warn(
    '[account] QSTASH_TOKEN/DATA_EXPORT_WORKER_TOKEN/PUBLIC_API_URL not all set — ' +
      'processing data-export jobs inline (no async retries).',
  );
  return new InlineExportQueue(process);
}

/**
 * Create the shared Upstash Redis client used by revocation, the OTP store and
 * OTP rate limiters, or `null` when it isn't configured (local dev/tests).
 */
function buildRedisClient(env: Env): RedisClient | null {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return createRedis(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
  }
  return null;
}

/**
 * Use the shared Upstash Redis blacklist when configured; otherwise fall back to
 * a per-process in-memory store (fine for local dev, but revocation would not be
 * shared across instances — hence the loud warning).
 */
function buildRevocationStore(redis: RedisClient | null): RevocationStore {
  if (redis) return new RedisRevocationStore(redis);

  console.warn(
    '[auth] UPSTASH_REDIS_REST_URL/TOKEN not set — using in-memory revocation store. ' +
      'Refresh-token revocation will NOT persist or be shared across instances.',
  );
  return new InMemoryRevocationStore();
}

/**
 * Use Upstash Redis for the OTP store when configured; otherwise an in-memory
 * fallback (local dev/tests only — challenges, cooldowns and lockouts would
 * NOT be shared across instances or survive a restart).
 */
function buildOtpStore(redis: RedisClient | null): OtpStore {
  if (redis) return new RedisOtpStore(redis);

  console.warn(
    '[otp] UPSTASH_REDIS_REST_URL/TOKEN not set — using in-memory OTP store. ' +
      'Challenges, cooldowns and lockouts will NOT persist or be shared across instances.',
  );
  return new InMemoryOtpStore();
}

/**
 * Use the shared Upstash Redis chart-result cache when configured; otherwise a
 * per-process in-memory fallback (local dev/tests only — cached charts would
 * NOT be shared across instances or survive a restart, defeating the point of
 * #19, hence the warning).
 */
function buildChartResultCache(redis: RedisClient | null, env: Env): ChartResultCache {
  if (redis) {
    return new RedisChartResultCache(
      redis,
      env.CHART_CACHE_TTL_SECONDS === 0 ? undefined : env.CHART_CACHE_TTL_SECONDS,
    );
  }

  console.warn(
    '[chart] UPSTASH_REDIS_REST_URL/TOKEN not set — using in-memory chart result cache. ' +
      'Cached charts will NOT persist or be shared across instances.',
  );
  return new InMemoryChartResultCache();
}

/**
 * Use the shared Upstash Redis numerology-result cache when configured;
 * otherwise a per-process in-memory fallback (local dev/tests only — cached
 * profiles would NOT be shared across instances or survive a restart, hence
 * the warning).
 */
function buildNumerologyResultCache(redis: RedisClient | null, env: Env): NumerologyResultCache {
  if (redis) {
    return new RedisNumerologyResultCache(
      redis,
      env.NUMEROLOGY_CACHE_TTL_SECONDS === 0 ? undefined : env.NUMEROLOGY_CACHE_TTL_SECONDS,
    );
  }

  console.warn(
    '[numerology] UPSTASH_REDIS_REST_URL/TOKEN not set — using in-memory numerology result cache. ' +
      'Cached profiles will NOT persist or be shared across instances.',
  );
  return new InMemoryNumerologyResultCache();
}

/**
 * Use the real Meta WhatsApp Cloud API sender when fully configured; otherwise
 * a fake sender that never actually delivers a message. There is no safe
 * "logging" fallback here — OTP codes are never logged in plaintext (see
 * `otpService.ts`) — so local dev/tests exercise the flow via the fake sender.
 */
function buildWhatsAppSender(env: Env): WhatsAppSender {
  if (env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN) {
    return createMetaWhatsAppSender({
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
      accessToken: env.WHATSAPP_ACCESS_TOKEN,
      templateName: env.WHATSAPP_TEMPLATE_NAME,
      templateLocale: env.WHATSAPP_TEMPLATE_LOCALE,
      apiVersion: env.WHATSAPP_API_VERSION,
    });
  }

  console.warn(
    '[otp] WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_ACCESS_TOKEN not set — OTP codes will NOT be ' +
      'delivered via WhatsApp (using a fake sender). Set them in production.',
  );
  return new FakeWhatsAppSender();
}

/**
 * Use the shared Upstash Redis cache for interpretation text when configured;
 * otherwise a per-process in-memory fallback (local dev/tests only — an
 * admin edit on one instance would not invalidate another instance's cache).
 */
function buildInterpretationCache(redis: RedisClient | null): InterpretationCache {
  if (redis) return new RedisInterpretationCache(redis);

  console.warn(
    '[interpretations] UPSTASH_REDIS_REST_URL/TOKEN not set — using in-memory interpretation cache. ' +
      "Admin edits will NOT invalidate other instances' caches.",
  );
  return new InMemoryInterpretationCache();
}

/**
 * Use the shared Upstash Redis cache for the admin orb config when configured;
 * otherwise a per-process in-memory fallback (local dev/tests only — an
 * admin edit on one instance would not invalidate another instance's cache).
 */
function buildOrbConfigCache(redis: RedisClient | null): OrbConfigCache {
  if (redis) return new RedisOrbConfigCache(redis);

  console.warn(
    '[orb-config] UPSTASH_REDIS_REST_URL/TOKEN not set — using in-memory orb config cache. ' +
      "Admin edits will NOT invalidate other instances' caches.",
  );
  return new InMemoryOrbConfigCache();
}

/**
 * Use the shared Upstash Redis geocode-search cache when configured;
 * otherwise a per-process in-memory fallback (local dev/tests only — repeat
 * searches would re-hit Nominatim instead of being cached).
 */
function buildGeocodeCache(redis: RedisClient | null): GeocodeCache {
  if (redis) return new RedisGeocodeCache(redis);

  console.warn(
    '[geocoding] UPSTASH_REDIS_REST_URL/TOKEN not set — using in-memory geocode cache. ' +
      'Nominatim results will NOT be shared across instances.',
  );
  return new InMemoryGeocodeCache();
}

/**
 * Use the shared Upstash Redis lock when configured, enforcing Nominatim's
 * 1 req/sec ceiling across every instance; otherwise a per-process in-memory
 * fallback (local dev/tests only — the ceiling would not be shared across
 * instances, risking a usage-policy violation in production).
 */
function buildNominatimRateLimiter(redis: RedisClient | null): NominatimRateLimiter {
  if (redis) return new RedisNominatimRateLimiter(redis);

  console.warn(
    '[geocoding] UPSTASH_REDIS_REST_URL/TOKEN not set — using an in-memory Nominatim rate ' +
      'limiter. The 1 req/sec ceiling will NOT be shared across instances.',
  );
  return new InMemoryNominatimRateLimiter();
}

/**
 * Use an Upstash Redis sliding-window limiter when Redis is configured
 * (shared across instances); otherwise a per-process in-memory fallback
 * (local dev/tests only).
 */
function buildRateLimiter(
  redis: RedisClient | null,
  opts: { limit: number; windowSeconds: number; prefix: string },
): RateLimiter {
  if (redis) return createSlidingWindowRateLimiter(redis, opts);
  return new InMemoryRateLimiter({ limit: opts.limit, windowSeconds: opts.windowSeconds });
}
