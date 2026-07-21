import { matrixSubjectKey, type ChakraName, type DestinyMatrix } from '@astrocalc/calc-engine';

/**
 * The per-chakra reading of the health map (#99).
 *
 * The chakra *calculation* already exists — `computeHealthMap()` in the
 * calc-engine gives the seven rows, and `MatrixScreen` renders their
 * physical/energy/emotional numbers. What this module adds is the mapping from
 * those rows to the interpretation text the backend already holds, so the
 * numbers become a reading.
 *
 * Pure and React-free (like `matrixText.ts`), so the subject-key and ordering
 * logic unit-test without the network or a component.
 */

/** The interpretation subject that carries one chakra's reading. */
export interface ChakraReadingSubject {
  chakra: ChakraName;
  /** A `matrix`-category subject key, e.g. `chakra-anahata-12`. */
  subjectKey: string;
}

/**
 * The seven subject keys whose text is a chakra's reading, in health-map order.
 *
 * A chakra row carries three arcana — physical, energy, and their reduced sum
 * (emotional) — but the reading is written **per position, not per cell**: the
 * seeded content frames every arcana with the same "Anahata — the heart chakra…"
 * sentence regardless of column (see the backend's `composeMatrix`). So one of
 * the three arcana has to stand for the row, and we use the **emotional** cell:
 * it is `reduceToArcana(physical + energy)`, the single arcana that integrates
 * the chakra's two source points and the value the row is summarised by. This is
 * the one place that choice is made; changing which cell a chakra reads from is
 * a one-line edit here.
 */
export function chakraReadingSubjects(matrix: DestinyMatrix): ChakraReadingSubject[] {
  return matrix.health.map((row) => ({
    chakra: row.chakra,
    subjectKey: matrixSubjectKey(`chakra-${row.chakra}`, row.emotional),
  }));
}

/** One chakra's resolved reading, ready to render. */
export interface ChakraReading {
  chakra: ChakraName;
  content: string;
}

/**
 * Match fetched interpretation texts back to their chakras, in health-map order
 * (crown to root). A chakra whose text the backend did not return — no content
 * for that arcana, or a partial batch — is dropped rather than rendered blank,
 * so the reading list is always as long as the content that actually exists.
 */
export function orderChakraReadings(
  matrix: DestinyMatrix,
  contentBySubjectKey: ReadonlyMap<string, string>,
): ChakraReading[] {
  return chakraReadingSubjects(matrix).flatMap(({ chakra, subjectKey }) => {
    const content = contentBySubjectKey.get(subjectKey);
    return content ? [{ chakra, content }] : [];
  });
}
