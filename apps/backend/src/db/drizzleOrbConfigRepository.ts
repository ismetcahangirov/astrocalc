import type { Database } from './client';
import { aspectOrbConfig } from './schema';
import type { OrbConfigRepository } from '../orbConfig/repository';
import type { AspectType, OrbConfigRow, OrbConfigUpdateInput } from '../orbConfig/types';

function toRow(row: typeof aspectOrbConfig.$inferSelect): OrbConfigRow {
  return {
    aspectType: row.aspectType as AspectType,
    orbDegrees: row.orbDegrees,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  };
}

/** Drizzle/Neon-backed {@link OrbConfigRepository}. */
export class DrizzleOrbConfigRepository implements OrbConfigRepository {
  constructor(private readonly db: Database) {}

  async listAll(): Promise<OrbConfigRow[]> {
    const rows = await this.db.select().from(aspectOrbConfig);
    return rows.map(toRow);
  }

  async upsert(aspectType: AspectType, input: OrbConfigUpdateInput): Promise<OrbConfigRow> {
    const [row] = await this.db
      .insert(aspectOrbConfig)
      .values({
        aspectType,
        orbDegrees: input.orbDegrees,
        updatedBy: input.updatedBy,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: aspectOrbConfig.aspectType,
        set: { orbDegrees: input.orbDegrees, updatedBy: input.updatedBy, updatedAt: new Date() },
      })
      .returning();
    if (!row) throw new Error('failed to upsert orb config');
    return toRow(row);
  }
}
