import { InvalidRequestError } from '../auth/errors';

/**
 * Normalize a raw phone number to E.164 (`+` followed by 8–15 digits, no
 * separators). Strips common formatting characters, then validates the shape
 * Meta's Cloud API expects. Throws {@link InvalidRequestError} on anything that
 * isn't a plausible international number.
 */
export function normalizePhone(raw: string): string {
  const cleaned = raw.trim().replace(/[\s\-().]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(cleaned)) {
    throw new InvalidRequestError(
      'Enter a valid phone number in international format, e.g. +15551234567.',
    );
  }
  return cleaned;
}

/**
 * Mask an E.164 phone number for logs/alerts (e.g. `+15551234567` ->
 * `+1555***4567`): keeps enough to correlate repeat abuse without exposing the
 * full number. Falls back to full masking for anything shorter than expected.
 */
export function maskPhone(phone: string): string {
  if (phone.length <= 6) return '*'.repeat(phone.length);
  const head = phone.slice(0, 5);
  const tail = phone.slice(-4);
  return `${head}${'*'.repeat(Math.max(3, phone.length - head.length - tail.length))}${tail}`;
}
