import { describe, expect, it } from 'vitest';
import { applyMemoryAttempt, computeMemoryRewardScore, createMemoryRoundScoreState } from './scoring';

describe('memory scoring', () => {
  it('recompensa aciertos y racha, penaliza errores sin frustrar', () => {
    let state = createMemoryRoundScoreState();

    state = applyMemoryAttempt(state, true);
    state = applyMemoryAttempt(state, true);
    const afterStreak = state.score;

    state = applyMemoryAttempt(state, false);

    expect(afterStreak).toBeGreaterThan(20);
    expect(state.score).toBeGreaterThanOrEqual(0);
    expect(state.streak).toBe(0);
    expect(state.mismatches).toBe(1);
  });

  it('score de recompensa sube con mejor eficiencia', () => {
    const low = computeMemoryRewardScore({
      totalPairs: 12,
      attempts: 28,
      matches: 12,
      bestStreak: 2,
      rawScore: 70,
    });

    const high = computeMemoryRewardScore({
      totalPairs: 12,
      attempts: 15,
      matches: 12,
      bestStreak: 6,
      rawScore: 180,
    });

    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(100);
  });
});
