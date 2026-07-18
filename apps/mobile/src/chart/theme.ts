import type { ChartAspectType } from './geometry';

/**
 * Gold-on-dark design tokens for the natal-chart wheel, aligned with the
 * app-wide palette (see `LoginScreen`) and the brand "gold halo / circular
 * progress-ring" language of Section 2.3.
 */
export const chartTheme = {
  /** Deep near-black backdrop the wheel sits on. */
  background: '#0E0B14',
  /** Slightly lifted disc behind the wheel, for depth. */
  disc: '#141020',
  /** Primary brand gold — rings, sign glyphs, angular axes. */
  gold: '#E4B95B',
  /** Dimmed gold for secondary strokes (minor ticks, ordinary house lines). */
  goldMuted: 'rgba(228, 185, 91, 0.35)',
  /** Faint gold for hairlines (the inner aspect circle, degree ticks). */
  goldFaint: 'rgba(228, 185, 91, 0.16)',
  /** Muted lavender-grey for house numbers and de-emphasised labels. */
  textMuted: '#B9B4C7',
  /** Dark ink used on top of gold fills (planet glyph on a gold dot). */
  onGold: '#1a1206',
  /** Warm red used to distinguish retrograde bodies (the "R" mark). */
  retrograde: '#E0736B',
  /** Colour of the soft gold glow/halo around the outer ring. */
  glow: '#E4B95B',
} as const;

/** How each aspect type is drawn: stroke colour and whether it's dashed. */
export const aspectStyles: Readonly<
  Record<ChartAspectType, { color: string; dashed: boolean; width: number }>
> = {
  conjunction: { color: 'rgba(228, 185, 91, 0.85)', dashed: false, width: 1.4 },
  opposition: { color: '#D66A6A', dashed: false, width: 1.4 },
  square: { color: '#E0736B', dashed: false, width: 1.2 },
  trine: { color: '#5FB39A', dashed: false, width: 1.2 },
  sextile: { color: '#5AA9E6', dashed: true, width: 1 },
};
