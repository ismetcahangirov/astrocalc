import { describe, expect, it } from 'vitest';
import { generateOtpCode, hashOtpCode, verifyOtpHash } from './codeGenerator';

const SECRET = 'otp-hash-secret-value';

describe('generateOtpCode', () => {
  it('generates a numeric code of the requested length', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateOtpCode(6);
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it('respects a custom length', () => {
    expect(generateOtpCode(4)).toMatch(/^\d{4}$/);
    expect(generateOtpCode(8)).toMatch(/^\d{8}$/);
  });

  it('produces varied codes (not a constant)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateOtpCode(6)));
    // Astronomically unlikely to collide to a single value if truly random.
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('hashOtpCode / verifyOtpHash', () => {
  it('is deterministic for the same phone + code + secret', () => {
    const a = hashOtpCode(SECRET, '+15551234567', '123456');
    const b = hashOtpCode(SECRET, '+15551234567', '123456');
    expect(a).toBe(b);
  });

  it('never returns the plaintext code (stored hashed)', () => {
    const hash = hashOtpCode(SECRET, '+15551234567', '123456');
    expect(hash).not.toContain('123456');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('binds the hash to the phone number', () => {
    const a = hashOtpCode(SECRET, '+15551234567', '123456');
    const b = hashOtpCode(SECRET, '+15559999999', '123456');
    expect(a).not.toBe(b);
  });

  it('verifies a matching code and rejects a wrong one', () => {
    const hash = hashOtpCode(SECRET, '+15551234567', '123456');
    expect(verifyOtpHash(SECRET, '+15551234567', '123456', hash)).toBe(true);
    expect(verifyOtpHash(SECRET, '+15551234567', '000000', hash)).toBe(false);
  });
});
