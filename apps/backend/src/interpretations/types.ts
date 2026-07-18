import type { InterpretationCategory, InterpretationLocale } from '@astrocalc/calc-engine';

export type { InterpretationCategory, InterpretationLocale };

/** Identifies a single stored interpretation-text row. */
export interface InterpretationKey {
  category: InterpretationCategory;
  subjectKey: string;
  locale: InterpretationLocale;
}

/** A stored interpretation-text row, as returned to the admin panel. */
export interface InterpretationText extends InterpretationKey {
  content: string;
  updatedBy: string | null;
  updatedAt: Date;
}

/** Fields the admin panel (EPIC 10) writes when creating or editing a row. */
export interface InterpretationTextInput {
  content: string;
  /** The admin user id performing the edit, for the audit trail. */
  updatedBy: string | null;
}
