import { sumArcana, type Arcana } from './reduce';
import type { CoreSquare } from './core';
import type { AncestralSquare } from './ancestral';

/**
 * The purpose line (#71): the sky and earth axes, and the four purposes built
 * from them.
 *
 * Traditionally read as life stages — `personal` up to about 40, `social` after
 * 40, `spiritual` after 60 — though this module only computes them; what they
 * mean is interpretation content (#81).
 *
 * See `docs/superpowers/specs/2026-07-20-matrix-of-destiny-ladini-method.md` §4.
 */
export interface Purposes {
  /** The vertical axis — `month + sum`. */
  sky: Arcana;
  /** The horizontal axis — `day + year`. */
  earth: Arcana;
  /** `sky + earth`. */
  personal: Arcana;
  /** `paternalLine + maternalLine`. */
  social: Arcana;
  /** `personal + social`. */
  spiritual: Arcana;
  /** `social + spiritual`. The least-corroborated position in the method — see below. */
  planetary: Arcana;
}

/**
 * Compute the purposes from the core and ancestral squares.
 *
 * Note `sky` uses `core.sum` — the **bottom vertex** — and not `core.centre`.
 * The two are easy to confuse because the centre also sits on the vertical axis
 * when the octagram is drawn, but every implementation uses the bottom vertex.
 *
 * `planetary` is the weakest-supported value this engine computes: two sources,
 * one of them code, and two of the three reference implementations stop at
 * `spiritual` without ever defining it. It is included because it is
 * consistently defined wherever it *is* defined, but it is deliberately flagged
 * here as the first thing to suspect if a future cross-check disagrees — rather
 * than sitting in the result looking exactly as well-founded as `sky`, which
 * four independent sources confirm.
 */
export function computePurposes(core: CoreSquare, ancestral: AncestralSquare): Purposes {
  const sky = sumArcana(core.month, core.sum);
  const earth = sumArcana(core.day, core.year);
  const personal = sumArcana(sky, earth);
  const social = sumArcana(ancestral.paternalLine, ancestral.maternalLine);
  const spiritual = sumArcana(personal, social);

  return { sky, earth, personal, social, spiritual, planetary: sumArcana(social, spiritual) };
}
