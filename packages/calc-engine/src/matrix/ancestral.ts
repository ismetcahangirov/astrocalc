import { reduceToArcana, sumArcana, type Arcana } from './reduce';
import type { CoreSquare } from './core';

/**
 * The ancestral square (#71): the four diagonal corners of the octagram, the
 * paternal and maternal lines they form, and the programme triple each corner
 * carries.
 *
 * **A terminology warning**, because the Russian sources name these the opposite
 * way round from how an English reader expects: «диагональный квадрат» (the
 * *diagonal* square) is the **personal** square in `core.ts`, and «прямой /
 * родовой квадрат» (the *straight* / ancestral square) is this one — whose
 * corners sit on the figure's diagonals. This module uses compass directions
 * throughout so the ambiguity cannot bite.
 *
 * See `docs/superpowers/specs/2026-07-20-matrix-of-destiny-ladini-method.md` §3
 * for the sources and the one divergence (the ancestral centre).
 */

/** One corner of the ancestral square, with the programme triple it carries. */
export interface AncestralCorner {
  /** The corner itself — the sum of its two adjacent cardinal points. */
  corner: Arcana;
  /** The middle point of the triple: `corner + inner`. */
  middle: Arcana;
  /** The inner point, nearest the ancestral centre: `corner + ancestralCentre`. */
  inner: Arcana;
}

/** The ancestral square: four corners, two lines, and its own centre. */
export interface AncestralSquare {
  /** Top-left — `day + month`. The paternal line's spiritual half. */
  paternalSpiritual: AncestralCorner;
  /** Bottom-right — `year + sum`. The paternal line's material half. */
  paternalMaterial: AncestralCorner;
  /** Top-right — `month + year`. The maternal line's spiritual half. */
  maternalSpiritual: AncestralCorner;
  /** Bottom-left — `sum + day`. The maternal line's material half. */
  maternalMaterial: AncestralCorner;
  /** The paternal (father's) line: the NW↔SE diagonal. */
  paternalLine: Arcana;
  /** The maternal (mother's) line: the NE↔SW diagonal. */
  maternalLine: Arcana;
  /** The centre of the ancestral square — the sum of all four corners. */
  centre: Arcana;
  /** `core.centre + ancestral.centre` — where the personal and ancestral squares meet. */
  personalAncestral: Arcana;
}

/**
 * Compute the ancestral square from an already-computed {@link CoreSquare}.
 *
 * Each corner is the sum of the two cardinal points it sits between. The
 * diagonals then pair *opposite* corners: NW with SE for the paternal line, NE
 * with SW for the maternal one. No source assigns the paternal line to the other
 * diagonal, so that pairing is safe — but it is worth stating, because the
 * corners' own spiritual/material naming (top two spiritual, bottom two
 * material) makes a top/bottom split look like the natural reading, and one
 * source does present exactly that split while contradicting itself two
 * paragraphs earlier.
 */
export function computeAncestralSquare(core: CoreSquare): AncestralSquare {
  const nw = sumArcana(core.day, core.month);
  const ne = sumArcana(core.month, core.year);
  const se = sumArcana(core.year, core.sum);
  const sw = sumArcana(core.sum, core.day);

  // The one genuine divergence in this block: two sources say the ancestral
  // centre is the sum of the *upper* corners only. Their own published worked
  // examples are consistent only with all four, and every implementation uses
  // all four — so this is the adopted rule and that variant is recorded as
  // rejected rather than silently ignored (spec §3).
  const centre = sumArcana(nw, ne, se, sw);

  /** Outward → inward: the corner, then a middle point, then the inner one. */
  const triple = (corner: Arcana): AncestralCorner => {
    const inner = sumArcana(corner, centre);
    return { corner, middle: sumArcana(corner, inner), inner };
  };

  return {
    paternalSpiritual: triple(nw),
    paternalMaterial: triple(se),
    maternalSpiritual: triple(ne),
    maternalMaterial: triple(sw),
    paternalLine: sumArcana(nw, se),
    maternalLine: sumArcana(ne, sw),
    centre,
    personalAncestral: reduceToArcana(core.centre + centre),
  };
}
