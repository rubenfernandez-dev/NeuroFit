import { STORAGE_KEYS } from '../../../shared/storage/keys';
import { Difficulty } from '../../types';
import { TileId } from '../types';
import { deleteItem, getItem, setItem } from '../../../shared/storage/secureStore';
import {
  normalizeNonNegativeInt,
  normalizeOptionalBoolean,
  normalizeOptionalSeed,
  normalizeOptionalString,
  normalizeStoredDifficulty,
  parseStoredObject,
} from '../../storage/persistence';

// Increment when the persisted shape changes in a breaking way so future
// load code can branch on migrations before normalizing.
const STORAGE_VERSION = 1;

const VALID_TILE_IDS = new Set<number>([0, 1, 2, 3]);
const VALID_PHASES = new Set<string>(['idle', 'showing', 'input', 'finished']);

export type PatternMemoryState = {
  startedAtISO: string;
  sequence: TileId[];
  round: number;
  maxSequence: number;
  inputIndex: number;
  phase: 'idle' | 'showing' | 'input' | 'finished';
  correctTaps: number;
  totalTaps: number;
  mistakes: number;
  reactionAccumMs: number;
  reactionSamples: number;
  promptAtMs: number;
  timeLeft: number;
  sessionSeed: number;
  sessionStarted?: boolean;
  didFinish?: boolean;
  difficulty: Difficulty;
  isDaily?: boolean;
  dailyDateISO?: string;
  seed?: number;
};

// Returns null on any element that is not a valid TileId (0–3).
// An empty sequence is valid (idle phase before first round).
function normalizeSequence(value: unknown): TileId[] | null {
  if (!Array.isArray(value)) return null;
  const result: TileId[] = [];
  for (const item of value) {
    if (!Number.isInteger(item) || !VALID_TILE_IDS.has(item as number)) return null;
    result.push(item as TileId);
  }
  return result;
}

function normalizePatternMemoryState(parsed: Record<string, unknown>): PatternMemoryState | null {
  const sequence = normalizeSequence(parsed.sequence);
  // Corrupted sequence – force fresh session.
  if (sequence === null) return null;

  const phase = typeof parsed.phase === 'string' && VALID_PHASES.has(parsed.phase)
    ? (parsed.phase as PatternMemoryState['phase'])
    : null;
  if (phase === null) return null;

  // sessionSeed is required; without a valid one we cannot reproduce the round.
  const sessionSeed = normalizeOptionalSeed(parsed.sessionSeed);
  if (!sessionSeed) return null;

  const correctTaps = normalizeNonNegativeInt(parsed.correctTaps);
  const totalTaps = normalizeNonNegativeInt(parsed.totalTaps);
  const round = Math.max(1, normalizeNonNegativeInt(parsed.round, 1));
  const maxSequence = normalizeNonNegativeInt(parsed.maxSequence);
  // inputIndex must not exceed sequence length.
  const inputIndex = normalizeNonNegativeInt(parsed.inputIndex, 0, sequence.length);

  return {
    startedAtISO:
      typeof parsed.startedAtISO === 'string' && parsed.startedAtISO.length > 0
        ? parsed.startedAtISO
        : new Date().toISOString(),
    sequence,
    round,
    // maxSequence can never logically exceed the current round count.
    maxSequence: Math.min(maxSequence, round),
    inputIndex,
    phase,
    correctTaps,
    // totalTaps must be at least correctTaps.
    totalTaps: Math.max(correctTaps, totalTaps),
    mistakes: normalizeNonNegativeInt(parsed.mistakes),
    reactionAccumMs: normalizeNonNegativeInt(parsed.reactionAccumMs),
    reactionSamples: normalizeNonNegativeInt(parsed.reactionSamples),
    promptAtMs: normalizeNonNegativeInt(parsed.promptAtMs),
    timeLeft: normalizeNonNegativeInt(parsed.timeLeft),
    sessionSeed,
    sessionStarted: normalizeOptionalBoolean(parsed.sessionStarted),
    didFinish: normalizeOptionalBoolean(parsed.didFinish),
    difficulty: normalizeStoredDifficulty(parsed.difficulty, 'avanzado') as Difficulty,
    isDaily: normalizeOptionalBoolean(parsed.isDaily),
    dailyDateISO: normalizeOptionalString(parsed.dailyDateISO),
    seed: normalizeOptionalSeed(parsed.seed),
  };
}

export async function getPatternMemoryState(): Promise<PatternMemoryState | null> {
  const parsed = parseStoredObject(await getItem(STORAGE_KEYS.patternMemoryState));
  if (!parsed) return null;
  return normalizePatternMemoryState(parsed);
}

export async function savePatternMemoryState(state: PatternMemoryState) {
  await setItem(STORAGE_KEYS.patternMemoryState, JSON.stringify({ ...state, storageVersion: STORAGE_VERSION }));
}

export async function clearPatternMemoryState() {
  await deleteItem(STORAGE_KEYS.patternMemoryState);
}
