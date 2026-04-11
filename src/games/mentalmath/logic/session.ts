import { Difficulty } from '../../types';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export type MentalMathSessionConfig = {
  initialTimeSec: number;
  maxTimeSec: number;
  bonusOnCorrectSec: number;
  maxErrors: number;
  minCorrectToWin: number;
  minAccuracyPctToWin: number;
};

const CONFIG_BY_DIFFICULTY: Record<Difficulty, MentalMathSessionConfig> = {
  principiante: { initialTimeSec: 60, maxTimeSec: 110, bonusOnCorrectSec: 3, maxErrors: 8, minCorrectToWin: 7, minAccuracyPctToWin: 50 },
  avanzado: { initialTimeSec: 60, maxTimeSec: 110, bonusOnCorrectSec: 3, maxErrors: 7, minCorrectToWin: 8, minAccuracyPctToWin: 55 },
  experto: { initialTimeSec: 62, maxTimeSec: 112, bonusOnCorrectSec: 3, maxErrors: 6, minCorrectToWin: 9, minAccuracyPctToWin: 58 },
  maestro: { initialTimeSec: 68, maxTimeSec: 118, bonusOnCorrectSec: 4, maxErrors: 5, minCorrectToWin: 10, minAccuracyPctToWin: 62 },
  gran_maestro: { initialTimeSec: 72, maxTimeSec: 124, bonusOnCorrectSec: 4, maxErrors: 5, minCorrectToWin: 11, minAccuracyPctToWin: 65 },
};

export function getMentalMathSessionConfig(difficulty: Difficulty): MentalMathSessionConfig {
  return CONFIG_BY_DIFFICULTY[difficulty];
}

export function computeMentalMathRewardScore(input: {
  correct: number;
  wrong: number;
  elapsedSec: number;
  difficulty: Difficulty;
}): number {
  const config = getMentalMathSessionConfig(input.difficulty);
  const attempts = input.correct + input.wrong;
  const accuracy = attempts > 0 ? (input.correct / attempts) * 100 : 0;
  const pace = input.correct / Math.max(1, input.elapsedSec / 60);
  const paceTarget = config.minCorrectToWin * 1.05;
  const paceScore = clamp((pace / paceTarget) * 100, 0, 100);
  const completionScore = clamp((input.correct / config.minCorrectToWin) * 100, 0, 100);
  const mistakeBudgetScore = clamp(((config.maxErrors - input.wrong) / Math.max(1, config.maxErrors)) * 100, 0, 100);

  const weighted = accuracy * 0.4 + completionScore * 0.3 + paceScore * 0.2 + mistakeBudgetScore * 0.1;
  return clamp(Math.round(weighted), 0, 100);
}

export function evaluateMentalMathWin(input: {
  correct: number;
  wrong: number;
  difficulty: Difficulty;
}): boolean {
  const config = getMentalMathSessionConfig(input.difficulty);
  if (input.wrong >= config.maxErrors) return false;

  const attempts = input.correct + input.wrong;
  const accuracy = attempts > 0 ? (input.correct / attempts) * 100 : 0;
  return input.correct >= config.minCorrectToWin && accuracy >= config.minAccuracyPctToWin;
}
