import { randomUUID } from 'node:crypto';
import type { Profile, ProfileUpdateInput, Session, User } from './types';

export interface CreateUserInput {
  email: string;
  googleId: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  locale: string | null;
}

/**
 * Persistence boundary for authentication. Kept as an interface so the auth
 * service can be unit-tested against an in-memory implementation while
 * production uses the Drizzle-backed one (see `db/drizzleUserRepository.ts`).
 */
export interface UserRepository {
  findByGoogleId(googleId: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByPhone(phone: string): Promise<User | null>;
  createUserWithProfile(input: CreateUserInput): Promise<User>;
  /** Create a phone-only account (WhatsApp OTP login, no email/google linked). */
  createUserWithPhone(input: { phone: string }): Promise<User>;
  linkGoogleId(userId: string, googleId: string): Promise<User>;
  /** Audit trail row for a completed account link (#4) — who, which Google id, when. */
  recordAccountLink(entry: { userId: string; googleId: string }): Promise<void>;
  createSession(userId: string): Promise<Session>;
  getProfile(userId: string): Promise<Profile | null>;
  updateProfile(userId: string, patch: ProfileUpdateInput): Promise<Profile>;
}

/** In-memory repository for tests and local development without a database. */
export class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, User>();
  private profiles = new Map<string, Profile>();
  private sessions = new Map<string, Session>();
  private accountLinks: { userId: string; googleId: string; createdAt: Date }[] = [];

  async findByGoogleId(googleId: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.googleId === googleId) return { ...user };
    }
    return null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email === normalized) return { ...user };
    }
    return null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.phone === phone) return { ...user };
    }
    return null;
  }

  async createUserWithProfile(input: CreateUserInput): Promise<User> {
    const user: User = {
      id: randomUUID(),
      email: input.email.toLowerCase(),
      googleId: input.googleId,
      phone: null,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    this.profiles.set(user.id, {
      userId: user.id,
      displayName: input.displayName,
      // Never seeded from the Google display name — see `Profile.fullName`.
      fullName: null,
      avatarUrl: input.avatarUrl,
      locale: input.locale,
      ...BLANK_ONBOARDING_FIELDS,
    });
    return { ...user };
  }

  async createUserWithPhone(input: { phone: string }): Promise<User> {
    const user: User = {
      id: randomUUID(),
      email: null,
      googleId: null,
      phone: input.phone,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    this.profiles.set(user.id, {
      userId: user.id,
      displayName: null,
      fullName: null,
      avatarUrl: null,
      locale: null,
      ...BLANK_ONBOARDING_FIELDS,
    });
    return { ...user };
  }

  async linkGoogleId(userId: string, googleId: string): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error(`user ${userId} not found`);
    user.googleId = googleId;
    return { ...user };
  }

  async recordAccountLink(entry: { userId: string; googleId: string }): Promise<void> {
    this.accountLinks.push({ ...entry, createdAt: new Date() });
  }

  async createSession(userId: string): Promise<Session> {
    const session: Session = { id: randomUUID(), userId, createdAt: new Date() };
    this.sessions.set(session.id, session);
    return { ...session };
  }

  async getProfile(userId: string): Promise<Profile | null> {
    return this.profiles.get(userId) ?? null;
  }

  async updateProfile(userId: string, patch: ProfileUpdateInput): Promise<Profile> {
    const existing = this.profiles.get(userId);
    if (!existing) throw new Error(`profile for user ${userId} not found`);
    const { completeOnboarding, ...fields } = patch;
    const updated: Profile = {
      ...existing,
      ...fields,
      onboardingCompletedAt: completeOnboarding ? new Date() : existing.onboardingCompletedAt,
    };
    this.profiles.set(userId, updated);
    return { ...updated };
  }

  // --- test helpers ---
  userCount(): number {
    return this.users.size;
  }
  sessionCount(): number {
    return this.sessions.size;
  }
  accountLinkCount(): number {
    return this.accountLinks.length;
  }
}

const BLANK_ONBOARDING_FIELDS = {
  firstName: null,
  lastName: null,
  patronymic: null,
  birthDate: null,
  birthTime: null,
  birthTimeKnown: false,
  birthPlaceName: null,
  birthPlaceLat: null,
  birthPlaceLng: null,
  birthPlaceTimezone: null,
  onboardingCompletedAt: null,
} satisfies Omit<Profile, 'userId' | 'displayName' | 'fullName' | 'avatarUrl' | 'locale'>;
