import { Difficulty } from '../types';
import { createSeededRng, shuffle } from '../../shared/utils/random';

export type FocusGridDifficultyConfig = {
  gridSize: number;
  totalSeconds: number;
  targetMinMs: number;
  targetMaxMs: number;
};

const CONFIG_BY_DIFFICULTY: Record<Difficulty, FocusGridDifficultyConfig> = {
  principiante: {
    gridSize: 3,
    totalSeconds: 45,
    targetMinMs: 30_000,
    targetMaxMs: 45_000,
  },
  avanzado: {
    gridSize: 4,
    totalSeconds: 42,
    targetMinMs: 29_000,
    targetMaxMs: 42_000,
  },
  experto: {
    gridSize: 5,
    totalSeconds: 38,
    targetMinMs: 28_000,
    targetMaxMs: 38_000,
  },
  maestro: {
    gridSize: 6,
    totalSeconds: 34,
    targetMinMs: 27_000,
    targetMaxMs: 34_000,
  },
  gran_maestro: {
    gridSize: 7,
    totalSeconds: 30,
    targetMinMs: 24_000,
    targetMaxMs: 30_000,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getFocusGridConfig(difficulty: Difficulty): FocusGridDifficultyConfig {
  return CONFIG_BY_DIFFICULTY[difficulty];
}

export function buildShuffledGridNumbers(totalCells: number, seed: number): number[] {
  const numbers = Array.from({ length: totalCells }).map((_, index) => index + 1);
  return shuffle(numbers, createSeededRng(Math.max(1, Math.floor(seed))));
}

export function calcAccuracy(correctTaps: number, totalTaps: number): number {
  if (totalTaps <= 0) return 0;
  return clamp(Math.round((correctTaps / totalTaps) * 100), 0, 100);
}

export function calculateFocusGridScore(input: {
  solvedCount: number;
  totalCells: number;
  accuracy: number;
  elapsedMs: number;
  completed: boolean;
  targetMinMs: number;
  targetMaxMs: number;
}): number {
  const completionScore = clamp((input.solvedCount / Math.max(1, input.totalCells)) * 100, 0, 100);
  const accuracyScore = clamp(input.accuracy, 0, 100);

  let speedScore = 0;
  if (input.completed) {
    const ratio =
      1 -
      (input.elapsedMs - input.targetMinMs) /
        Math.max(1, input.targetMaxMs - input.targetMinMs);
    speedScore = clamp(Math.round(ratio * 100), 0, 100);
  }

  const weighted = completionScore * 0.45 + accuracyScore * 0.25 + speedScore * 0.3;
  return clamp(Math.round(weighted), 0, 100);
}
