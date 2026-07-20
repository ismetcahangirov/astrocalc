import { describe, expect, it } from 'vitest';
import { hashMatrixCacheKey, type MatrixCacheKeyInput } from './matrixCacheKey';

function baseInput(overrides: Partial<MatrixCacheKeyInput> = {}): MatrixCacheKeyInput {
  return { birthDate: '1990-05-12', ...overrides };
}

describe('hashMatrixCacheKey', () => {
  it('is deterministic for identical input', () => {
    expect(hashMatrixCacheKey(baseInput())).toBe(hashMatrixCacheKey(baseInput()));
  });

  it('changes when birthDate changes', () => {
    const a = hashMatrixCacheKey(baseInput({ birthDate: '1990-05-12' }));
    const b = hashMatrixCacheKey(baseInput({ birthDate: '1990-05-13' }));
    expect(a).not.toBe(b);
  });

  it('produces a hex-encoded sha256 digest', () => {
    expect(hashMatrixCacheKey(baseInput())).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never puts the birth date itself in the key', () => {
    // The digest is what keeps a plaintext birth date out of Redis key space —
    // and therefore out of MONITOR output and hosted-Redis dashboards. A future
    // "simplification" to `birthDate` as the literal key would break this.
    expect(hashMatrixCacheKey(baseInput({ birthDate: '1990-05-12' }))).not.toContain('1990');
  });

  it('does not vary with anything but the birth date', () => {
    // The Matrix depends on the birth date alone. This pins that down against
    // the most likely future mistake: quietly threading a reference date or a
    // name into the key (as numerology legitimately needs) and fragmenting the
    // cache for inputs that cannot change the result.
    const withExtras = { birthDate: '1990-05-12', fullName: 'Ada Lovelace' };
    expect(hashMatrixCacheKey(withExtras as MatrixCacheKeyInput)).toBe(
      hashMatrixCacheKey(baseInput()),
    );
  });
});
