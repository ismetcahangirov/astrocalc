const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
};

/**
 * Parse a `jsonwebtoken`-style duration ('15m', '30d', '3600') into whole
 * seconds. Used to align a revocation key's Redis TTL with the refresh token's
 * own lifetime. Throws on anything it doesn't understand so misconfiguration
 * fails loudly at boot.
 */
export function parseDurationToSeconds(value: string): number {
  const trimmed = value.trim();
  // Bare number → seconds (matches jsonwebtoken's numeric `expiresIn`).
  if (/^\d+$/.test(trimmed)) return Number(trimmed);

  const match = /^(\d+)\s*(s|m|h|d)$/.exec(trimmed);
  if (!match) {
    throw new Error(`Unsupported duration format: "${value}" (use e.g. "15m", "30d", or seconds)`);
  }
  const amount = Number(match[1]);
  const unit = match[2] as keyof typeof UNIT_SECONDS;
  return amount * UNIT_SECONDS[unit];
}
