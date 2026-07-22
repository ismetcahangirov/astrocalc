import { eq } from 'drizzle-orm';
import type { Database } from './client';
import {
  accountLinkAudit,
  profiles,
  sessions,
  users,
  type ProfileRow,
  type UserRow,
} from './schema';
import type { CreateUserInput, UserRepository } from '../auth/repository';
import type { Profile, ProfileUpdateInput, Session, User } from '../auth/types';

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    googleId: row.googleId,
    phone: row.phone,
    createdAt: row.createdAt,
  };
}

function toProfile(row: ProfileRow): Profile {
  return {
    userId: row.userId,
    displayName: row.displayName,
    firstName: row.firstName,
    lastName: row.lastName,
    patronymic: row.patronymic,
    fullName: row.fullName,
    avatarUrl: row.avatarUrl,
    locale: row.locale,
    birthDate: row.birthDate,
    birthTime: row.birthTime,
    birthTimeKnown: row.birthTimeKnown,
    birthPlaceName: row.birthPlaceName,
    birthPlaceLat: row.birthPlaceLat,
    birthPlaceLng: row.birthPlaceLng,
    birthPlaceTimezone: row.birthPlaceTimezone,
    onboardingCompletedAt: row.onboardingCompletedAt,
  };
}

/** Drizzle/Neon-backed implementation of {@link UserRepository}. */
export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async findByGoogleId(googleId: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
    return row ? toUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return row ? toUser(row) : null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.phone, phone)).limit(1);
    return row ? toUser(row) : null;
  }

  async createUserWithPhone(input: { phone: string }): Promise<User> {
    const [userRow] = await this.db.insert(users).values({ phone: input.phone }).returning();
    if (!userRow) throw new Error('failed to create user');

    await this.db.insert(profiles).values({
      userId: userRow.id,
      displayName: null,
      fullName: null,
      avatarUrl: null,
      locale: null,
    });

    return toUser(userRow);
  }

  async createUserWithProfile(input: CreateUserInput): Promise<User> {
    // NOTE: neon-http has no interactive transactions; the two inserts run
    // sequentially. A follow-up should wrap this in a transaction via the
    // pooled (neon-serverless) driver to avoid a rare orphaned-user window.
    const [userRow] = await this.db
      .insert(users)
      .values({ email: input.email.toLowerCase(), googleId: input.googleId })
      .returning();
    if (!userRow) throw new Error('failed to create user');

    await this.db.insert(profiles).values({
      userId: userRow.id,
      displayName: input.displayName,
      // Never seeded from the Google display name — see `Profile.fullName`.
      fullName: null,
      avatarUrl: input.avatarUrl,
      locale: input.locale,
    });

    return toUser(userRow);
  }

  async linkGoogleId(userId: string, googleId: string): Promise<User> {
    const [row] = await this.db
      .update(users)
      .set({ googleId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (!row) throw new Error(`user ${userId} not found`);
    return toUser(row);
  }

  async recordAccountLink(entry: { userId: string; googleId: string }): Promise<void> {
    await this.db
      .insert(accountLinkAudit)
      .values({ userId: entry.userId, linkedGoogleId: entry.googleId });
  }

  async createSession(userId: string): Promise<Session> {
    const [row] = await this.db.insert(sessions).values({ userId }).returning();
    if (!row) throw new Error('failed to create session');
    return { id: row.id, userId: row.userId, createdAt: row.createdAt };
  }

  async getProfile(userId: string): Promise<Profile | null> {
    const [row] = await this.db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
    return row ? toProfile(row) : null;
  }

  async updateProfile(userId: string, patch: ProfileUpdateInput): Promise<Profile> {
    const { completeOnboarding, ...fields } = patch;
    const [row] = await this.db
      .update(profiles)
      .set({
        ...fields,
        ...(completeOnboarding ? { onboardingCompletedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId))
      .returning();
    if (!row) throw new Error(`profile for user ${userId} not found`);
    return toProfile(row);
  }
}
