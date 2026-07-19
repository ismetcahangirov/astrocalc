import { describe, expect, it } from 'vitest';
import { InMemoryOrbConfigRepository } from './repository';

describe('InMemoryOrbConfigRepository', () => {
  it('returns an empty list when nothing has been configured', async () => {
    const repo = new InMemoryOrbConfigRepository();
    expect(await repo.listAll()).toEqual([]);
  });

  it('round-trips an upserted row', async () => {
    const repo = new InMemoryOrbConfigRepository();
    await repo.upsert('trine', { orbDegrees: 5, updatedBy: null });

    const rows = await repo.listAll();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ aspectType: 'trine', orbDegrees: 5, updatedBy: null });
  });

  it('overwrites on a second upsert of the same aspect type', async () => {
    const repo = new InMemoryOrbConfigRepository();
    await repo.upsert('square', { orbDegrees: 7, updatedBy: null });
    await repo.upsert('square', { orbDegrees: 4, updatedBy: 'admin-1' });

    const rows = await repo.listAll();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ aspectType: 'square', orbDegrees: 4, updatedBy: 'admin-1' });
  });

  it('keeps different aspect types as separate rows', async () => {
    const repo = new InMemoryOrbConfigRepository();
    await repo.upsert('conjunction', { orbDegrees: 8, updatedBy: null });
    await repo.upsert('sextile', { orbDegrees: 3, updatedBy: null });

    const rows = await repo.listAll();
    expect(rows).toHaveLength(2);
  });
});
