import { boolean, date, doublePrecision, pgTable, text, time, timestamp, uuid } from 'drizzle-orm/pg-core';

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

export type UserRow = typeof users.$inferSelect;
export type ProfileRow = typeof profiles.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
