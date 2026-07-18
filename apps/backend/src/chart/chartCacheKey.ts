import { createHash } from 'node:crypto';
import type { HouseSystem, OrbConfig } from '@astrocalc/calc-engine';

/**
 * The birth data + settings a natal chart/matrix computation depends on — per
 * #19's technical notes, this is exactly what the cache key is derived from.
 * Two profiles (or a profile before/after a birth-data edit) that produce the
 * same values here are guaranteed to produce the same chart, so they may
 * safely share one cache entry.
 */
export interface ChartCacheKeyInput {
  birthDate: string;
  /** Null when the profile's birth time is unknown (house-dependent results are then omitted upstream). */
  birthTime: string | null;
  lat: number;
  lng: number;
  houseSystem: HouseSystem;
  orbConfig: OrbConfig;
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
 * Deterministic fingerprint of the chart-relevant inputs: `hash(birthDate,
 * birthTime, lat, lon, houseSystem, orbConfig)`. Stable across object key
 * order and process restarts (unlike `Object.hash`/`Map` iteration order),
 * so it is safe to use directly as (part of) a Redis cache key.
 */
export function hashChartCacheKey(input: ChartCacheKeyInput): string {
  const canonical = canonicalize({
    birthDate: input.birthDate,
    birthTime: input.birthTime,
    lat: input.lat,
    lng: input.lng,
    houseSystem: input.houseSystem,
    orbConfig: input.orbConfig,
  });
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
