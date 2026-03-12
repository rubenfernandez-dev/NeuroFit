import { computePerformanceFromScore } from '../../core/gamification/economy';
import { Difficulty } from '../types';
import { nowISO } from '../../shared/utils/time';
import { calcAccuracy, calculateFocusGridScore } from './logic';
import { FocusGridFinishReason, FocusGridGameResult } from './types';

type BuildFocusGridSessionResultInput = {
  reason: FocusGridFinishReason;
  difficulty: Difficulty;
  startedAtISO: string;
  elapsedMs: number;
  mistakes: number;
  correctTaps: number;
  totalTaps: number;
  totalCells: number;
  targetMinMs: number;
  targetMaxMs: number;
  earnedXp: number;
  earnedSp: number;
};

export type FocusGridSessionResult = {
  completed: boolean;
  solvedCount: number;
  accuracy: number;
  score: number;
  performance: number;
  completionTimeMs: number;
  gameResult: FocusGridGameResult;
};

export function getSessionSeed(isDaily: boolean, dailySeed?: number): number {
  if (isDaily && typeof dailySeed === 'number') {
    return Math.max(1, Math.floor(dailySeed));
  }
  return Math.max(1, Math.floor(Date.now() % 2_147_483_647));
}

export function buildFocusGridSessionResult(input: BuildFocusGridSessionResultInput): FocusGridSessionResult {
  const solvedCountRaw = Math.min(input.totalCells, Math.max(0, input.correctTaps));
  const completed = input.reason === 'completed' || solvedCountRaw >= input.totalCells;
  const solvedCount = completed ? input.totalCells : solvedCountRaw;
  const accuracy = calcAccuracy(input.correctTaps, input.totalTaps);
  const score = calculateFocusGridScore({
    solvedCount,
    totalCells: input.totalCells,
    accuracy,
    elapsedMs: input.elapsedMs,
    completed,
    targetMinMs: input.targetMinMs,
    targetMaxMs: input.targetMaxMs,
  });
  const performance = computePerformanceFromScore(score, input.difficulty);
  const completionTimeMs = completed ? input.elapsedMs : 0;

  return {
    completed,
    solvedCount,
    accuracy,
    score,
    performance,
    completionTimeMs,
    gameResult: {
      gameId: 'focusgrid',
      difficulty: input.difficulty,
      startedAt: input.startedAtISO,
      completedAt: nowISO(),
      metrics: {
        completionTimeMs,
        mistakes: input.mistakes,
        accuracy,
        score,
      },
      xpGained: input.earnedXp,
      spGained: input.earnedSp,
      performance,
    },
  };
}