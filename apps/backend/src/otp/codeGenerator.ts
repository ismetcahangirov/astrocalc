import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Generate a cryptographically secure numeric OTP code of `length` digits.
 * Uses `crypto.randomInt` (rejection sampling under the hood) so there is no
 * modulo bias, and left-pads with zeros so every code is exactly `length` long.
 */
export function generateOtpCode(length: number): string {
  if (length < 1) throw new Error('OTP code length must be at least 1');
  const max = 10 ** length; // exclusive upper bound
  const n = randomInt(0, max);
  return n.toString().padStart(length, '0');
}

/**
 * HMAC-SHA256 of the code, keyed by a server secret and bound to the phone
 * number. Only this digest is ever persisted (Redis) — the plaintext code is
 * never stored or logged, per the security requirement.
 */
export function hashOtpCode(secret: string, phone: string, code: string): string {
  return createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
}

/**
 * Constant-time comparison of a candidate code against a stored hash. Recomputes
 * the HMAC and compares digests with `timingSafeEqual` to avoid leaking match
 * progress through timing.
 */
export function verifyOtpHash(
  secret: string,
  phone: string,
  code: string,
  expectedHash: string,
): boolean {
  const actual = Buffer.from(hashOtpCode(secret, phone, code), 'hex');
  let expected: Buffer;
  try {
    expected = Buffer.from(expectedHash, 'hex');
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
