import { Difficulty, GameId } from '../types';

export type TileId = 0 | 1 | 2 | 3;

export type PatternMemoryMetrics = {
  score: number;
  accuracy: number;
  reactionTimeAvg: number;
  maxSequence: number;
  totalTaps: number;
  correctTaps: number;
};

export type PatternMemoryGameResult = {
  gameId: GameId;
  difficulty: Difficulty;
  startedAt: string;
  completedAt: string;
  metrics: PatternMemoryMetrics;
  xpGained: number;
  spGained: number;
  performance: number;
};

export type PatternMemoryFinishReason = 'failed' | 'timeout' | 'max_round' | 'manual';
