import {
  computeNatalChart,
  DEFAULT_HOUSE_SYSTEM,
  type NatalChartInput,
  type OrbConfig,
} from '@astrocalc/calc-engine';
import { SubjectNotFoundError } from '../auth/errors';
import { birthDataToChartInput } from '../chart/birthChartInput';
import type { ChartCacheKeyInput } from '../chart/chartCacheKey';
import { getOrComputeChart, type ChartResultCache } from '../chart/chartResultCache';
import type { NatalChartResponse } from '../chart/natalChartService';
import { deriveBirthTimezone, type BirthTimezoneResolver } from '../geocoding/birthTimezone';
import type { OrbConfigService } from '../orbConfig/orbConfigService';
import type { SubjectRepository } from './repository';
import type { Subject, SubjectCreateInput, SubjectPatchData, SubjectUpdateInput } from './types';

export interface SubjectsService {
  list(userId: string): Promise<Subject[]>;
  get(userId: string, id: string): Promise<Subject>;
  create(userId: string, input: SubjectCreateInput): Promise<Subject>;
  update(userId: string, id: string, patch: SubjectUpdateInput): Promise<Subject>;
  remove(userId: string, id: string): Promise<void>;
  /** Compute (and cache) the chart for a subject the caller owns. */
  getChart(userId: string, id: string): Promise<NatalChartResponse>;
}

export interface SubjectsServiceDeps {
  repo: SubjectRepository;
  chartCache: ChartResultCache;
  orbConfig: OrbConfigService;
  /** Coordinate → IANA timezone resolver; defaults to the real `geo-tz` lookup. */
  deriveTimezone?: BirthTimezoneResolver;
}

function toCacheKey(input: NatalChartInput, orbs: OrbConfig): ChartCacheKeyInput {
  return {
    birthDate: input.birthDate,
    birthTime: input.birthTimeKnown ? (input.birthTime ?? null) : null,
    lat: input.latitude,
    lng: input.longitude,
    houseSystem: DEFAULT_HOUSE_SYSTEM,
    orbConfig: orbs,
  };
}

/** Whether a patch changes a field the chart calculation depends on. */
function patchTouchesBirthData(patch: SubjectUpdateInput): boolean {
  return (
    'birthDate' in patch ||
    'birthTime' in patch ||
    'birthTimeKnown' in patch ||
    'birthPlaceLat' in patch ||
    'birthPlaceLng' in patch
  );
}

/**
 * CRUD + chart computation for saved subjects (#s2). Every method is scoped to
 * the calling `userId`, so a user can only ever read or mutate their own
 * subjects. Like profiles, `birthPlaceTimezone` is derived server-side from the
 * coordinates (never trusted from the client), and a subject's cached chart —
 * namespaced under its own id — is invalidated whenever its birth data changes.
 */
export function createSubjectsService(deps: SubjectsServiceDeps): SubjectsService {
  const { repo, chartCache, orbConfig, deriveTimezone = deriveBirthTimezone } = deps;

  return {
    async list(userId) {
      return repo.list(userId);
    },

    async get(userId, id) {
      const subject = await repo.get(userId, id);
      if (!subject) throw new SubjectNotFoundError();
      return subject;
    },

    async create(userId, input) {
      const timezone = deriveTimezone(input.birthPlaceLat, input.birthPlaceLng);
      return repo.create(userId, { ...input, birthPlaceTimezone: timezone });
    },

    async update(userId, id, patch) {
      const existing = await repo.get(userId, id);
      if (!existing) throw new SubjectNotFoundError();

      // Re-derive the timezone from the effective coordinates whenever the patch
      // touches either coordinate; otherwise leave the stored zone untouched.
      let patchToApply: SubjectPatchData = patch;
      if ('birthPlaceLat' in patch || 'birthPlaceLng' in patch) {
        const lat = 'birthPlaceLat' in patch ? patch.birthPlaceLat : existing.birthPlaceLat;
        const lng = 'birthPlaceLng' in patch ? patch.birthPlaceLng : existing.birthPlaceLng;
        patchToApply = { ...patch, birthPlaceTimezone: deriveTimezone(lat, lng) };
      }

      const updated = await repo.update(userId, id, patchToApply);
      if (!updated) throw new SubjectNotFoundError();

      if (patchTouchesBirthData(patch)) await chartCache.invalidate(id);
      return updated;
    },

    async remove(userId, id) {
      const deleted = await repo.delete(userId, id);
      if (!deleted) throw new SubjectNotFoundError();
      await chartCache.invalidate(id);
    },

    async getChart(userId, id) {
      const subject = await repo.get(userId, id);
      if (!subject) throw new SubjectNotFoundError();

      const input = birthDataToChartInput(subject);
      const orbs = await orbConfig.getEffectiveOrbs();
      const key = toCacheKey(input, orbs);
      // Cache is namespaced by the subject id, so each person's chart caches
      // and invalidates independently.
      const chart = await getOrComputeChart(chartCache, id, key, async () =>
        computeNatalChart(input, { houseSystem: DEFAULT_HOUSE_SYSTEM, orbs }),
      );
      return { chart, interpretation: null };
    },
  };
}
