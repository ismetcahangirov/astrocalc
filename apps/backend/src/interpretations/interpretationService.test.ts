import type { HouseCusp } from '@astrocalc/calc-engine';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryInterpretationCache } from './cache';
import { createInterpretationService, type InterpretationService } from './interpretationService';
import { InMemoryInterpretationRepository } from './repository';

function buildService(): {
  service: InterpretationService;
  repo: InMemoryInterpretationRepository;
} {
  const repo = new InMemoryInterpretationRepository();
  const cache = new InMemoryInterpretationCache();
  const service = createInterpretationService({ repo, cache, config: { cacheTtlSeconds: 3600 } });
  return { service, repo };
}

describe('createInterpretationService', () => {
  describe('getText', () => {
    it('returns null when no content exists in the requested or fallback locale', async () => {
      const { service } = buildService();
      const result = await service.getText(
        { category: 'planet-sign', subjectKey: 'sun-Aries' },
        'tr',
      );
      expect(result).toBeNull();
    });

    it('returns the requested locale when it exists', async () => {
      const { service, repo } = buildService();
      await repo.upsert(
        { category: 'planet-sign', subjectKey: 'sun-Aries', locale: 'tr' },
        { content: 'Türkçe metin', updatedBy: null },
      );

      const result = await service.getText(
        { category: 'planet-sign', subjectKey: 'sun-Aries' },
        'tr',
      );
      expect(result).toEqual({
        category: 'planet-sign',
        subjectKey: 'sun-Aries',
        content: 'Türkçe metin',
        locale: 'tr',
        isFallback: false,
      });
    });

    it('falls back to English when the requested locale is missing', async () => {
      const { service, repo } = buildService();
      await repo.upsert(
        { category: 'planet-sign', subjectKey: 'sun-Aries', locale: 'en' },
        { content: 'English text', updatedBy: null },
      );

      const result = await service.getText(
        { category: 'planet-sign', subjectKey: 'sun-Aries' },
        'ru',
      );
      expect(result).toEqual({
        category: 'planet-sign',
        subjectKey: 'sun-Aries',
        content: 'English text',
        locale: 'en',
        isFallback: true,
      });
    });
  });

  describe('caching', () => {
    it('serves a later read from cache without hitting the repository again', async () => {
      const { service, repo } = buildService();
      await repo.upsert(
        { category: 'planet-sign', subjectKey: 'sun-Aries', locale: 'en' },
        { content: 'first', updatedBy: null },
      );
      await service.getText({ category: 'planet-sign', subjectKey: 'sun-Aries' }, 'en');

      // Mutate the repo directly (bypassing the service) — a cached read must
      // not see this until the cache is invalidated.
      await repo.upsert(
        { category: 'planet-sign', subjectKey: 'sun-Aries', locale: 'en' },
        { content: 'changed behind the cache', updatedBy: null },
      );

      const result = await service.getText(
        { category: 'planet-sign', subjectKey: 'sun-Aries' },
        'en',
      );
      expect(result?.content).toBe('first');
    });

    it('upsertText invalidates the cache so the next read is fresh', async () => {
      const { service } = buildService();
      await service.upsertText(
        { category: 'planet-sign', subjectKey: 'sun-Aries', locale: 'en' },
        { content: 'v1', updatedBy: null },
      );
      await service.getText({ category: 'planet-sign', subjectKey: 'sun-Aries' }, 'en');

      await service.upsertText(
        { category: 'planet-sign', subjectKey: 'sun-Aries', locale: 'en' },
        { content: 'v2', updatedBy: 'admin-1' },
      );

      const result = await service.getText(
        { category: 'planet-sign', subjectKey: 'sun-Aries' },
        'en',
      );
      expect(result?.content).toBe('v2');
    });
  });

  describe('getBatch', () => {
    it('resolves multiple subjects and silently drops ones with no content anywhere', async () => {
      const { service, repo } = buildService();
      await repo.upsert(
        { category: 'planet-sign', subjectKey: 'sun-Aries', locale: 'en' },
        { content: 'sun in aries', updatedBy: null },
      );

      const results = await service.getBatch(
        [
          { category: 'planet-sign', subjectKey: 'sun-Aries' },
          { category: 'planet-sign', subjectKey: 'moon-Aries' },
        ],
        'en',
      );

      expect(results).toHaveLength(1);
      expect(results[0]?.subjectKey).toBe('sun-Aries');
    });
  });

  describe('listMissing', () => {
    it('reports every required subject/locale combination as missing on an empty store', async () => {
      const { service } = buildService();
      const missing = await service.listMissing();
      // 10 planets x 12 signs + 10 planets x 12 houses + 45 pairs x 5 aspects (465)
      // + 12 house meanings + 24 angle-in-sign meanings (#106) + 185 numerology
      // + 682 matrix subjects (folded in by #82 and #80/#81), x4 locales.
      expect(missing.length).toBe((10 * 12 + 10 * 12 + 45 * 5 + 12 + 24 + 185 + 682) * 4);
    });

    it('shrinks as rows are added and is empty once everything is seeded', async () => {
      const { service, repo } = buildService();
      const before = (await service.listMissing()).length;
      await repo.upsert(
        { category: 'planet-sign', subjectKey: 'sun-Aries', locale: 'en' },
        { content: 'x', updatedBy: null },
      );
      const after = await service.listMissing();
      expect(after.length).toBe(before - 1);
      expect(after.some((m) => m.subjectKey === 'sun-Aries' && m.locale === 'en')).toBe(false);
    });
  });

  describe('getForComputedChart', () => {
    /** Whole Sign cusps starting at 0° Aries: house N spans [(N-1)*30, N*30). */
    const cusps: HouseCusp[] = Array.from({ length: 12 }, (_, i) => ({
      house: i + 1,
      longitude: i * 30,
      sign: 'Aries',
      degree: 0,
    }));

    let service: InterpretationService;
    let repo: InMemoryInterpretationRepository;

    beforeEach(() => {
      ({ service, repo } = buildService());
    });

    it('composes planet-sign, planet-house, and aspect interpretations from computed placements', async () => {
      await repo.upsert(
        { category: 'planet-sign', subjectKey: 'sun-Aries', locale: 'en' },
        { content: 'Sun in Aries text', updatedBy: null },
      );
      await repo.upsert(
        { category: 'planet-house', subjectKey: 'sun-1', locale: 'en' },
        { content: 'Sun in house 1 text', updatedBy: null },
      );
      await repo.upsert(
        { category: 'aspect', subjectKey: 'conjunction-moon-sun', locale: 'en' },
        { content: 'Sun conjunct Moon text', updatedBy: null },
      );

      const result = await service.getForComputedChart(
        {
          positions: [
            { body: 'sun', sign: 'Aries', longitude: 5 },
            { body: 'moon', sign: 'Taurus', longitude: 40 },
          ],
          cusps,
          aspects: [{ bodyA: 'sun', bodyB: 'moon', type: 'conjunction' }],
        },
        'en',
      );

      expect(result.planetSign).toHaveLength(1);
      expect(result.planetSign[0]?.content).toBe('Sun in Aries text');
      expect(result.planetHouse).toHaveLength(1);
      expect(result.planetHouse[0]?.content).toBe('Sun in house 1 text');
      expect(result.aspects).toHaveLength(1);
      expect(result.aspects[0]?.content).toBe('Sun conjunct Moon text');
    });

    it('omits planet-house interpretations when cusps are not provided (unknown birth time)', async () => {
      await repo.upsert(
        { category: 'planet-sign', subjectKey: 'sun-Aries', locale: 'en' },
        { content: 'Sun in Aries text', updatedBy: null },
      );

      const result = await service.getForComputedChart(
        { positions: [{ body: 'sun', sign: 'Aries', longitude: 5 }] },
        'en',
      );

      expect(result.planetSign).toHaveLength(1);
      expect(result.planetHouse).toHaveLength(0);
    });

    it('returns a house reading for each of the 12 houses when cusps are present', async () => {
      for (let h = 1; h <= 12; h++) {
        await repo.upsert(
          { category: 'house', subjectKey: `house-${h}`, locale: 'en' },
          { content: `House ${h} meaning`, updatedBy: null },
        );
      }

      const result = await service.getForComputedChart(
        { positions: [{ body: 'sun', sign: 'Aries', longitude: 5 }], cusps },
        'en',
      );

      expect(result.houses.map((h) => h.subjectKey)).toEqual(
        Array.from({ length: 12 }, (_, i) => `house-${i + 1}`),
      );
    });

    it('returns no house readings when cusps are absent', async () => {
      const result = await service.getForComputedChart(
        { positions: [{ body: 'sun', sign: 'Aries', longitude: 5 }] },
        'en',
      );
      expect(result.houses).toEqual([]);
    });

    it('returns Ascendant- and Midheaven-in-sign readings when the angle signs are given', async () => {
      await repo.upsert(
        { category: 'angle', subjectKey: 'ascendant-Virgo', locale: 'en' },
        { content: 'Ascendant in Virgo text', updatedBy: null },
      );
      await repo.upsert(
        { category: 'angle', subjectKey: 'midheaven-Gemini', locale: 'en' },
        { content: 'Midheaven in Gemini text', updatedBy: null },
      );

      const result = await service.getForComputedChart(
        {
          positions: [{ body: 'sun', sign: 'Aries', longitude: 5 }],
          ascendantSign: 'Virgo',
          midheavenSign: 'Gemini',
        },
        'en',
      );

      expect(result.angles.map((a) => a.subjectKey)).toEqual([
        'ascendant-Virgo',
        'midheaven-Gemini',
      ]);
    });

    it('returns no angle readings when the angle signs are absent', async () => {
      const result = await service.getForComputedChart(
        { positions: [{ body: 'sun', sign: 'Aries', longitude: 5 }], cusps },
        'en',
      );
      expect(result.angles).toEqual([]);
    });

    it('ignores bodies outside the interpreted set (e.g. lunar nodes)', async () => {
      const result = await service.getForComputedChart(
        { positions: [{ body: 'northNode', sign: 'Aries', longitude: 5 }], cusps },
        'en',
      );

      expect(result.planetSign).toHaveLength(0);
      expect(result.planetHouse).toHaveLength(0);
    });
  });
});
