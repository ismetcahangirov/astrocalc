/**
 * A computed numerology number, carrying not just the final value but the two
 * facts a reading depends on: whether it is a master number that was left
 * unreduced, and whether a karmic-debt number was passed through on the way
 * down. Both are lost if only the reduced digit is kept, which is why this is
 * an object rather than a bare `number`.
 */
export interface NumerologyNumber {
  /** The final value: 1–9, or a preserved master number (11, 22, 33). */
  value: number;
  /** True when {@link value} is a master number that was deliberately not reduced. */
  isMaster: boolean;
  /** The karmic-debt number (13, 14, 16 or 19) seen while reducing, else `null`. */
  karmicDebt: number | null;
}
