/** A stored OTP challenge — only the code *hash* is kept, never the plaintext. */
export interface OtpChallenge {
  codeHash: string;
  /** Epoch ms when the code expires (used for the client-facing countdown). */
  expiresAt: number;
}

/**
 * Persistence boundary for OTP state. Kept as an interface so the service can be
 * unit-tested against an in-memory store while production uses Upstash Redis
 * (see `redisOtpStore.ts`). All time-bounded keys carry a TTL so codes and
 * cooldowns clean themselves up.
 */
export interface OtpStore {
  saveChallenge(phone: string, challenge: OtpChallenge, ttlSeconds: number): Promise<void>;
  getChallenge(phone: string): Promise<OtpChallenge | null>;
  deleteChallenge(phone: string): Promise<void>;
  /** Atomically increment the wrong-attempt counter; returns the new count. */
  incrementAttempts(phone: string, ttlSeconds: number): Promise<number>;
  /** Remaining resend-cooldown seconds (0 when the window is clear). */
  getCooldownSeconds(phone: string): Promise<number>;
  /** Open a resend-cooldown window of `seconds`. */
  startCooldown(phone: string, seconds: number): Promise<void>;
  /** Remaining lockout seconds after too many failed verification attempts (0 = not locked). */
  getLockSeconds(phone: string): Promise<number>;
  /** Lock the phone out of further OTP requests/verification for `seconds`. */
  lock(phone: string, seconds: number): Promise<void>;
}

interface Expiring<T> {
  value: T;
  expiresAtMs: number;
}

/**
 * In-memory {@link OtpStore} for tests and local dev without Redis. Honors TTLs
 * against an injectable clock so tests can advance time deterministically.
 */
export class InMemoryOtpStore implements OtpStore {
  private challenges = new Map<string, Expiring<OtpChallenge>>();
  private attempts = new Map<string, Expiring<number>>();
  private cooldowns = new Map<string, number>(); // phone -> untilMs
  private locks = new Map<string, number>(); // phone -> untilMs

  constructor(private readonly now: () => number = Date.now) {}

  // Retain the challenge past its logical TTL so the service can distinguish an
  // "expired" code from one that was never requested; matches the Redis grace.
  private static readonly GRACE_SECONDS = 60;

  async saveChallenge(phone: string, challenge: OtpChallenge, ttlSeconds: number): Promise<void> {
    const retention = (ttlSeconds + InMemoryOtpStore.GRACE_SECONDS) * 1000;
    this.challenges.set(phone, { value: challenge, expiresAtMs: this.now() + retention });
    // A fresh code resets the attempt counter.
    this.attempts.delete(phone);
  }

  async getChallenge(phone: string): Promise<OtpChallenge | null> {
    // Expiry is enforced by the service against `challenge.expiresAt` so it can
    // return a clear "expired" error. We retain the entry through a short grace
    // window past its TTL (mirroring the Redis store's grace) before evicting.
    const entry = this.challenges.get(phone);
    if (!entry) return null;
    if (this.now() >= entry.expiresAtMs) {
      this.challenges.delete(phone);
      return null;
    }
    return entry.value;
  }

  async deleteChallenge(phone: string): Promise<void> {
    this.challenges.delete(phone);
    this.attempts.delete(phone);
  }

  async incrementAttempts(phone: string, ttlSeconds: number): Promise<number> {
    const entry = this.attempts.get(phone);
    const live = entry && this.now() < entry.expiresAtMs ? entry.value : 0;
    const next = live + 1;
    this.attempts.set(phone, { value: next, expiresAtMs: this.now() + ttlSeconds * 1000 });
    return next;
  }

  async getCooldownSeconds(phone: string): Promise<number> {
    const until = this.cooldowns.get(phone);
    if (until === undefined) return 0;
    const remainingMs = until - this.now();
    if (remainingMs <= 0) {
      this.cooldowns.delete(phone);
      return 0;
    }
    return Math.ceil(remainingMs / 1000);
  }

  async startCooldown(phone: string, seconds: number): Promise<void> {
    this.cooldowns.set(phone, this.now() + seconds * 1000);
  }

  async getLockSeconds(phone: string): Promise<number> {
    const until = this.locks.get(phone);
    if (until === undefined) return 0;
    const remainingMs = until - this.now();
    if (remainingMs <= 0) {
      this.locks.delete(phone);
      return 0;
    }
    return Math.ceil(remainingMs / 1000);
  }

  async lock(phone: string, seconds: number): Promise<void> {
    this.locks.set(phone, this.now() + seconds * 1000);
  }
}
