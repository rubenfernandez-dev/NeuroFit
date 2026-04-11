import { describe, expect, it } from 'vitest';
import { evaluatePatternMemoryWin } from './logic';

describe('patternmemory win evaluation', () => {
  it('solo considera victoria al completar max_round', () => {
    expect(evaluatePatternMemoryWin('max_round')).toBe(true);
    expect(evaluatePatternMemoryWin('failed')).toBe(false);
    expect(evaluatePatternMemoryWin('timeout')).toBe(false);
    expect(evaluatePatternMemoryWin('manual')).toBe(false);
  });
});
