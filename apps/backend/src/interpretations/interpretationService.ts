import {
  FALLBACK_LOCALE,
  INTERPRETED_BODIES,
  SUPPORTED_LOCALES,
  aspectSubjectKey,
  findHouseNumber,
  houseSubjectKey,
  listInterpretationSubjects,
  planetHouseSubjectKey,
  planetSignSubjectKey,
  type Aspect,
  type HouseCusp,
  type InterpretationLocale,
  type PlanetPosition,
} from '@astrocalc/calc-engine';
import type { InterpretationCache } from './cache';
import type { InterpretationRepository } from './repository';
import type {
  InterpretationCategory,
  InterpretationKey,
  InterpretationText,
  InterpretationTextInput,
} from './types';

export interface InterpretationServiceConfig {
  /** How long a resolved row is cached (seconds). */
  cacheTtlSeconds: number;
}

export interface InterpretationServiceDeps {
  repo: InterpretationRepository;
  cache: InterpretationCache;
  config: InterpretationServiceConfig;
}

/** A subject identifier without locale — what a chart-rendering caller asks for. */
export interface InterpretationSubjectQuery {
  category: InterpretationCategory;
  subjectKey: string;
}

/** A resolved interpretation, with transparent fallback-locale bookkeeping. */
export interface ResolvedInterpretation extends InterpretationSubjectQuery {
  content: string;
  /** The locale actually served — equals the request unless a fallback occurred. */
  locale: InterpretationLocale;
  /** `true` when the requested locale had no content and {@link FALLBACK_LOCALE} was served instead. */
  isFallback: boolean;
}

/** The subset of a computed natal chart {@link getForComputedChart} needs. */
export interface ComputedChartInput {
  positions: Pick<PlanetPosition, 'body' | 'sign' | 'longitude'>[];
  /** House cusps, when the birth time is known. Omit to skip planet-house text. */
  cusps?: HouseCusp[];
  aspects?: Pick<Aspect, 'bodyA' | 'bodyB' | 'type'>[];
}

export interface ComputedChartInterpretation {
  planetSign: ResolvedInterpretation[];
  planetHouse: ResolvedInterpretation[];
  /** The 12 generic house meanings — empty when the birth time (and so cusps) is unknown. */
  houses: ResolvedInterpretation[];
  aspects: ResolvedInterpretation[];
}

export interface InterpretationService {
  /** Resolve one subject, falling back to {@link FALLBACK_LOCALE} if the requested locale is missing. */
  getText(
    subject: InterpretationSubjectQuery,
    locale: InterpretationLocale,
  ): Promise<ResolvedInterpretation | null>;
  /** Resolve many subjects in one call — what a chart result screen needs. */
  getBatch(
    subjects: InterpretationSubjectQuery[],
    locale: InterpretationLocale,
  ): Promise<ResolvedInterpretation[]>;
  /** Admin create/edit (EPIC 10). Invalidates the cache entry so the next read is fresh. */
  upsertText(key: InterpretationKey, input: InterpretationTextInput): Promise<InterpretationText>;
  /**
   * Every (category, subjectKey, locale) combination required by
   * `listInterpretationSubjects() × SUPPORTED_LOCALES` that has no stored row
   * yet — the admin panel's completeness checklist.
   */
  listMissing(): Promise<InterpretationKey[]>;
  /** Compose the full interpretation set for an already-computed natal chart. */
  getForComputedChart(
    chart: ComputedChartInput,
    locale: InterpretationLocale,
  ): Promise<ComputedChartInterpretation>;
}

const INTERPRETED_BODY_SET = new Set<string>(INTERPRETED_BODIES);

export function createInterpretationService(
  deps: InterpretationServiceDeps,
): InterpretationService {
  const { repo, cache, config } = deps;

  async function readThrough(key: InterpretationKey): Promise<InterpretationText | null> {
    const cached = await cache.get(key);
    if (cached) return cached;
    const stored = await repo.get(key);
    if (stored) await cache.set(key, stored, config.cacheTtlSeconds);
    return stored;
  }

  async function resolveOne(
    subject: InterpretationSubjectQuery,
    locale: InterpretationLocale,
  ): Promise<ResolvedInterpretation | null> {
    const primary = await readThrough({ ...subject, locale });
    if (primary) return { ...subject, content: primary.content, locale, isFallback: false };

    if (locale === FALLBACK_LOCALE) return null;
    const fallback = await readThrough({ ...subject, locale: FALLBACK_LOCALE });
    if (!fallback) return null;
    return { ...subject, content: fallback.content, locale: FALLBACK_LOCALE, isFallback: true };
  }

  async function getBatch(
    subjects: InterpretationSubjectQuery[],
    locale: InterpretationLocale,
  ): Promise<ResolvedInterpretation[]> {
    const resolved = await Promise.all(subjects.map((subject) => resolveOne(subject, locale)));
    return resolved.filter((r): r is ResolvedInterpretation => r !== null);
  }

  return {
    getText: resolveOne,
    getBatch,

    async upsertText(key, input) {
      const row = await repo.upsert(key, input);
      await cache.invalidate(key);
      return row;
    },

    async listMissing() {
      const required = listInterpretationSubjects();
      const existing = await repo.listAll();
      const existingIds = new Set(existing.map((r) => `${r.category}:${r.subjectKey}:${r.locale}`));

      const missing: InterpretationKey[] = [];
      for (const subject of required) {
        for (const locale of SUPPORTED_LOCALES) {
          if (!existingIds.has(`${subject.category}:${subject.subjectKey}:${locale}`)) {
            missing.push({ category: subject.category, subjectKey: subject.subjectKey, locale });
          }
        }
      }
      return missing;
    },

    async getForComputedChart(chart, locale) {
      const interpretedPositions = chart.positions.filter((p) => INTERPRETED_BODY_SET.has(p.body));

      const planetSignQueries = interpretedPositions.map((p) => ({
        category: 'planet-sign' as const,
        subjectKey: planetSignSubjectKey(p.body, p.sign),
      }));

      const planetHouseQueries = chart.cusps
        ? interpretedPositions.map((p) => ({
            category: 'planet-house' as const,
            subjectKey: planetHouseSubjectKey(p.body, findHouseNumber(chart.cusps!, p.longitude)),
          }))
        : [];

      // House meanings are generic (1–12), independent of the chart's data, but
      // only returned when cusps exist so they line up with the "houses shown
      // only with a known birth time" rule the result screen follows.
      const houseQueries = chart.cusps
        ? Array.from({ length: 12 }, (_, i) => ({
            category: 'house' as const,
            subjectKey: houseSubjectKey(i + 1),
          }))
        : [];

      const aspectQueries = (chart.aspects ?? [])
        .filter((a) => INTERPRETED_BODY_SET.has(a.bodyA) && INTERPRETED_BODY_SET.has(a.bodyB))
        .map((a) => ({
          category: 'aspect' as const,
          subjectKey: aspectSubjectKey(a.type, a.bodyA, a.bodyB),
        }));

      const [planetSign, planetHouse, houses, aspects] = await Promise.all([
        getBatch(planetSignQueries, locale),
        getBatch(planetHouseQueries, locale),
        getBatch(houseQueries, locale),
        getBatch(aspectQueries, locale),
      ]);

      return { planetSign, planetHouse, houses, aspects };
    },
  };
}
