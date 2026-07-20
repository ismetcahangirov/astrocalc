import { sumArcana, type Arcana } from './reduce';
import type { CoreSquare } from './core';

/**
 * The two secondary lines (#71): the money/relationship line, and the chakra
 * health map.
 *
 * See `docs/superpowers/specs/2026-07-20-matrix-of-destiny-ladini-method.md` §5
 * for the sources, and for why the money and relationship "lines" are one thing
 * here rather than two.
 */

/**
 * The five arcana that **both** the money channel and the relationship channel
 * are read from.
 *
 * This is one field rather than two on purpose, and the reason is worth stating
 * plainly because a reader will otherwise assume something is missing. The money
 * line published by one school (`entry – toEntry – core – toPartner – partner`)
 * and the relationship programme published by another (`R = M + L`,
 * `R1 = R + M`, `R2 = R + L`) are, once the letter schemes are normalised,
 * *arithmetically identical* — the same five numbers from the same two parents.
 * A third source describes them as governing both at once.
 *
 * Shipping a `money` field and a `love` field holding equal values would present
 * one finding as two independent ones, and anyone who compared them would
 * reasonably conclude the engine had a bug. So they are computed once, named for
 * what they are, and the two *readings* are left to the interpretation content
 * (#81), which can write both against the same keys.
 */
export interface MoneyAndRelationshipLine {
  /** `sum + centre` — the "entry" point. Always a multiple of 3; see below. */
  entry: Arcana;
  /** `entry + core`. */
  toEntry: Arcana;
  /** `entry + partner` — the central energy of the line. */
  core: Arcana;
  /** `core + partner`. */
  toPartner: Arcana;
  /** `year + centre` — the "partner" point. */
  partner: Arcana;
}

/** One chakra row of the health map: a physical and an energy cell, plus their sum. */
export interface ChakraRow {
  chakra: ChakraName;
  physical: Arcana;
  energy: Arcana;
  /** `physical + energy`. */
  emotional: Arcana;
}

/** The seven chakras, crown to root — also the row order of the health map. */
export type ChakraName =
  'sahasrara' | 'ajna' | 'vishuddha' | 'anahata' | 'manipura' | 'svadhisthana' | 'muladhara';

export const CHAKRA_ORDER: readonly ChakraName[] = [
  'sahasrara',
  'ajna',
  'vishuddha',
  'anahata',
  'manipura',
  'svadhisthana',
  'muladhara',
];

/**
 * Compute the money/relationship line.
 *
 * An independent check that this inner-ring reading is the right one, rather
 * than the outer-ring variant one source gives: `centre` is `2 × (day + month +
 * year)` before reduction, and digit-summing preserves a value mod 9, so
 * `sum + centre ≡ 3 × sum (mod 9)` — making `entry` always a multiple of 3. That
 * matches the published claim that this point only ever takes the values
 * {3, 6, 9, 12, 15, 18, 21} and that "1 and 2 never occur there". The outer-ring
 * candidate has no such property, so the constraint discriminates between them.
 * (`lines.test.ts` asserts it over an exhaustive date sweep.)
 */
export function computeMoneyAndRelationshipLine(core: CoreSquare): MoneyAndRelationshipLine {
  const entry = sumArcana(core.sum, core.centre);
  const partner = sumArcana(core.year, core.centre);
  const lineCore = sumArcana(entry, partner);

  return {
    entry,
    toEntry: sumArcana(entry, lineCore),
    core: lineCore,
    toPartner: sumArcana(lineCore, partner),
    partner,
  };
}

/**
 * Compute the seven-row chakra health map.
 *
 * Column 1 is always a horizontal-axis (earth) point, column 2 always a
 * vertical-axis (sky) point, column 3 always their sum. Geometrically the rows
 * are a recursive bisection of each axis arm: Vishuddha is the midpoint of
 * (outer, centre), Ajna the midpoint of (outer, Vishuddha), and Anahata the
 * midpoint of (Vishuddha, centre).
 *
 * **Vishuddha is computed first because Ajna and Anahata consume it** — and they
 * consume the *reduced* value, not the raw sum. Every source and implementation
 * chains it that way.
 *
 * Deliberately absent: the summary ("Ключ") row. Only one source publishes a
 * formula for it, the implementations disagree, and one computes it with a
 * single-pass digit sum that is simply wrong once the total exceeds two digits
 * (154 → 4 + 15 = 19, rather than 1 + 5 + 4 = 10). With no defensible answer
 * available, nothing is shipped rather than a guess that would look
 * authoritative on screen. This is the one place the method is left incomplete.
 */
export function computeHealthMap(core: CoreSquare): ChakraRow[] {
  const row = (chakra: ChakraName, physical: Arcana, energy: Arcana): ChakraRow => ({
    chakra,
    physical,
    energy,
    emotional: sumArcana(physical, energy),
  });

  const vishuddhaPhysical = sumArcana(core.day, core.centre);
  const vishuddhaEnergy = sumArcana(core.month, core.centre);

  return [
    row('sahasrara', core.day, core.month),
    row('ajna', sumArcana(core.day, vishuddhaPhysical), sumArcana(core.month, vishuddhaEnergy)),
    row('vishuddha', vishuddhaPhysical, vishuddhaEnergy),
    row(
      'anahata',
      sumArcana(vishuddhaPhysical, core.centre),
      sumArcana(vishuddhaEnergy, core.centre),
    ),
    row('manipura', core.centre, core.centre),
    row('svadhisthana', sumArcana(core.year, core.centre), sumArcana(core.sum, core.centre)),
    row('muladhara', core.year, core.sum),
  ];
}
