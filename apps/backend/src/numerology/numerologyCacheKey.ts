import { createHash } from 'node:crypto';

/**
 * The inputs a numerology profile depends on (#64). Two requests that produce
 * the same values here are guaranteed to produce the same profile, so they may
 * safely share one cache entry.
 *
 * Note what is *not* here: the full reference date. A numerology profile's core
 * numbers (life path, expression, soul urge, …) depend only on the name and the
 * birth date, but Personal Year and Personal Month advance with the calendar —
 * so a key derived from name + birth date alone would happily serve September's
 * Personal Month all through October, which reads to a user as "the app is just
 * wrong". Scoping the key to the *month* rather than the day is the deliberate
 * middle ground: every request inside a calendar month hits the same entry
 * (which is what makes the cache worth having), and the entry falls out of use
 * on its own at the month boundary, because no later request can address it
 * again. Narrowing this to the full `YYYY-MM-DD` would cost a recompute every
 * day for no correctness gain; widening it to the year would resurrect the
 * stale-Personal-Month bug. Leave it at the month.
 */
export interface NumerologyCacheKeyInput {
  fullName: string;
  birthDate: string;
  /** `YYYY-MM` — the month, not the day. */
  referenceMonth: string;
}

/** Deep-sorts object keys so semantically-equal inputs hash identically regardless of property insertion order. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([k, v]) => [k, canonicalize(v)]));
  }
  return value;
}

/**
 * Deterministic fingerprint of the numerology-relevant inputs: `hash(fullName,
 * birthDate, referenceMonth)`. Stable across object key order and process
 * restarts, so it is safe to use directly as (part of) a Redis cache key.
 */
export function hashNumerologyCacheKey(input: NumerologyCacheKeyInput): string {
  const canonical = canonicalize({
    fullName: input.fullName,
    birthDate: input.birthDate,
    referenceMonth: input.referenceMonth,
  });
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
