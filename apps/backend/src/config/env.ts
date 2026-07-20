import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  // Comma-separated list of accepted Google OAuth client IDs.
  GOOGLE_CLIENT_IDS: z
    .string()
    .min(1, 'GOOGLE_CLIENT_IDS is required')
    .transform((raw) =>
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  // Upstash Redis (refresh-token revocation blacklist). Optional: when unset the
  // API falls back to an in-memory store — fine for local dev/tests, but a
  // production deployment MUST configure these so revocation is shared across
  // instances and survives restarts.
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  // Shared secret the admin panel presents to force-revoke a user's sessions.
  // When unset, the admin revoke endpoint is disabled (fails closed).
  ADMIN_API_TOKEN: z.string().min(16, 'ADMIN_API_TOKEN must be at least 16 chars').optional(),
  // --- Account linking (#4) ---
  // Signs the short-lived token bridging "Google sign-in found a same-email
  // account" and "user confirmed the link via their other login method".
  // Falls back to JWT_ACCESS_SECRET when unset (a warning is logged), so
  // local dev works without extra config.
  ACCOUNT_LINK_TOKEN_SECRET: z.string().min(16).optional(),
  ACCOUNT_LINK_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  // Birth-place geocoding (#8). A descriptive User-Agent (ideally with real
  // contact info) is required by Nominatim's usage policy — replace the
  // default in production.
  NOMINATIM_BASE_URL: z.string().url().default('https://nominatim.openstreetmap.org'),
  NOMINATIM_USER_AGENT: z
    .string()
    .min(1)
    .default('AstroCalc/0.1 (+https://astrocalc.app; contact: support@astrocalc.app)'),
  GEOCODE_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 30),
  // Natal-chart/matrix result cache (#19). Per the issue's technical notes, a
  // long TTL is the default so entries orphaned by invalidation (see
  // `RedisChartResultCache`) eventually self-clean; set to `0` for no TTL
  // (explicit invalidation only — cached results never expire on their own).
  CHART_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(60 * 60 * 24 * 180),
  // Numerology result cache (#64). Same convention as CHART_CACHE_TTL_SECONDS:
  // a long TTL so entries orphaned by invalidation — and by the month-scoped
  // key rolling over (see `numerologyCacheKey.ts`) — eventually self-clean; set
  // to `0` for no TTL (explicit invalidation only).
  NUMEROLOGY_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(60 * 60 * 24 * 180),
  // Matrix of Destiny result cache (#73). Same convention as the two above,
  // but note what does *not* apply here: a Matrix key is scoped to an immutable
  // birth date, so — unlike a month-scoped numerology key — nothing orphans an
  // entry except an explicit invalidate. The TTL is the backstop for that one
  // case (a birth-date correction), not a volume control; set `0` for no TTL.
  MATRIX_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(60 * 60 * 24 * 180),
  // Natal-chart interpretation text (#18). An admin edit invalidates the
  // specific cache entry, so a generous TTL is safe here.
  INTERPRETATION_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24),
  // Admin-configurable aspect orb config (#15). An admin edit invalidates the
  // cache immediately, so a generous TTL is safe here too.
  ORB_CONFIG_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24),
  // --- Account deletion & GDPR data export (#9) ---
  // Public base URL of this API, used to build the single-use download link in
  // notifications and the QStash worker webhook target. Required for QStash.
  PUBLIC_API_URL: z.string().url().optional(),
  // Exact phrase the client must echo to confirm an account deletion.
  DELETION_CONFIRMATION_PHRASE: z.string().min(1).default('DELETE'),
  // Download-link lifetime in hours (single-use regardless).
  DATA_EXPORT_TTL_HOURS: z.coerce.number().int().positive().default(24),
  // HMAC secret used to hash download tokens. Falls back to JWT_REFRESH_SECRET
  // when unset (a warning is logged), so local dev works without extra config.
  DATA_EXPORT_TOKEN_SECRET: z.string().min(16).optional(),
  // Upstash QStash REST token — enqueues the async export job. When unset the
  // export runs inline in-process (fine for local dev; no retries).
  QSTASH_TOKEN: z.string().min(1).optional(),
  // Shared secret QStash forwards to the worker webhook. Required when QStash is
  // configured; the webhook fails closed without it.
  DATA_EXPORT_WORKER_TOKEN: z
    .string()
    .min(16, 'DATA_EXPORT_WORKER_TOKEN must be at least 16 chars')
    .optional(),
  // Cloudflare R2 (S3-compatible) for the temporary export bundle. When any is
  // unset the API falls back to in-memory storage (local dev/tests only).
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET: z.string().min(1).optional(),
  R2_ENDPOINT: z.string().url().optional(),
  // --- WhatsApp OTP login (#3) + rate-limiting/abuse protection (#10) ---
  // Meta WhatsApp Business Cloud API. When any is unset, OTP login is disabled
  // (there is no safe local fallback that would still deliver a real code).
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),
  WHATSAPP_TEMPLATE_NAME: z.string().min(1).default('otp_login'),
  WHATSAPP_TEMPLATE_LOCALE: z.string().min(1).default('en_US'),
  WHATSAPP_API_VERSION: z.string().min(1).default('v21.0'),
  // HMAC secret used to hash OTP codes before storage. Falls back to
  // JWT_REFRESH_SECRET when unset (a warning is logged), so local dev works
  // without extra config.
  OTP_HASH_SECRET: z.string().min(16).optional(),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_CODE_LENGTH: z.coerce.number().int().positive().default(6),
  // How long a phone is locked out of OTP login after tripping OTP_MAX_ATTEMPTS.
  OTP_LOCKOUT_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60),
  // Per-phone-number request cap (independent of OTP_RESEND_COOLDOWN_SECONDS).
  OTP_PHONE_REQUEST_LIMIT: z.coerce.number().int().positive().default(3),
  OTP_PHONE_REQUEST_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60),
  // Per-source-IP request cap — stops one attacker spraying codes at many numbers.
  OTP_IP_REQUEST_LIMIT: z.coerce.number().int().positive().default(10),
  OTP_IP_REQUEST_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate `process.env`. Throws a readable error listing every
 * missing/invalid variable so misconfiguration fails fast at boot rather than
 * at the first request.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
