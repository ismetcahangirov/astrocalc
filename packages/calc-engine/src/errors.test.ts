import { describe, expect, it } from 'vitest';
import { CalcEngineError } from './errors';

describe('CalcEngineError', () => {
  it('carries a stable code and a human-readable message', () => {
    const error = new CalcEngineError('invalid_input', 'birth date is required');

    expect(error.code).toBe('invalid_input');
    expect(error.message).toBe('birth date is required');
  });

  it('is a real Error subclass, distinguishable via instanceof', () => {
    const error = new CalcEngineError('invalid_input', 'birth date is required');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CalcEngineError);
    expect(error.name).toBe('CalcEngineError');
  });
});
