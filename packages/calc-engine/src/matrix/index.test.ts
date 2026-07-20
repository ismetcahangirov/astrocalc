import { describe, expect, it } from 'vitest';
import { CalcEngineError } from '../errors';
import { computeDestinyMatrix, MATRIX_SCHEMA_VERSION } from './index';
import { isArcana } from './reduce';

/** Walk every arcana value in an assembled Matrix, whatever its nesting. */
function everyArcana(value: unknown, path = 'matrix'): [string, number][] {
  if (typeof value === 'number') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => everyArcana(v, `${path}[${i}]`));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => everyArcana(v, `${path}.${k}`));
  }
  return [];
}

describe('computeDestinyMatrix', () => {
  it('stamps the schema version and echoes the birth date', () => {
    const matrix = computeDestinyMatrix({ birthDate: '1990-05-12' });
    expect(matrix.schemaVersion).toBe(MATRIX_SCHEMA_VERSION);
    expect(matrix.birthDate).toBe('1990-05-12');
  });

  it('assembles every block', () => {
    const matrix = computeDestinyMatrix({ birthDate: '1990-05-12' });
    expect(matrix.core).toBeDefined();
    expect(matrix.ancestral).toBeDefined();
    expect(matrix.purposes).toBeDefined();
    expect(matrix.moneyAndRelationships).toBeDefined();
    expect(matrix.health).toHaveLength(7);
  });

  it('is deterministic — the same date always gives the same Matrix', () => {
    expect(computeDestinyMatrix({ birthDate: '1987-01-29' })).toEqual(
      computeDestinyMatrix({ birthDate: '1987-01-29' }),
    );
  });

  it('is JSON-serializable with no loss', () => {
    // The result crosses the wire and goes into Redis, so a round trip has to be
    // the identity — no `undefined`, no non-plain values.
    const matrix = computeDestinyMatrix({ birthDate: '1990-11-22' });
    expect(JSON.parse(JSON.stringify(matrix))).toEqual(matrix);
  });

  it('contains only valid arcana, everywhere, across an exhaustive sweep', () => {
    // The whole-result version of the per-module sweeps: nothing that reaches a
    // caller can be outside 1-22, whatever block it came from. `schemaVersion`
    // is the one number in the result that is not an arcana.
    for (let year = 1900; year <= 2030; year++) {
      for (const [month, day] of [
        [1, 31],
        [5, 22],
        [8, 30],
        [12, 9],
      ] as const) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const { schemaVersion: _ignored, ...rest } = computeDestinyMatrix({ birthDate: iso });
        for (const [path, value] of everyArcana(rest)) {
          expect(isArcana(value), `${iso} ${path} = ${value}`).toBe(true);
        }
      }
    }
  });

  it.each(['1990-02-30', '1990-13-01', '', 'yesterday'])('rejects the invalid date %s', (bad) => {
    expect(() => computeDestinyMatrix({ birthDate: bad })).toThrow(CalcEngineError);
  });

  it('reports a bad date with the invalid_input code', () => {
    try {
      computeDestinyMatrix({ birthDate: '1990-02-30' });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CalcEngineError);
      expect((err as CalcEngineError).code).toBe('invalid_input');
    }
  });
});
