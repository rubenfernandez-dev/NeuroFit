import { Difficulty } from '../types';

export type NumberMatchCellValue = number | null;

export type NumberMatchMetrics = {
  score: number;
  validMatches: number;
  invalidMatches: number;
  bestCombo: number;
  boardClearedPercent: number;
};

export type NumberMatchGameResult = {
  gameId: 'numbermatch';
  difficulty: Difficulty;
  startedAt: string;
  completedAt: string;
  metrics: NumberMatchMetrics;
  xpGained: number;
  spGained: number;
  performance: number;
};

export type NumberMatchFinishReason = 'timeout' | 'manual' | 'board_full';
