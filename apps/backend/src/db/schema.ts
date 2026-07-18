import {
  boolean,
  date,
  doublePrecision,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Core identity. A user may authenticate via Google (googleId set) and/or other
 * methods (e.g. WhatsApp OTP, tracked separately). Email is the natural key used
 * to link a Google login to a pre-existing account.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Nullable: phone-only (WhatsApp OTP) accounts have no email until one is linked.
  email: text('email').unique(),
  googleId: text('google_id').unique(),
  // E.164 phone for WhatsApp-OTP accounts.
  phone: text('phone').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One-to-one profile record, created automatically on first sign-in and
 * filled in by the onboarding flow (name → birth date → birth time → birth
 * place → language). Every birth-data column is nullable because a user can
 * bail out early ("I'll finish this later") with a partial/draft profile;
 * `onboardingCompletedAt` is what actually gates access to the main app —
 * it is set either when all steps finish normally or when the user skips.
 */
export const profiles = pgTable('profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  locale: text('locale'),
  birthDate: date('birth_date', { mode: 'string' }),
  birthTime: time('birth_time'),
  // Defaults false (unknown) rather than true, since the birth-time step is
  // the only one allowed to be skipped without the user saying so explicitly.
  birthTimeKnown: boolean('birth_time_known').notNull().default(false),
  birthPlaceName: text('birth_place_name'),
  birthPlaceLat: doublePrecision('birth_place_lat'),
  birthPlaceLng: doublePrecision('birth_place_lng'),
  // IANA tz id (e.g. "Asia/Baku") — required by the natal chart calc, derived
  // server-side from lat/lng at geocoding time rather than trusted from the client.
  birthPlaceTimezone: text('birth_place_timezone'),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** An opened login session, referenced by the refresh token's `sessionId`. */
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // Set when the session is explicitly revoked (logout / refresh-token rotation).
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

/**
 * GDPR account-deletion audit trail (#9). Deliberately does NOT reference
 * `users` with a foreign key: the record must OUTLIVE the account it describes,
 * so the deleted user's id is kept as a plain column rather than a cascading
 * FK. Only the minimum needed to prove *who* deleted *what* and *when* is
 * stored here — no other personal data is copied into the log.
 */
export const accountDeletions = pgTable('account_deletions', {
  id: uuid('id').primaryKey().defaultRandom(),
  // The account that was deleted (plain column — survives the cascade).
  deletedUserId: uuid('deleted_user_id').notNull(),
  // Who triggered it: the user themselves or an admin's user id.
  requestedBy: uuid('requested_by').notNull(),
  // How it was initiated — 'self' (the user) or 'admin'.
  actor: text('actor').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Asynchronous GDPR data-export jobs (#9). Requesting an export inserts a
 * `pending` row and enqueues an Upstash QStash message; the worker gathers the
 * user's data, uploads a JSON bundle to Cloudflare R2, then marks the job
 * `ready` with a single-use download token (only its hash is stored) that
 * expires ~24h later. The FK cascades so a deleted account takes its export
 * jobs with it.
 */
export const dataExportJobs = pgTable('data_export_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // pending → processing → ready → failed. "Downloaded" is derived from
  // `downloadedAt` rather than being a status, so single-use is enforced by one
  // atomic write.
  status: text('status').notNull().default('pending'),
  // R2 object key of the uploaded bundle, set once the worker finishes.
  objectKey: text('object_key'),
  // HMAC hash of the single-use download token — never the token itself.
  downloadTokenHash: text('download_token_hash'),
  // When the download link stops working (~24h after it becomes ready).
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  // Set on the first successful download — the link is single-use.
  downloadedAt: timestamp('downloaded_at', { withTimezone: true }),
  // Populated when status = 'failed'.
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Admin-configurable orb values for aspect calculation (#15). One row per major
 * aspect type (`conjunction`, `sextile`, `square`, `trine`, `opposition`);
 * `orbDegrees` is the allowed deviation from the exact angle. Rows are the
 * *overrides* — any aspect type without a row falls back to the calc-engine's
 * documented `DEFAULT_ORBS`. This is the shared configuration the admin panel
 * (EPIC 10) edits and the natal-chart calculation reads (cached in Redis).
 */
export const aspectOrbConfig = pgTable('aspect_orb_config', {
  // The aspect type, e.g. 'conjunction'. Natural primary key (max five rows).
  aspectType: text('aspect_type').primaryKey(),
  orbDegrees: doublePrecision('orb_degrees').notNull(),
  // Admin user who last changed this value, for the audit trail. Nullable so a
  // seed/migration default can exist without attributing it to a person.
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Multilingual natal-chart interpretation text (#18): one row per
 * (category, subjectKey, locale) — e.g. `('planet-sign', 'sun-Aries', 'en')`.
 * `subjectKey` values are built by `@astrocalc/calc-engine`'s
 * `planetSignSubjectKey`/`planetHouseSubjectKey`/`aspectSubjectKey`, and the
 * full required set is enumerated by its `listInterpretationSubjects()` — the
 * single source of truth both the seed script and the admin-panel
 * completeness check (EPIC 10) are driven from. This is the admin-editable
 * store the technical notes call for in place of static per-locale JSON,
 * given the large text volume; reads are cached in Redis.
 */
export const interpretationTexts = pgTable(
  'interpretation_texts',
  {
    category: text('category').notNull(),
    subjectKey: text('subject_key').notNull(),
    locale: text('locale').notNull(),
    content: text('content').notNull(),
    // Admin user who last changed this value, for the audit trail. Nullable so
    // the initial seed can exist without attributing it to a person.
    updatedBy: uuid('updated_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.category, table.subjectKey, table.locale] })],
);

export type UserRow = typeof users.$inferSelect;
export type ProfileRow = typeof profiles.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type AccountDeletionRow = typeof accountDeletions.$inferSelect;
export type DataExportJobRow = typeof dataExportJobs.$inferSelect;
export type InterpretationTextRow = typeof interpretationTexts.$inferSelect;
