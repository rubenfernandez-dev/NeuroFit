import { Difficulty, GameId } from '../types';

export type FocusGridMetrics = {
  completionTimeMs: number;
  mistakes: number;
  accuracy: number;
  score: number;
};

export type FocusGridGameResult = {
  gameId: GameId;
  difficulty: Difficulty;
  startedAt: string;
  completedAt: string;
  metrics: FocusGridMetrics;
  xpGained: number;
  spGained: number;
  performance: number;
};

export type FocusGridFinishReason = 'completed' | 'timeout' | 'manual';
