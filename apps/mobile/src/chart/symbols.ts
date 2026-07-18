/**
 * Unicode glyphs for zodiac signs and celestial bodies. These are rendered as
 * text in the wheel; a dedicated astrology font can be bundled later for
 * pixel-perfect symbols, but the standard Unicode astrological block renders
 * acceptably on both iOS and Android system fonts.
 */

/** Zodiac sign glyphs, indexed 0 = Aries … 11 = Pisces (calc-engine order). */
export const SIGN_GLYPHS = [
  '♈', // Aries ♈
  '♉', // Taurus ♉
  '♊', // Gemini ♊
  '♋', // Cancer ♋
  '♌', // Leo ♌
  '♍', // Virgo ♍
  '♎', // Libra ♎
  '♏', // Scorpio ♏
  '♐', // Sagittarius ♐
  '♑', // Capricorn ♑
  '♒', // Aquarius ♒
  '♓', // Pisces ♓
] as const;

/**
 * Glyphs for each calc-engine `CelestialBody`. A short ASCII fallback label is
 * kept alongside for accessibility and in case a glyph is missing from the
 * device font.
 */
export const BODY_SYMBOLS: Record<string, { glyph: string; label: string }> = {
  sun: { glyph: '☉', label: 'Sun' }, // ☉
  moon: { glyph: '☽', label: 'Moon' }, // ☽
  mercury: { glyph: '☿', label: 'Mercury' }, // ☿
  venus: { glyph: '♀', label: 'Venus' }, // ♀
  mars: { glyph: '♂', label: 'Mars' }, // ♂
  jupiter: { glyph: '♃', label: 'Jupiter' }, // ♃
  saturn: { glyph: '♄', label: 'Saturn' }, // ♄
  uranus: { glyph: '♅', label: 'Uranus' }, // ♅
  neptune: { glyph: '♆', label: 'Neptune' }, // ♆
  pluto: { glyph: '♇', label: 'Pluto' }, // ♇
  northNode: { glyph: '☊', label: 'North Node' }, // ☊
  southNode: { glyph: '☋', label: 'South Node' }, // ☋
  chiron: { glyph: '⚷', label: 'Chiron' }, // ⚷
};

/** Look up a body's glyph, falling back to a two-letter abbreviation. */
export function bodyGlyph(body: string): string {
  return BODY_SYMBOLS[body]?.glyph ?? body.slice(0, 2).toUpperCase();
}

/** Look up a body's human-readable name for accessibility labels. */
export function bodyLabel(body: string): string {
  return BODY_SYMBOLS[body]?.label ?? body;
}
