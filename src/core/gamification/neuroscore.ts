import { computePerformanceFromScore } from './economy';
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
const DEFAULT_NEURO_WEIGHTS: NeuroWeights = { speed: 0.5, memory: 0, logic: 0.3, attention: 0.2 };

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NEURO_INACTIVITY_GRACE_DAYS = 7;
const NEURO_INACTIVITY_DECAY_PER_DAY = 1;
const NEURO_INACTIVITY_MAX_DECAY_PER_UPDATE = 20;


const WEIGHTS_BY_GAME: Partial<Record<GameId, NeuroWeights>> = {
  sudoku: { speed: 0, memory: 0, logic: 0.7, attention: 0.3 },
  memory: { speed: 0, memory: 0.7, logic: 0, attention: 0.3 },
  mentalmath: { speed: 0.5, memory: 0, logic: 0.3, attention: 0.2 },
  speedmatch: { speed: 0.6, memory: 0, logic: 0, attention: 0.4 },
  patternmemory: { speed: 0, memory: 0.7, logic: 0, attention: 0.3 },
  focusgrid: { speed: 0.3, memory: 0, logic: 0.2, attention: 0.5 },
  numbermatch: { speed: 0, memory: 0, logic: 0.65, attention: 0.35 },
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

function zeroDelta(): NeuroDelta {
  return {
    speedDelta: 0,
    memoryDelta: 0,
    logicDelta: 0,
    attentionDelta: 0,
  };
}

function daysSinceISO(iso?: string, nowMs = Date.now()): number {
  if (!iso) return 0;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return 0;
  if (parsed >= nowMs) return 0;
  return Math.floor((nowMs - parsed) / MS_PER_DAY);
}

function applyInactivityDecay(neuro: NeuroMetrics): NeuroMetrics {
  const idleDays = daysSinceISO(neuro.updatedAtISO);
  const overdueDays = Math.max(0, idleDays - NEURO_INACTIVITY_GRACE_DAYS);
  if (overdueDays <= 0) return neuro;

  const decay = Math.min(
    NEURO_INACTIVITY_MAX_DECAY_PER_UPDATE,
    overdueDays * NEURO_INACTIVITY_DECAY_PER_DAY,
  );

  return {
    ...neuro,
    speed: clamp(Math.round(neuro.speed - decay), 0, 100),
    memory: clamp(Math.round(neuro.memory - decay), 0, 100),
    logic: clamp(Math.round(neuro.logic - decay), 0, 100),
    attention: clamp(Math.round(neuro.attention - decay), 0, 100),
  };
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

  if (input.gameId === 'patternmemory') {
    const scoreNormalized = clamp((input.score ?? 0) / 100, 0, 1);
    const timeFactor = mapTimeFactor(input.durationMs, 35_000, 120_000);
    const penalty = clamp(mistakes / 12, 0, 1) * 0.15;
    return clamp(scoreNormalized * 0.85 + timeFactor * 0.15 - penalty, 0, 1);
  }

  if (input.gameId === 'focusgrid') {
    const scoreNormalized = clamp((input.score ?? 0) / 100, 0, 1);
    const timeFactor = mapTimeFactor(input.durationMs, 30_000, 80_000);
    const penalty = clamp(mistakes / 20, 0, 1) * 0.2;
    return clamp(scoreNormalized * 0.8 + timeFactor * 0.2 - penalty, 0, 1);
  }

  if (input.gameId === 'numbermatch') {
    const safeScore = clamp(input.score ?? 0, 0, 100);
    const safeDifficulty = input.difficulty ?? 'avanzado';
    return computePerformanceFromScore(safeScore, safeDifficulty);
  }

  const correct = Math.max(0, input.score ?? 0);
  const total = Math.max(1, correct + mistakes);
  const correctRate = clamp(correct / total, 0, 1);
  const timeFactor = mapTimeFactor(input.durationMs, 30_000, 80_000);
  return clamp(correctRate * 0.7 + timeFactor * 0.3, 0, 1);
}

export function computeNeuroDelta(input: NeuroScoreInput): NeuroDelta {
  if (input.won !== true) {
    return zeroDelta();
  }

  const weights = WEIGHTS_BY_GAME[input.gameId] ?? DEFAULT_NEURO_WEIGHTS;
  const performance = computePerformanceNormalized(input);
  if (performance <= 0.5) {
    return zeroDelta();
  }

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
  const baseline = applyInactivityDecay(profile.neuro);
  const delta = computeNeuroDelta(input);

  const neuro: NeuroMetrics = {
    speed: smoothDimension(baseline.speed, delta.speedDelta, alpha),
    memory: smoothDimension(baseline.memory, delta.memoryDelta, alpha),
    logic: smoothDimension(baseline.logic, delta.logicDelta, alpha),
    attention: smoothDimension(baseline.attention, delta.attentionDelta, alpha),
    updatedAtISO: nowISO(),
  };

  return { neuro };
}

export async function updateNeuroAfterGame(input: NeuroScoreInput): Promise<Profile> {
  const profile = await getProfile();
  const patch = applyNeuroScore(profile, input);
  return updateProfile(patch);
}
