import { describe, expect, it } from 'vitest';
import { InMemoryInterpretationRepository } from './repository';
import { seedInterpretations } from './seed';

describe('seedInterpretations', () => {
  it('writes every generated row into an empty repository', async () => {
    const repo = new InMemoryInterpretationRepository();
    const result = await seedInterpretations(repo);

    expect(result.skipped).toBe(0);
    expect(result.written).toBe(1521 * 4);

    const row = await repo.get({ category: 'planet-sign', subjectKey: 'sun-Aries', locale: 'en' });
    expect(row?.content).toContain('The Sun');
    expect(row?.updatedBy).toBeNull();
  });

  it('never overwrites a row that already exists (admin edit or a prior seed run)', async () => {
    const repo = new InMemoryInterpretationRepository();
    await repo.upsert(
      { category: 'planet-sign', subjectKey: 'sun-Aries', locale: 'en' },
      { content: 'Hand-written admin copy.', updatedBy: 'admin-1' },
    );

    const result = await seedInterpretations(repo);

    expect(result.skipped).toBe(1);
    expect(result.written).toBe(1521 * 4 - 1);

    const row = await repo.get({ category: 'planet-sign', subjectKey: 'sun-Aries', locale: 'en' });
    expect(row?.content).toBe('Hand-written admin copy.');
    expect(row?.updatedBy).toBe('admin-1');
  });

  it('is idempotent: a second run writes nothing new', async () => {
    const repo = new InMemoryInterpretationRepository();
    await seedInterpretations(repo);
    const second = await seedInterpretations(repo);

    expect(second.written).toBe(0);
    expect(second.skipped).toBe(1521 * 4);
  });
});
