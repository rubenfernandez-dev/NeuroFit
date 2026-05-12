import { describe, expect, it } from 'vitest';
import { computeMentalMathRewardScore, evaluateMentalMathWin, getMentalMathSessionConfig } from './session';

describe('mentalmath session rules', () => {
  it('falla solo al superar el limite de errores', () => {
    const config = getMentalMathSessionConfig('maestro');
    const atLimit = evaluateMentalMathWin({ correct: 20, wrong: config.maxErrors, difficulty: 'maestro' });
    const aboveLimit = evaluateMentalMathWin({ correct: 20, wrong: config.maxErrors + 1, difficulty: 'maestro' });
    expect(atLimit).toBe(true);
    expect(aboveLimit).toBe(false);
  });

  it('exige aciertos y precision minima para victoria', () => {
    expect(evaluateMentalMathWin({ correct: 11, wrong: 4, difficulty: 'gran_maestro' })).toBe(true);
    expect(evaluateMentalMathWin({ correct: 7, wrong: 1, difficulty: 'gran_maestro' })).toBe(false);
  });

  it('reward score sube con mejor rendimiento', () => {
    const low = computeMentalMathRewardScore({ correct: 6, wrong: 6, elapsedSec: 90, difficulty: 'experto' });
    const high = computeMentalMathRewardScore({ correct: 14, wrong: 2, elapsedSec: 75, difficulty: 'experto' });

    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(100);
  });
});
