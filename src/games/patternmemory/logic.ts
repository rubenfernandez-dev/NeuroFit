import { Difficulty } from '../types';
import { createSeededRng, randomInt, RNG } from '../../shared/utils/random';
import { TileId } from './types';

export type PatternMemoryDifficultyConfig = {
  tileOnMs: number;
  tilePauseMs: number;
  maxRound: number;
  totalSeconds: number;
  reactionBestMs: number;
  reactionWorstMs: number;
};

const CONFIG_BY_DIFFICULTY: Record<Difficulty, PatternMemoryDifficultyConfig> = {
  principiante: {
    tileOnMs: 560,
    tilePauseMs: 220,
    maxRound: 6,
    totalSeconds: 45,
    reactionBestMs: 260,
    reactionWorstMs: 1400,
  },
  avanzado: {
    tileOnMs: 500,
    tilePauseMs: 200,
    maxRound: 8,
    totalSeconds: 50,
    reactionBestMs: 240,
    reactionWorstMs: 1300,
  },
  experto: {
    tileOnMs: 430,
    tilePauseMs: 170,
    maxRound: 10,
    totalSeconds: 55,
    reactionBestMs: 220,
    reactionWorstMs: 1200,
  },
  maestro: {
    tileOnMs: 360,
    tilePauseMs: 150,
    maxRound: 12,
    totalSeconds: 60,
    reactionBestMs: 210,
    reactionWorstMs: 1150,
  },
  gran_maestro: {
    tileOnMs: 310,
    tilePauseMs: 130,
    maxRound: 14,
    totalSeconds: 60,
    reactionBestMs: 190,
    reactionWorstMs: 1100,
  },
};

export function getPatternMemoryConfig(difficulty: Difficulty): PatternMemoryDifficultyConfig {
  return CONFIG_BY_DIFFICULTY[difficulty];
}

export function createRoundRng(seed: number): RNG {
  return createSeededRng(seed);
}

export function createInitialSequence(rng: RNG): TileId[] {
  return [randomInt(0, 3, rng) as TileId];
}

export function appendSequenceStep(sequence: TileId[], rng: RNG): TileId[] {
  return [...sequence, randomInt(0, 3, rng) as TileId];
}

export function isCorrectTap(sequence: TileId[], inputIndex: number, tappedTile: TileId): boolean {
  return sequence[inputIndex] === tappedTile;
}

export function calcAccuracy(correctTaps: number, totalTaps: number): number {
  if (totalTaps <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((correctTaps / totalTaps) * 100)));
}

export function calcReactionTimeAvg(accumulatedMs: number, samples: number): number {
  if (samples <= 0) return 0;
  return Math.max(0, Math.round(accumulatedMs / samples));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculatePatternMemoryScore(input: {
  maxSequence: number;
  maxRound: number;
  accuracy: number;
  reactionTimeAvg: number;
  reactionBestMs: number;
  reactionWorstMs: number;
}): number {
  const safeRounds = Math.max(1, input.maxRound);
  const sequenceScore = clamp((input.maxSequence / safeRounds) * 100, 0, 100);
  const accuracyScore = clamp(input.accuracy, 0, 100);

  const reactionRatio =
    input.reactionTimeAvg <= 0
      ? 0.5
      : clamp(
          1 -
            (input.reactionTimeAvg - input.reactionBestMs) /
              Math.max(1, input.reactionWorstMs - input.reactionBestMs),
          0,
          1,
        );
  const reactionScore = Math.round(reactionRatio * 100);

  const weighted = sequenceScore * 0.6 + accuracyScore * 0.25 + reactionScore * 0.15;
  return clamp(Math.round(weighted), 0, 100);
}
