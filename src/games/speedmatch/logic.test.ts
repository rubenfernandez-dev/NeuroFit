import { describe, expect, it } from 'vitest';
import { computeSpeedMatchRewardScore, evaluateSpeedMatchWin, getSpeedMatchConfig } from './logic';

describe('speedmatch difficulty and win rules', () => {
  it('gran maestro es mas exigente que maestro', () => {
    const master = getSpeedMatchConfig('maestro');
    const gm = getSpeedMatchConfig('gran_maestro');

    expect(gm.symbolCount).toBeGreaterThan(master.symbolCount);
    expect(gm.maxMistakes).toBe(3);
    expect(master.maxMistakes).toBe(3);
    expect(gm.minRoundsToWin).toBeGreaterThan(master.minRoundsToWin);
  });

  it('pierde si supera maximo de errores', () => {
    const won = evaluateSpeedMatchWin({ roundsPlayed: 40, mistakes: 4, difficulty: 'gran_maestro' });
    expect(won).toBe(false);
  });

  it('solo gana al alcanzar rondas minimas sin superar 3 fallos', () => {
    const wonByRounds = evaluateSpeedMatchWin({ roundsPlayed: 15, mistakes: 3, difficulty: 'avanzado' });
    const lostByRounds = evaluateSpeedMatchWin({ roundsPlayed: 14, mistakes: 0, difficulty: 'avanzado' });

    expect(wonByRounds).toBe(true);
    expect(lostByRounds).toBe(false);
  });

  it('reward score refleja rendimiento real', () => {
    const low = computeSpeedMatchRewardScore({ correct: 8, mistakes: 8, elapsedSec: 50, difficulty: 'avanzado' });
    const high = computeSpeedMatchRewardScore({ correct: 18, mistakes: 3, elapsedSec: 50, difficulty: 'avanzado' });

    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(100);
  });
});
