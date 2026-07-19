const PHONE_CLEAN_RE = /[\s\-().]/g;
const PHONE_RE = /^\+[1-9]\d{7,14}$/;

/** Strip common formatting characters, mirroring the backend's `normalizePhone` cleanup. */
export function normalizePhoneInput(raw: string): string {
  return raw.trim().replace(PHONE_CLEAN_RE, '');
}

/**
 * Client-side mirror of the backend's E.164 check (`apps/backend/src/otp/phone.ts`),
 * so an obviously-bad number is caught before the round trip.
 */
export function isValidPhone(raw: string): boolean {
  return PHONE_RE.test(normalizePhoneInput(raw));
}

/** Whether `code` is exactly `length` digits (ignoring surrounding whitespace). */
export function isValidCode(code: string, length: number): boolean {
  return new RegExp(`^\\d{${length}}$`).test(code.trim());
}

/** Formats a countdown in seconds as `m:ss` (e.g. `65` -> `1:05`), clamped at zero. */
export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
