import { computeAncestralSquare, type AncestralSquare } from './ancestral';
import { computeCoreSquare, type CoreSquare } from './core';
import {
  computeHealthMap,
  computeHealthSummary,
  computeMoneyAndRelationshipLine,
  type ChakraRow,
  type HealthSummary,
  type MoneyAndRelationshipLine,
} from './lines';
import { computePurposes, type Purposes } from './purposes';

/**
 * Matrix of Destiny assembly (#72): the single, platform-independent function
 * that turns a birth date into a full set of arcana.
 *
 * Mirrors `computeNatalChart()` and `computeNumerologyProfile()` — one
 * composition point, plain JSON out, no Node built-ins, so the backend and the
 * device compute identical results.
 *
 * **Methodology: Natalia Ladini**, reconstructed and cross-validated in
 * `docs/superpowers/specs/2026-07-20-matrix-of-destiny-ladini-method.md`. That
 * document is the definition of "correct" for everything here; a disagreement
 * between this code and a reference calculator is a bug in one of them, and the
 * spec's §7 lists the divergences that were considered and rejected so a future
 * reader can tell a rejected variant from an unnoticed one.
 *
 * Deliberately *not* included here: interpretation / reading text. That is
 * Pro-only data that stays behind the backend (spec §5.1), so it is never part
 * of the on-device calculation.
 */

/**
 * Version of the {@link DestinyMatrix} shape, bumped on any breaking change.
 * v2 added the health-map summary row ({@link DestinyMatrix.healthSummary}).
 */
export const MATRIX_SCHEMA_VERSION = 2;

export interface MatrixInput {
  /** Civil birth date, `YYYY-MM-DD`. The only input the Matrix takes. */
  birthDate: string;
}

export interface DestinyMatrix {
  schemaVersion: number;
  /** Echoed back so a stored result is self-describing. */
  birthDate: string;
  /** The four cardinal points and the centre. */
  core: CoreSquare;
  /** The diagonal corners, the paternal/maternal lines, and the ancestral centre. */
  ancestral: AncestralSquare;
  /** Sky, earth, and the four purposes. */
  purposes: Purposes;
  /**
   * The five arcana both the money channel and the relationship channel are read
   * from — one line, two readings. See {@link MoneyAndRelationshipLine}.
   */
  moneyAndRelationships: MoneyAndRelationshipLine;
  /**
   * The seven chakra rows, crown to root.
   *
   * The Svadhisthana row's two cells are the same arcana as
   * {@link DestinyMatrix.moneyAndRelationships}'s `partner` and `entry`. That
   * repetition is real rather than an assembly mistake: the money/relationship
   * line *sits on* the Svadhisthana row, which is exactly how the sources
   * describe it. The two are kept as separate structures because they are read
   * as separate things — a line has an order and a middle, a chakra row has a
   * physical/energy/emotional split.
   */
  health: ChakraRow[];
  /** The summary ("Ключ") row: each health column totalled across the seven chakras. */
  healthSummary: HealthSummary;
}

/**
 * Compute a complete Matrix of Destiny.
 *
 * The core square is computed once and threaded into every other block, rather
 * than each block re-deriving it from the birth date. That is not only cheaper:
 * every downstream position is defined in terms of the *reduced* cardinal
 * points, so re-deriving would create four more chances to reduce in the wrong
 * order — the failure mode the method spec calls out as the most common way to
 * produce a plausible, wholly wrong Matrix.
 *
 * @throws {CalcEngineError} `invalid_input` for a malformed or impossible date.
 */
export function computeDestinyMatrix(input: MatrixInput): DestinyMatrix {
  const core = computeCoreSquare(input.birthDate);
  const ancestral = computeAncestralSquare(core);
  const health = computeHealthMap(core);

  return {
    schemaVersion: MATRIX_SCHEMA_VERSION,
    birthDate: input.birthDate,
    core,
    ancestral,
    purposes: computePurposes(core, ancestral),
    moneyAndRelationships: computeMoneyAndRelationshipLine(core),
    health,
    healthSummary: computeHealthSummary(health),
  };
}

export type { Arcana } from './reduce';
export { ARCANA_COUNT, ARCANA_VALUES, isArcana } from './reduce';
export type { CoreSquare } from './core';
export type { AncestralCorner, AncestralSquare } from './ancestral';
export type { Purposes } from './purposes';
export {
  CHAKRA_ORDER,
  type ChakraName,
  type ChakraRow,
  type HealthSummary,
  type MoneyAndRelationshipLine,
} from './lines';
