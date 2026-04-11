import { Difficulty } from '../types';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export type SpeedMatchDifficultyConfig = {
  durationSec: number;
  symbolCount: number;
  matchProbability: number;
  stimulusIntervalMs: number;
  maxMistakes: number;
  minAccuracyPctToWin: number;
  minCorrectToWin: number;
};

export const SPEEDMATCH_CONFIG: Record<Difficulty, SpeedMatchDifficultyConfig> = {
  principiante: { durationSec: 60, symbolCount: 3, matchProbability: 0.5, stimulusIntervalMs: 900, maxMistakes: 12, minAccuracyPctToWin: 50, minCorrectToWin: 8 },
  avanzado: { durationSec: 60, symbolCount: 4, matchProbability: 0.42, stimulusIntervalMs: 780, maxMistakes: 11, minAccuracyPctToWin: 55, minCorrectToWin: 10 },
  experto: { durationSec: 56, symbolCount: 5, matchProbability: 0.34, stimulusIntervalMs: 670, maxMistakes: 10, minAccuracyPctToWin: 58, minCorrectToWin: 12 },
  maestro: { durationSec: 52, symbolCount: 6, matchProbability: 0.27, stimulusIntervalMs: 560, maxMistakes: 9, minAccuracyPctToWin: 62, minCorrectToWin: 14 },
  gran_maestro: { durationSec: 48, symbolCount: 7, matchProbability: 0.2, stimulusIntervalMs: 470, maxMistakes: 8, minAccuracyPctToWin: 65, minCorrectToWin: 16 },
};

export function getSpeedMatchConfig(difficulty: Difficulty): SpeedMatchDifficultyConfig {
  return SPEEDMATCH_CONFIG[difficulty];
}

export function computeSpeedMatchRewardScore(input: {
  correct: number;
  mistakes: number;
  elapsedSec: number;
  difficulty: Difficulty;
}): number {
  const config = getSpeedMatchConfig(input.difficulty);
  const totalAnswers = input.correct + input.mistakes;
  const accuracy = totalAnswers > 0 ? (input.correct / totalAnswers) * 100 : 0;
  const completionScore = clamp((input.correct / config.minCorrectToWin) * 100, 0, 100);
  const pace = input.correct / Math.max(1, input.elapsedSec / 60);
  const paceTarget = config.minCorrectToWin * 1.12;
  const paceScore = clamp((pace / paceTarget) * 100, 0, 100);
  const consistency = clamp(((config.maxMistakes - input.mistakes) / Math.max(1, config.maxMistakes)) * 100, 0, 100);

  const weighted = accuracy * 0.5 + completionScore * 0.25 + paceScore * 0.15 + consistency * 0.1;
  return clamp(Math.round(weighted), 0, 100);
}

export function evaluateSpeedMatchWin(input: {
  correct: number;
  mistakes: number;
  difficulty: Difficulty;
}): boolean {
  const config = getSpeedMatchConfig(input.difficulty);
  if (input.mistakes >= config.maxMistakes) return false;

  const totalAnswers = input.correct + input.mistakes;
  const accuracy = totalAnswers > 0 ? (input.correct / totalAnswers) * 100 : 0;
  return input.correct >= config.minCorrectToWin && accuracy >= config.minAccuracyPctToWin;
}

export function describeSpeedMatchDifficulty(difficulty: Difficulty): string {
  const config = getSpeedMatchConfig(difficulty);
  return `simbolos=${config.symbolCount}, match=${Math.round(config.matchProbability * 100)}%, intervalo=${config.stimulusIntervalMs}ms, maxErrores=${config.maxMistakes}`;
}
