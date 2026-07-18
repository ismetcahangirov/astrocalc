import { describe, expect, it } from 'vitest';
import { CalcEngineError } from '@astrocalc/calc-engine';

describe('@astrocalc/calc-engine (workspace import)', () => {
  it('resolves as a workspace package and exposes its public API', () => {
    const error = new CalcEngineError('invalid_input', 'test');

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('invalid_input');
  });
});
