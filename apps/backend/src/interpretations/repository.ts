import type { InterpretationKey, InterpretationText, InterpretationTextInput } from './types';

function rowId(key: InterpretationKey): string {
  return `${key.category}:${key.subjectKey}:${key.locale}`;
}

/**
 * Persistence boundary for natal-chart interpretation text (#18). Kept as an
 * interface so the service is unit-testable against an in-memory store while
 * production uses the Drizzle/Neon implementation
 * (`db/drizzleInterpretationRepository.ts`).
 */
export interface InterpretationRepository {
  get(key: InterpretationKey): Promise<InterpretationText | null>;
  /** Batched lookup — one round trip for every subject a chart screen needs. */
  getMany(keys: InterpretationKey[]): Promise<InterpretationText[]>;
  /** Every stored row, across every category/subject/locale — used by the
   * admin panel's completeness check against
   * `listInterpretationSubjects() × SUPPORTED_LOCALES`. */
  listAll(): Promise<InterpretationText[]>;
  /** Create or overwrite a row (admin edit or seed). */
  upsert(key: InterpretationKey, input: InterpretationTextInput): Promise<InterpretationText>;
}

/** In-memory {@link InterpretationRepository} for tests and local dev without a database. */
export class InMemoryInterpretationRepository implements InterpretationRepository {
  private rows = new Map<string, InterpretationText>();

  constructor(private readonly now: () => number = Date.now) {}

  async get(key: InterpretationKey): Promise<InterpretationText | null> {
    return this.rows.get(rowId(key)) ?? null;
  }

  async getMany(keys: InterpretationKey[]): Promise<InterpretationText[]> {
    const results: InterpretationText[] = [];
    for (const key of keys) {
      const row = this.rows.get(rowId(key));
      if (row) results.push(row);
    }
    return results;
  }

  async listAll(): Promise<InterpretationText[]> {
    return [...this.rows.values()];
  }

  async upsert(key: InterpretationKey, input: InterpretationTextInput): Promise<InterpretationText> {
    const row: InterpretationText = {
      ...key,
      content: input.content,
      updatedBy: input.updatedBy,
      updatedAt: new Date(this.now()),
    };
    this.rows.set(rowId(key), row);
    return row;
  }
}
