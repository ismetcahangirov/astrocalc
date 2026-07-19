/**
 * Pure conversions between the wire formats the backend expects — birth date as
 * `YYYY-MM-DD`, birth time as `HH:mm` — and the `Date` objects the native
 * date/time picker works with, plus a human display format. Kept free of any
 * React Native import so it can be unit-tested under plain Node (the repo's
 * convention: test the `.ts` logic, not the `.tsx` component).
 *
 * Dates are handled as civil year/month/day and hour/minute values in the
 * device's local time — a birth date/time is a wall-clock value, never shifted
 * to UTC here (the historically-correct UTC conversion happens later, on the
 * backend, from the birth place's timezone).
 */

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

/** Parse `YYYY-MM-DD` into a local `Date` at noon (noon avoids any DST/day-edge shift). */
export function parseIsoDate(value: string): Date | null {
  const m = ISO_DATE_RE.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  // Reject calendar overflow (e.g. 2001-02-30 rolling into March).
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/** Format a `Date` back to `YYYY-MM-DD` using its local calendar fields. */
export function formatIsoDate(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** `YYYY-MM-DD` → `DD.MM.YYYY` for display; returns the input unchanged if it isn't a valid ISO date. */
export function formatDisplayDate(value: string): string {
  const m = ISO_DATE_RE.exec(value.trim());
  if (!m) return value;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

/** Parse `HH:mm` into hours/minutes, or null if malformed / out of range. */
export function parseTime(value: string): { hours: number; minutes: number } | null {
  const m = TIME_RE.exec(value.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/** Format a `Date` to `HH:mm` (24-hour) using its local clock fields. */
export function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Seed the time picker: a `Date` on `base`'s day carrying the `HH:mm` value (base's time if malformed/empty). */
export function timeToDate(value: string, base: Date): Date {
  const date = new Date(base);
  const parsed = parseTime(value);
  if (parsed) date.setHours(parsed.hours, parsed.minutes, 0, 0);
  else date.setSeconds(0, 0);
  return date;
}
