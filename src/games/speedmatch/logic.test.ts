import { describe, expect, it } from 'vitest';
import { computeSpeedMatchRewardScore, evaluateSpeedMatchWin, getSpeedMatchConfig } from './logic';

describe('speedmatch difficulty and win rules', () => {
  it('gran maestro es mas exigente que maestro', () => {
    const master = getSpeedMatchConfig('maestro');
    const gm = getSpeedMatchConfig('gran_maestro');

    expect(gm.symbolCount).toBeGreaterThan(master.symbolCount);
    expect(gm.stimulusIntervalMs).toBeLessThan(master.stimulusIntervalMs);
    expect(gm.maxMistakes).toBeLessThan(master.maxMistakes);
  });

  it('pierde si supera maximo de errores', () => {
    const gm = getSpeedMatchConfig('gran_maestro');
    const won = evaluateSpeedMatchWin({ correct: 20, mistakes: gm.maxMistakes, difficulty: 'gran_maestro' });
    expect(won).toBe(false);
  });

  it('reward score refleja rendimiento real', () => {
    const low = computeSpeedMatchRewardScore({ correct: 8, mistakes: 8, elapsedSec: 50, difficulty: 'avanzado' });
    const high = computeSpeedMatchRewardScore({ correct: 18, mistakes: 3, elapsedSec: 50, difficulty: 'avanzado' });

    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(100);
  });
});
