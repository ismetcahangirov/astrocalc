import type { AspectType, OrbConfigRow, OrbConfigUpdateInput } from './types';

/**
 * Persistence boundary for admin-configured aspect orbs (#15). Kept as an
 * interface so the service is unit-testable against an in-memory store while
 * production uses the Drizzle/Neon implementation
 * (`db/drizzleOrbConfigRepository.ts`).
 */
export interface OrbConfigRepository {
  /** Every stored override — any aspect type without a row falls back to the calc-engine's `DEFAULT_ORBS`. */
  listAll(): Promise<OrbConfigRow[]>;
  /** Create or overwrite one aspect type's override (admin edit). */
  upsert(aspectType: AspectType, input: OrbConfigUpdateInput): Promise<OrbConfigRow>;
}

/** In-memory {@link OrbConfigRepository} for tests and local dev without a database. */
export class InMemoryOrbConfigRepository implements OrbConfigRepository {
  private rows = new Map<AspectType, OrbConfigRow>();

  constructor(private readonly now: () => number = Date.now) {}

  async listAll(): Promise<OrbConfigRow[]> {
    return [...this.rows.values()];
  }

  async upsert(aspectType: AspectType, input: OrbConfigUpdateInput): Promise<OrbConfigRow> {
    const row: OrbConfigRow = {
      aspectType,
      orbDegrees: input.orbDegrees,
      updatedBy: input.updatedBy,
      updatedAt: new Date(this.now()),
    };
    this.rows.set(aspectType, row);
    return row;
  }
}
