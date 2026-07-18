import { describe, expect, it } from 'vitest';
import { InMemoryInterpretationRepository } from './repository';
import type { InterpretationKey } from './types';

const SUN_ARIES: InterpretationKey = {
  category: 'planet-sign',
  subjectKey: 'sun-Aries',
  locale: 'en',
};
const MOON_ARIES: InterpretationKey = {
  category: 'planet-sign',
  subjectKey: 'moon-Aries',
  locale: 'en',
};

describe('InMemoryInterpretationRepository', () => {
  it('returns null for a row that was never written', async () => {
    const repo = new InMemoryInterpretationRepository();
    expect(await repo.get(SUN_ARIES)).toBeNull();
  });

  it('round-trips an upserted row', async () => {
    const repo = new InMemoryInterpretationRepository();
    await repo.upsert(SUN_ARIES, { content: 'Bold self-expression.', updatedBy: null });

    const row = await repo.get(SUN_ARIES);
    expect(row?.content).toBe('Bold self-expression.');
    expect(row?.category).toBe('planet-sign');
    expect(row?.subjectKey).toBe('sun-Aries');
    expect(row?.locale).toBe('en');
  });

  it('overwrites on a second upsert of the same key', async () => {
    const repo = new InMemoryInterpretationRepository();
    await repo.upsert(SUN_ARIES, { content: 'first draft', updatedBy: null });
    await repo.upsert(SUN_ARIES, { content: 'edited by admin', updatedBy: 'admin-1' });

    const row = await repo.get(SUN_ARIES);
    expect(row?.content).toBe('edited by admin');
    expect(row?.updatedBy).toBe('admin-1');
  });

  it('does not confuse rows that differ only by locale', async () => {
    const repo = new InMemoryInterpretationRepository();
    await repo.upsert(SUN_ARIES, { content: 'english', updatedBy: null });
    await repo.upsert({ ...SUN_ARIES, locale: 'az' }, { content: 'azerbaijani', updatedBy: null });

    expect((await repo.get(SUN_ARIES))?.content).toBe('english');
    expect((await repo.get({ ...SUN_ARIES, locale: 'az' }))?.content).toBe('azerbaijani');
  });

  it('getMany fetches multiple keys in one call and skips missing ones', async () => {
    const repo = new InMemoryInterpretationRepository();
    await repo.upsert(SUN_ARIES, { content: 'sun content', updatedBy: null });

    const rows = await repo.getMany([SUN_ARIES, MOON_ARIES]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.subjectKey).toBe('sun-Aries');
  });

  it('listAll returns every stored row', async () => {
    const repo = new InMemoryInterpretationRepository();
    await repo.upsert(SUN_ARIES, { content: 'a', updatedBy: null });
    await repo.upsert(MOON_ARIES, { content: 'b', updatedBy: null });

    expect(await repo.listAll()).toHaveLength(2);
  });
});
