import { describe, expect, it } from 'vitest';
import { computePerformanceFromScore, computeSp, computeXp } from './economy';

describe('economy', () => {
  it('clamps performance normalization to the expected range', () => {
    expect(computePerformanceFromScore(-50, 'principiante')).toBe(0);
    expect(computePerformanceFromScore(250, 'principiante')).toBe(1);
  });

  it('applies the fixed daily bonus to both XP and SP', () => {
    const normalXp = computeXp({ score: 75, difficulty: 'principiante', isDaily: false });
    const dailyXp = computeXp({ score: 75, difficulty: 'principiante', isDaily: true });
    const normalSp = computeSp({ score: 75, difficulty: 'principiante', isDaily: false });
    const dailySp = computeSp({ score: 75, difficulty: 'principiante', isDaily: true });

    expect(dailyXp).toBeGreaterThan(normalXp);
    expect(dailySp).toBeGreaterThan(normalSp);
  });

  it('scales both XP and SP with difficulty', () => {
    const beginnerXp = computeXp({ score: 100, difficulty: 'principiante', isDaily: false });
    const expertXp = computeXp({ score: 100, difficulty: 'experto', isDaily: false });
    const beginnerSp = computeSp({ score: 100, difficulty: 'principiante', isDaily: false });
    const expertSp = computeSp({ score: 100, difficulty: 'experto', isDaily: false });

    expect(expertXp).toBeGreaterThan(beginnerXp);
    expect(expertSp).toBeGreaterThan(beginnerSp);
  });
});