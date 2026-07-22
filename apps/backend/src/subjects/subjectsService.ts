import {
  computeDestinyMatrix,
  computeNatalChart,
  computeNumerologyProfile,
  DEFAULT_HOUSE_SYSTEM,
  type NatalChartInput,
  type OrbConfig,
} from '@astrocalc/calc-engine';
import { SubjectNotFoundError } from '../auth/errors';
import { composeFullName, splitFullName } from '../common/personName';
import { birthDataToChartInput } from '../chart/birthChartInput';
import type { ChartCacheKeyInput } from '../chart/chartCacheKey';
import { getOrComputeChart, type ChartResultCache } from '../chart/chartResultCache';
import type { NatalChartResponse } from '../chart/natalChartService';
import { deriveBirthTimezone, type BirthTimezoneResolver } from '../geocoding/birthTimezone';
import type { NumerologyCacheKeyInput } from '../numerology/numerologyCacheKey';
import { numerologyDataToInput } from '../numerology/numerologyInput';
import {
  getOrComputeNumerology,
  type NumerologyResultCache,
} from '../numerology/numerologyResultCache';
import type { NumerologyResponse } from '../numerology/numerologyService';
import type { MatrixCacheKeyInput } from '../matrix/matrixCacheKey';
import { matrixDataToInput } from '../matrix/matrixInput';
import { getOrComputeMatrix, type MatrixResultCache } from '../matrix/matrixResultCache';
import type { MatrixResponse } from '../matrix/matrixService';
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
  /** Compute (and cache) the numerology profile for a subject the caller owns. */
  getNumerology(userId: string, id: string, referenceDate: string): Promise<NumerologyResponse>;
  /** Compute (and cache) the Matrix of Destiny for a subject the caller owns. */
  getMatrix(userId: string, id: string): Promise<MatrixResponse>;
}

export interface SubjectsServiceDeps {
  repo: SubjectRepository;
  chartCache: ChartResultCache;
  numerologyCache: NumerologyResultCache;
  matrixCache: MatrixResultCache;
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
 * Whether a patch changes a field the numerology calculation depends on. A
 * deliberately separate, narrower trigger than {@link patchTouchesBirthData} —
 * numerology also depends on `name` (the birth name), which the chart does
 * not, and does not depend on birth *place*, which the chart does. Mirrors
 * `profileService.ts`'s `touchesNumerologyData`/`NUMEROLOGY_DATA_FIELDS` split
 * for the same reason: folding this into the birth-data check would either
 * drop a still-valid chart on a name-only edit, or leave stale numerology
 * numbers served forever after a rename.
 */
function patchTouchesNumerologyData(patch: SubjectUpdateInput): boolean {
  return (
    'name' in patch ||
    'firstName' in patch ||
    'lastName' in patch ||
    'patronymic' in patch ||
    'birthDate' in patch
  );
}

type NameInput = Pick<SubjectUpdateInput, 'name' | 'firstName' | 'lastName' | 'patronymic'>;
type ResolvedName = { name: string; firstName: string | null; lastName: string | null; patronymic: string | null };

/**
 * Resolve the stored name columns from an input that may carry either the three
 * parts (what the app sends) or the legacy combined `name` (older callers and
 * tests). Parts win: when any is filled in, `name` is composed from them; when
 * only `name` is given, the parts are derived by splitting it — so the combined
 * name and its parts are always written together and stay consistent.
 */
function resolveName(input: NameInput): ResolvedName {
  const hasParts =
    (input.firstName?.trim() ?? '') !== '' ||
    (input.lastName?.trim() ?? '') !== '' ||
    (input.patronymic?.trim() ?? '') !== '';
  if (hasParts) {
    const parts = {
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      patronymic: input.patronymic ?? null,
    };
    return { name: composeFullName(parts) ?? '', ...parts };
  }
  const name = (input.name ?? '').trim();
  return { name, ...splitFullName(name) };
}

/**
 * Whether a patch changes the one field the Matrix calculation depends on.
 * Narrower again than {@link patchTouchesNumerologyData}: the Matrix reads the
 * birth date and nothing else, so a rename that must drop this subject's
 * numerology numbers leaves their Matrix perfectly valid. Mirrors
 * `profileService.ts`'s `MATRIX_DATA_FIELDS` for the same reason.
 */
function patchTouchesMatrixData(patch: SubjectUpdateInput): boolean {
  return 'birthDate' in patch;
}

/**
 * CRUD + chart + numerology computation for saved subjects (#s2, #64). Every
 * method is scoped to the calling `userId`, so a user can only ever read or
 * mutate their own subjects. Like profiles, `birthPlaceTimezone` is derived
 * server-side from the coordinates (never trusted from the client), and a
 * subject's cached chart and cached numerology — each namespaced under its own
 * id, never `userId` — are invalidated independently whenever the data they
 * depend on changes.
 */
export function createSubjectsService(deps: SubjectsServiceDeps): SubjectsService {
  const {
    repo,
    chartCache,
    numerologyCache,
    matrixCache,
    orbConfig,
    deriveTimezone = deriveBirthTimezone,
  } = deps;

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
      return repo.create(userId, { ...input, ...resolveName(input), birthPlaceTimezone: timezone });
    },

    async update(userId, id, patch) {
      const existing = await repo.get(userId, id);
      if (!existing) throw new SubjectNotFoundError();

      let patchToApply: SubjectPatchData = patch;

      // Recompose the stored name whenever the patch touches any name field.
      // The app sends all three parts together; a lone part still merges with
      // the subject's existing ones, and a legacy `name`-only patch re-derives
      // the parts by splitting it.
      const touchesParts =
        'firstName' in patch || 'lastName' in patch || 'patronymic' in patch;
      if (touchesParts) {
        const parts = {
          firstName: 'firstName' in patch ? (patch.firstName ?? null) : existing.firstName,
          lastName: 'lastName' in patch ? (patch.lastName ?? null) : existing.lastName,
          patronymic: 'patronymic' in patch ? (patch.patronymic ?? null) : existing.patronymic,
        };
        patchToApply = { ...patchToApply, ...parts, name: composeFullName(parts) ?? existing.name };
      } else if ('name' in patch) {
        const name = (patch.name ?? '').trim();
        patchToApply = { ...patchToApply, name, ...splitFullName(name) };
      }

      // Re-derive the timezone from the effective coordinates whenever the patch
      // touches either coordinate; otherwise leave the stored zone untouched.
      if ('birthPlaceLat' in patch || 'birthPlaceLng' in patch) {
        const lat = 'birthPlaceLat' in patch ? patch.birthPlaceLat : existing.birthPlaceLat;
        const lng = 'birthPlaceLng' in patch ? patch.birthPlaceLng : existing.birthPlaceLng;
        patchToApply = { ...patchToApply, birthPlaceTimezone: deriveTimezone(lat, lng) };
      }

      const updated = await repo.update(userId, id, patchToApply);
      if (!updated) throw new SubjectNotFoundError();

      if (patchTouchesBirthData(patch)) await chartCache.invalidate(id);
      if (patchTouchesNumerologyData(patch)) await numerologyCache.invalidate(id);
      if (patchTouchesMatrixData(patch)) await matrixCache.invalidate(id);
      return updated;
    },

    async remove(userId, id) {
      const deleted = await repo.delete(userId, id);
      if (!deleted) throw new SubjectNotFoundError();
      await chartCache.invalidate(id);
      await numerologyCache.invalidate(id);
      await matrixCache.invalidate(id);
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

    async getNumerology(userId, id, referenceDate) {
      const subject = await repo.get(userId, id);
      if (!subject) throw new SubjectNotFoundError();

      const input = numerologyDataToInput(subject, referenceDate);
      const key: NumerologyCacheKeyInput = {
        fullName: input.fullName,
        birthDate: input.birthDate,
        referenceMonth: referenceDate.slice(0, 7),
      };
      // Cache is namespaced by the subject id (never userId) — that is what lets
      // two subjects belonging to the same user cache and invalidate their
      // numerology independently, exactly as `getChart` does above.
      const profile = await getOrComputeNumerology(numerologyCache, id, key, async () =>
        computeNumerologyProfile(input),
      );
      return { profile, interpretation: null };
    },

    async getMatrix(userId, id) {
      const subject = await repo.get(userId, id);
      if (!subject) throw new SubjectNotFoundError();

      const input = matrixDataToInput(subject);
      const key: MatrixCacheKeyInput = { birthDate: input.birthDate };
      // Namespaced by the subject id (never userId), exactly as `getChart` and
      // `getNumerology` are — two subjects of the same user cache and
      // invalidate their Matrices independently.
      const matrix = await getOrComputeMatrix(matrixCache, id, key, async () =>
        computeDestinyMatrix(input),
      );
      return { matrix, interpretation: null };
    },
  };
}
