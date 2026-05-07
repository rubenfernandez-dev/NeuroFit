import { Difficulty } from '../../games/types';

type EconomyInput = {
  score: number;
  difficulty: Difficulty;
  isDaily: boolean;
};

export const difficultyMultipliers: Record<Difficulty, number> = {
  principiante: 0.5,
  avanzado: 0.65,
  experto: 0.7,
  maestro: 0.85,
  gran_maestro: 1,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computePerformanceFromScore(score: number, _difficulty: Difficulty): number {
  const performance = clamp(score / 100, 0, 1);
  return performance;
}

export function computeXp({ score, difficulty, isDaily }: EconomyInput): number {
  const multiplier = difficultyMultipliers[difficulty];
  const performance = computePerformanceFromScore(score, difficulty);
  const xpBase = 20;
  const xpPerformance = Math.round(20 * performance);
  const xpDaily = isDaily ? 5 : 0;
  return Math.round((xpBase + xpPerformance + xpDaily) * multiplier);
}

export function computeSp({ score, difficulty, isDaily }: EconomyInput): number {
  const multiplier = difficultyMultipliers[difficulty];
  const performance = computePerformanceFromScore(score, difficulty);
  const spBase = 10;
  const spPerformance = Math.round(20 * performance);
  const spDaily = isDaily ? 5 : 0;
  return Math.round((spBase + spPerformance + spDaily) * multiplier);
}
