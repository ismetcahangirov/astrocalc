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
  /** Name parts (Ad / Soyad / Ata adı) — the source of truth the forms collect. */
  firstName: string | null;
  lastName: string | null;
  patronymic: string | null;
  /** Full birth name — numerology's input. Composed from the parts above. */
  fullName: string | null;
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
  /**
   * Name parts. When any is present, the service composes `fullName` and
   * `displayName` from the merged parts (see `profileService.ts`); a client
   * that sends parts need not send `fullName`/`displayName` itself.
   */
  firstName?: string | null;
  lastName?: string | null;
  patronymic?: string | null;
  fullName?: string | null;
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

/**
 * Result of a Google sign-in attempt (#4). A verified Google identity whose
 * email matches an *existing* account (created via another method, with no
 * Google id of its own yet) is never linked automatically — email/phone
 * spoofing makes silent linking unsafe. Instead the caller gets a
 * `link_required` outcome and must confirm the link while authenticated as
 * that existing account (see `accountLinkService.ts`).
 */
export type GoogleSignInOutcome =
  | ({ status: 'signed_in' } & SignInResult)
  | {
      status: 'link_required';
      /** Short-lived, single-purpose token carrying the verified Google identity. */
      linkToken: string;
      /** Partially hidden so the response never fully echoes the existing email. */
      maskedEmail: string;
    };

/** Function that turns a raw Google ID token into a trusted profile. */
export type VerifyGoogleToken = (idToken: string) => Promise<GoogleProfile>;
