import type { AspectType } from '@astrocalc/calc-engine';

export type { AspectType };

/** A stored admin-configured orb override for one aspect type (#15). */
export interface OrbConfigRow {
  aspectType: AspectType;
  orbDegrees: number;
  /** Admin user who last changed this value, for the audit trail. */
  updatedBy: string | null;
  updatedAt: Date;
}

/** Fields the admin panel (EPIC 10) writes when editing an aspect's orb. */
export interface OrbConfigUpdateInput {
  orbDegrees: number;
  updatedBy: string | null;
}
