/**
 * The subset of Google's ID token payload we rely on. Mirrors the shape
 * returned by `LoginTicket.getPayload()` in `google-auth-library`, kept local
 * so tests don't need to import the library's internals.
 */
export interface GoogleTokenPayload {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
  exp?: number;
}

/**
 * The subset of `OAuth2Client` we depend on. `OAuth2Client` satisfies this
 * structurally, so production code passes a real client and tests pass a fake.
 */
export interface GoogleTicketVerifier {
  verifyIdToken(options: {
    idToken: string;
    audience: string | string[];
  }): Promise<{ getPayload(): GoogleTokenPayload | undefined }>;
}

/** Normalized, trusted user identity extracted from a verified Google token. */
export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  picture: string | null;
  locale: string | null;
}

export interface User {
  id: string;
  /** Null for phone-only accounts (WhatsApp OTP login without a linked email). */
  email: string | null;
  googleId: string | null;
  /** E.164 phone number for WhatsApp-OTP accounts; null otherwise. */
  phone: string | null;
  createdAt: Date;
}

export interface Profile {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  locale: string | null;
  birthDate: string | null;
  birthTime: string | null;
  birthTimeKnown: boolean;
  birthPlaceName: string | null;
  birthPlaceLat: number | null;
  birthPlaceLng: number | null;
  birthPlaceTimezone: string | null;
  onboardingCompletedAt: Date | null;
}

/** Fields the onboarding flow (and later the profile-edit screen, #7) may update, one step (or all) at a time. */
export interface ProfileUpdateInput {
  displayName?: string | null;
  avatarUrl?: string | null;
  locale?: string | null;
  birthDate?: string | null;
  birthTime?: string | null;
  birthTimeKnown?: boolean;
  birthPlaceName?: string | null;
  birthPlaceLat?: number | null;
  birthPlaceLng?: number | null;
  birthPlaceTimezone?: string | null;
  /** Set when the onboarding flow is exited — normally or via "finish later". */
  completeOnboarding?: boolean;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: Date;
}

export interface SignInResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
}

/** Function that turns a raw Google ID token into a trusted profile. */
export type VerifyGoogleToken = (idToken: string) => Promise<GoogleProfile>;
