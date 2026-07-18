/** BCP-47 tag for Azerbaijani case-folding rules (dotted İ/i vs dotless I/ı). */
const AZ_LOCALE = 'az';

/**
 * Case-fold Azerbaijani text with locale-aware rules. Plain `.toUpperCase()`
 * follows the default (Turkish/Azerbaijani-unaware) mapping, where lowercase
 * `i` uppercases to the ASCII `I` and `İ` is left untouched — so two spellings
 * of the same place ("İmişli" vs "imişli") fold to different strings and a
 * case-insensitive match silently fails. `.toLocaleUpperCase('az')` maps
 * `i` -> `İ` and `ı` -> `I`, so both spellings converge.
 */
export function azUpperCase(value: string): string {
  return value.toLocaleUpperCase(AZ_LOCALE);
}

/** Normalize a place name/query into a locale-aware, case-insensitive comparison key. */
export function normalizeAzSearchKey(value: string): string {
  return azUpperCase(value.trim()).replace(/\s+/g, ' ');
}
