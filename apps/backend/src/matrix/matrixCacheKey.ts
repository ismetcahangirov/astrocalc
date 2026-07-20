import { createHash } from 'node:crypto';

/**
 * The inputs a Matrix of Destiny computation depends on (#73) — the birth date,
 * and nothing else.
 *
 * That single field is the whole point of this type, and the reason this cache
 * is neither the chart's nor numerology's. Compare:
 *
 * - The **chart** key carries birth time, coordinates, house system and the
 *   admin orb config, because all of them move the result.
 * - The **numerology** key carries the full name (every name-derived number is
 *   a letter sum) and is scoped to the calendar *month*, because Personal
 *   Year/Month advance with the clock — an entry that never expired would serve
 *   September's number all through October.
 * - The **Matrix** has neither problem. Every arcana is derived from the day,
 *   month and year alone (see `packages/calc-engine/src/matrix/`), so the result
 *   is a pure function of one immutable field. It cannot go stale on its own,
 *   only a birth-date correction can invalidate it, and no reference date,
 *   name, place or setting belongs in this key. Adding one later would silently
 *   fragment the cache without buying any correctness.
 *
 * Kept as an object rather than a bare `string` so the call sites read the same
 * as the other two caches, and so a future input (if the methodology ever grows
 * one) is an additive change rather than a signature change.
 */
export interface MatrixCacheKeyInput {
  /** Civil birth date, `YYYY-MM-DD`. The only thing the Matrix depends on. */
  birthDate: string;
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
 * Deterministic fingerprint of the Matrix-relevant input: `hash(birthDate)`.
 * Stable across object key order and process restarts, so it is safe to use
 * directly as (part of) a Redis cache key.
 *
 * Hashing a single already-short field looks redundant next to
 * `hashChartCacheKey`, and it is not kept only for symmetry: a Redis key is
 * echoed into slow-query logs, `MONITOR` output and any hosted-Redis dashboard,
 * and a raw `1990-05-12` sitting next to a user id is birth data in plaintext
 * somewhere nobody audits. The digest costs nothing and keeps it out.
 */
export function hashMatrixCacheKey(input: MatrixCacheKeyInput): string {
  const canonical = canonicalize({ birthDate: input.birthDate });
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
