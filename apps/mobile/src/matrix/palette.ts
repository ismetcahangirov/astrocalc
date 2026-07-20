/**
 * Per-arcana colours for the octagram (#75 visual detail).
 *
 * The written breakdown names each position; the figure distinguishes the
 * arcana by colour, so a glance reads as the rich, multi-coloured Matrix the
 * reference calculators draw rather than a single-colour skeleton. Every fill
 * carries the ink (text) colour that keeps its number legible — white on the
 * saturated fills, dark on the one light (gold) fill — decided here, once, so
 * the renderer never has to reason about contrast.
 *
 * Pure data + a lookup, so it unit-tests without React or Skia.
 */

export interface ArcanaColors {
  /** Disc fill. */
  fill: string;
  /** Number colour, chosen for contrast against `fill`. */
  ink: string;
}

const WHITE = '#FFFFFF';
/** The app's "ink on gold" tone, reused for the one light (gold) fill. */
const DARK_INK = '#1A1206';

/**
 * Arcana 1–22 → fill colour. A vibrant spread across the spectrum that keeps
 * the reference's anchor hues (6 red, 8 orange, 9 orange-red, 11 green, 18 gold
 * at the centre, 19 cyan, 20 blue, 22 indigo) while filling the rest so every
 * disc reads as its own colour rather than a wash of gold.
 */
const ARCANA_FILL: Readonly<Record<number, string>> = {
  1: '#7C3AED', // violet
  2: '#5B4FD6', // indigo
  3: '#4361EE', // blue-indigo
  4: '#2B6CB0', // blue
  5: '#2A9DD6', // sky
  6: '#E5484D', // red
  7: '#0E9AA7', // teal
  8: '#E8830C', // orange
  9: '#E24A2B', // orange-red
  10: '#0FA97A', // emerald
  11: '#3FA845', // green
  12: '#D98A0B', // amber
  13: '#6B7280', // slate (Death)
  14: '#0E8FD0', // cerulean
  15: '#9A5B34', // brown (Devil)
  16: '#C81E3A', // crimson (Tower)
  17: '#17B3C4', // cyan (Star)
  18: '#EAB308', // gold (centre)
  19: '#38A9E4', // cyan-blue
  20: '#2457D6', // blue
  21: '#5C6B7A', // slate (World)
  22: '#4338CA', // indigo (Fool)
};

/** Fills light enough that a dark number reads better than a white one. */
const DARK_INK_ARCANA = new Set<number>([18]);

/** Fallback for a value outside 1–22 — never reached for a reduced arcana, but total. */
const FALLBACK: ArcanaColors = { fill: '#5C6B7A', ink: WHITE };

/** Fill + contrasting ink for an arcana (1–22). */
export function arcanaColors(arcana: number): ArcanaColors {
  const fill = ARCANA_FILL[arcana];
  if (!fill) return FALLBACK;
  return { fill, ink: DARK_INK_ARCANA.has(arcana) ? DARK_INK : WHITE };
}
