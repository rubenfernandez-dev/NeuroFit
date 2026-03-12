import { describe, expect, it, vi } from 'vitest';

vi.mock('../storage/profile', () => ({
  ensureSeasonCurrent: vi.fn(),
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}));

import { calcSeasonPoints } from './seasonPoints';

describe('season points', () => {
  it('awards more SP for a daily session than an equivalent normal session', () => {
    const normalSp = calcSeasonPoints({
      gameId: 'memory',
      difficulty: 'principiante',
      score: 75,
      isDaily: false,
    });
    const dailySp = calcSeasonPoints({
      gameId: 'memory',
      difficulty: 'principiante',
      score: 75,
      isDaily: true,
    });

    expect(dailySp).toBeGreaterThan(normalSp);
  });

  it('clamps out-of-range scores before computing SP', () => {
    const unclamped = calcSeasonPoints({
      gameId: 'memory',
      difficulty: 'principiante',
      score: 999,
      isDaily: false,
    });
    const maxed = calcSeasonPoints({
      gameId: 'memory',
      difficulty: 'principiante',
      score: 100,
      isDaily: false,
    });

    expect(unclamped).toBe(maxed);
  });

  it('keeps dailyCompletedAndClaimable as a no-op for current behavior', () => {
    const base = calcSeasonPoints({
      gameId: 'memory',
      difficulty: 'avanzado',
      score: 80,
      isDaily: true,
    });
    const withLegacyFlag = calcSeasonPoints({
      gameId: 'memory',
      difficulty: 'avanzado',
      score: 80,
      isDaily: true,
      dailyCompletedAndClaimable: true,
    });

    expect(withLegacyFlag).toBe(base);
  });
});