import 'dotenv/config';
import { createDb } from '../db/client';
import { DrizzleInterpretationRepository } from '../db/drizzleInterpretationRepository';
import { generateSeedInterpretations } from './seedContent';
import type { InterpretationRepository } from './repository';

/**
 * Backfill every (category, subjectKey, locale) row `listInterpretationSubjects()`
 * requires with the template-generated baseline content from `seedContent.ts` —
 * 465 astrology combinations (#18) plus 185 numerology and 682 Matrix subjects
 * (#76's content epic), x 4 languages. Only writes rows that don't already
 * exist, so re-running this — or a previous admin edit via the `PUT` endpoint —
 * is never clobbered.
 */
export async function seedInterpretations(
  repo: Pick<InterpretationRepository, 'listAll' | 'upsert'>,
): Promise<{ written: number; skipped: number }> {
  const generated = generateSeedInterpretations();
  const existing = await repo.listAll();
  const existingIds = new Set(existing.map((r) => `${r.category}:${r.subjectKey}:${r.locale}`));

  let written = 0;
  let skipped = 0;
  for (const row of generated) {
    const id = `${row.category}:${row.subjectKey}:${row.locale}`;
    if (existingIds.has(id)) {
      skipped++;
      continue;
    }
    await repo.upsert(
      { category: row.category, subjectKey: row.subjectKey, locale: row.locale },
      { content: row.content, updatedBy: 'seed-script' },
    );
    written++;
  }

  return { written, skipped };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run the interpretation seed script');
  }

  const db = createDb(databaseUrl);
  const repo = new DrizzleInterpretationRepository(db);
  const { written, skipped } = await seedInterpretations(repo);
  console.log(
    `[interpretations:seed] wrote ${written} new rows, skipped ${skipped} existing rows.`,
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[interpretations:seed] failed:', err);
    process.exitCode = 1;
  });
}
