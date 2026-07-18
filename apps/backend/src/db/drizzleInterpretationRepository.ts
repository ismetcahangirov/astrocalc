import { and, eq, or } from 'drizzle-orm';
import type { Database } from './client';
import { interpretationTexts, type InterpretationTextRow } from './schema';
import type { InterpretationRepository } from '../interpretations/repository';
import type {
  InterpretationCategory,
  InterpretationKey,
  InterpretationLocale,
  InterpretationText,
  InterpretationTextInput,
} from '../interpretations/types';

function toText(row: InterpretationTextRow): InterpretationText {
  return {
    category: row.category as InterpretationCategory,
    subjectKey: row.subjectKey,
    locale: row.locale as InterpretationLocale,
    content: row.content,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  };
}

function matches(key: InterpretationKey) {
  return and(
    eq(interpretationTexts.category, key.category),
    eq(interpretationTexts.subjectKey, key.subjectKey),
    eq(interpretationTexts.locale, key.locale),
  );
}

/** Drizzle/Neon-backed {@link InterpretationRepository}. */
export class DrizzleInterpretationRepository implements InterpretationRepository {
  constructor(private readonly db: Database) {}

  async get(key: InterpretationKey): Promise<InterpretationText | null> {
    const [row] = await this.db.select().from(interpretationTexts).where(matches(key)).limit(1);
    return row ? toText(row) : null;
  }

  async getMany(keys: InterpretationKey[]): Promise<InterpretationText[]> {
    if (keys.length === 0) return [];
    const rows = await this.db
      .select()
      .from(interpretationTexts)
      .where(or(...keys.map((key) => matches(key))));
    return rows.map(toText);
  }

  async listAll(): Promise<InterpretationText[]> {
    const rows = await this.db.select().from(interpretationTexts);
    return rows.map(toText);
  }

  async upsert(
    key: InterpretationKey,
    input: InterpretationTextInput,
  ): Promise<InterpretationText> {
    const [row] = await this.db
      .insert(interpretationTexts)
      .values({ ...key, content: input.content, updatedBy: input.updatedBy, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [
          interpretationTexts.category,
          interpretationTexts.subjectKey,
          interpretationTexts.locale,
        ],
        set: { content: input.content, updatedBy: input.updatedBy, updatedAt: new Date() },
      })
      .returning();
    if (!row) throw new Error('failed to upsert interpretation text');
    return toText(row);
  }
}
