import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../core/gamification/neuroscore', () => ({
  updateNeuroAfterGame: vi.fn(async () => ({})),
}));

vi.mock('../storage/daily', () => ({
  completeDailyStage: vi.fn(),
  claimDailyReward: vi.fn(),
  getDailyProgress: vi.fn((daily: { stages: Array<{ completed: boolean }> }) => ({
    completedStages: daily.stages.filter((stage) => stage.completed).length,
    totalStages: daily.stages.length,
  })),
}));

vi.mock('./xp', () => ({
  grantXp: vi.fn(async () => ({ earnedXp: 17 })),
}));

vi.mock('./seasonPoints', () => ({
  grantSeasonPoints: vi.fn(async () => ({ earnedSeasonPoints: 9 })),
}));

import { completeGameSession } from './sessionCompletion';
import { updateNeuroAfterGame } from '../../core/gamification/neuroscore';
import { claimDailyReward, completeDailyStage } from '../storage/daily';
import { grantSeasonPoints } from './seasonPoints';
import { grantXp } from './xp';

describe('sessionCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normal mode grants xp/sp and omits daily completion payload', async () => {
    const result = await completeGameSession({
      gameId: 'sudoku',
      difficulty: 'avanzado',
      mode: 'normal',
      won: true,
      metrics: { score: 80, mistakes: 1, durationMs: 20_000 },
    });

    expect(updateNeuroAfterGame).toHaveBeenCalledTimes(1);
    expect(grantXp).toHaveBeenCalledTimes(1);
    expect(grantSeasonPoints).toHaveBeenCalledTimes(1);
    expect(result.dailyCompletion).toBeUndefined();
    expect(result.earnedXp).toBe(17);
    expect(result.earnedSp).toBe(9);
  });

  it('daily mode deduplicates in-flight completion for same key', async () => {
    const pending = Promise.resolve({
      daily: {
        currentStageIndex: 1,
        stages: [{ completed: true }, { completed: false }, { completed: false }],
      },
      stageCompletedNow: true,
      circuitCompletedNow: false,
      alreadyCompleted: false,
    });

    vi.mocked(completeDailyStage).mockReturnValue(pending as never);

    const payload = {
      gameId: 'memory' as const,
      difficulty: 'avanzado' as const,
      mode: 'daily' as const,
      won: true,
      stageIndex: 0,
      metrics: { score: 75, mistakes: 0, durationMs: 10_000 },
    };

    const [a, b] = await Promise.all([completeGameSession(payload), completeGameSession(payload)]);

    expect(completeDailyStage).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a.dailyCompletion?.kind).toBe('stage');
  });

  it('daily final completion awards rewards only when reward is claimable', async () => {
    vi.mocked(completeDailyStage).mockResolvedValue({
      daily: {
        currentStageIndex: 3,
        stages: [{ completed: true }, { completed: true }, { completed: true }],
      },
      stageCompletedNow: true,
      circuitCompletedNow: true,
      alreadyCompleted: false,
    } as never);
    vi.mocked(claimDailyReward).mockResolvedValue({
      alreadyClaimed: false,
      daily: {
        currentStageIndex: 3,
        stages: [{ completed: true }, { completed: true }, { completed: true }],
      },
    } as never);

    const result = await completeGameSession({
      gameId: 'mentalmath',
      difficulty: 'experto',
      mode: 'daily',
      won: true,
      stageIndex: 2,
      metrics: { score: 92, mistakes: 2, durationMs: 60_000 },
    });

    expect(claimDailyReward).toHaveBeenCalledTimes(1);
    expect(grantXp).toHaveBeenCalledTimes(1);
    expect(grantSeasonPoints).toHaveBeenCalledTimes(1);
    expect(result.dailyCompletion?.kind).toBe('final');
    expect(result.earnedXp).toBe(17);
    expect(result.earnedSp).toBe(9);
  });
});
