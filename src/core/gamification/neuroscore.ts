import { Difficulty, GameId } from '../../games/types';
import { NeuroMetrics, Profile, getProfile, updateProfile } from '../../shared/storage/profile';
import { nowISO } from '../../shared/utils/time';

export type NeuroDims = 'speed' | 'memory' | 'logic' | 'attention';

type NeuroScoreInput = {
  gameId: GameId;
  difficulty?: Difficulty;
  won?: boolean;
  score?: number;
  durationMs?: number;
  mistakes?: number;
  mode: 'normal' | 'daily';
};

type NeuroDelta = {
  speedDelta: number;
  memoryDelta: number;
  logicDelta: number;
  attentionDelta: number;
};

type NeuroWeights = Record<NeuroDims, number>;

const WEIGHTS_BY_GAME: Record<GameId, NeuroWeights> = {
  sudoku: { speed: 0, memory: 0, logic: 0.7, attention: 0.3 },
  memory: { speed: 0, memory: 0.7, logic: 0, attention: 0.3 },
  mentalmath: { speed: 0.5, memory: 0, logic: 0.3, attention: 0.2 },
  speedmatch: { speed: 0.6, memory: 0, logic: 0, attention: 0.4 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mapTimeFactor(durationMs?: number, fastMs = 45_000, slowMs = 240_000): number {
  if (typeof durationMs !== 'number' || durationMs <= 0) return 0.5;
  if (durationMs <= fastMs) return 1;
  if (durationMs >= slowMs) return 0;
  return 1 - (durationMs - fastMs) / Math.max(1, slowMs - fastMs);
}

function computePerformanceNormalized(input: NeuroScoreInput): number {
  const mistakes = Math.max(0, input.mistakes ?? 0);

  if (input.gameId === 'sudoku') {
    const base = input.won ? 1 : 0.2;
    const penalty = clamp(mistakes / 5, 0, 1) * 0.6;
    const timeFactor = mapTimeFactor(input.durationMs, 90_000, 900_000);
    return clamp(base + 0.4 * timeFactor - penalty, 0, 1);
  }

  if (input.gameId === 'memory') {
    const timeFactor = mapTimeFactor(input.durationMs, 25_000, 180_000);
    const penaltyByMistakes = clamp(mistakes / 18, 0, 1) * 0.4;
    return clamp(0.6 + 0.4 * timeFactor - penaltyByMistakes, 0, 1);
  }

  if (input.gameId === 'speedmatch') {
    const correct = Math.max(0, input.score ?? 0);
    const total = Math.max(1, correct + mistakes);
    const correctRate = clamp(correct / total, 0, 1);
    const timeFactor = mapTimeFactor(input.durationMs, 25_000, 120_000);
    return clamp(correctRate * 0.75 + timeFactor * 0.25, 0, 1);
  }

  const correct = Math.max(0, input.score ?? 0);
  const total = Math.max(1, correct + mistakes);
  const correctRate = clamp(correct / total, 0, 1);
  const timeFactor = mapTimeFactor(input.durationMs, 30_000, 80_000);
  return clamp(correctRate * 0.7 + timeFactor * 0.3, 0, 1);
}

export function computeNeuroDelta(input: NeuroScoreInput): NeuroDelta {
  const weights = WEIGHTS_BY_GAME[input.gameId] ?? WEIGHTS_BY_GAME.mentalmath;
  const performance = computePerformanceNormalized(input);
  const modeMultiplier = input.mode === 'daily' ? 1.15 : 1;
  const deltaRaw = (performance - 0.5) * 8 * modeMultiplier;

  return {
    speedDelta: deltaRaw * weights.speed,
    memoryDelta: deltaRaw * weights.memory,
    logicDelta: deltaRaw * weights.logic,
    attentionDelta: deltaRaw * weights.attention,
  };
}

function smoothDimension(oldValue: number, delta: number, alpha: number): number {
  const target = clamp(oldValue + delta, 0, 100);
  return Math.round(oldValue * (1 - alpha) + target * alpha);
}

export function applyNeuroScore(profile: Profile, input: NeuroScoreInput): { neuro: NeuroMetrics } {
  const alpha = input.mode === 'daily' ? 0.45 : 0.35;
  const delta = computeNeuroDelta(input);

  const neuro: NeuroMetrics = {
    speed: smoothDimension(profile.neuro.speed, delta.speedDelta, alpha),
    memory: smoothDimension(profile.neuro.memory, delta.memoryDelta, alpha),
    logic: smoothDimension(profile.neuro.logic, delta.logicDelta, alpha),
    attention: smoothDimension(profile.neuro.attention, delta.attentionDelta, alpha),
    updatedAtISO: nowISO(),
  };

  return { neuro };
}

export async function updateNeuroAfterGame(input: NeuroScoreInput): Promise<Profile> {
  const profile = await getProfile();
  const patch = applyNeuroScore(profile, input);
  return updateProfile(patch);
}
