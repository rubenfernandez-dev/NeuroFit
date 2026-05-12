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
  minRoundsToWin: number;
};

export const SPEEDMATCH_CONFIG: Record<Difficulty, SpeedMatchDifficultyConfig> = {
  principiante: { durationSec: 60, symbolCount: 2, matchProbability: 0.5, stimulusIntervalMs: 420, maxMistakes: 3, minRoundsToWin: 15 },
  avanzado: { durationSec: 60, symbolCount: 3, matchProbability: 0.42, stimulusIntervalMs: 420, maxMistakes: 3, minRoundsToWin: 15 },
  experto: { durationSec: 56, symbolCount: 4, matchProbability: 0.34, stimulusIntervalMs: 420, maxMistakes: 3, minRoundsToWin: 15 },
  maestro: { durationSec: 52, symbolCount: 5, matchProbability: 0.27, stimulusIntervalMs: 420, maxMistakes: 3, minRoundsToWin: 22 },
  gran_maestro: { durationSec: 48, symbolCount: 6, matchProbability: 0.2, stimulusIntervalMs: 420, maxMistakes: 3, minRoundsToWin: 35 },
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
  const roundsPlayed = input.correct + input.mistakes;
  const completionScore = clamp((roundsPlayed / config.minRoundsToWin) * 100, 0, 100);
  const totalAnswers = roundsPlayed;
  const accuracy = totalAnswers > 0 ? (input.correct / totalAnswers) * 100 : 0;
  const pace = input.correct / Math.max(1, input.elapsedSec / 60);
  const paceTarget = config.minRoundsToWin * 0.8;
  const paceScore = clamp((pace / paceTarget) * 100, 0, 100);
  const consistency = clamp(((config.maxMistakes - input.mistakes) / Math.max(1, config.maxMistakes)) * 100, 0, 100);

  const weighted = accuracy * 0.5 + completionScore * 0.25 + paceScore * 0.15 + consistency * 0.1;
  return clamp(Math.round(weighted), 0, 100);
}

export function evaluateSpeedMatchWin(input: {
  roundsPlayed: number;
  mistakes: number;
  difficulty: Difficulty;
}): boolean {
  const config = getSpeedMatchConfig(input.difficulty);
  if (input.mistakes > config.maxMistakes) return false;
  return input.roundsPlayed >= config.minRoundsToWin;
}

export function describeSpeedMatchDifficulty(difficulty: Difficulty): string {
  const config = getSpeedMatchConfig(difficulty);
  return `simbolos=${config.symbolCount}, match=${Math.round(config.matchProbability * 100)}%, intervalo=${config.stimulusIntervalMs}ms, maxErrores=${config.maxMistakes}`;
}
