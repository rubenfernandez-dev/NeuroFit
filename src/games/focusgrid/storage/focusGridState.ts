import { STORAGE_KEYS } from '../../../shared/storage/keys';
import { Difficulty } from '../../types';
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

const VALID_PHASES = new Set<string>(['idle', 'playing', 'finished']);

export type FocusGridState = {
  startedAtISO: string;
  numbers: number[];
  nextExpected: number;
  mistakes: number;
  correctTaps: number;
  totalTaps: number;
  timeLeft: number;
  sessionSeed: number;
  started: boolean;
  didFinish: boolean;
  phase: 'idle' | 'playing' | 'finished';
  difficulty: Difficulty;
  isDaily?: boolean;
  dailyDateISO?: string;
  seed?: number;
};

// Validates the grid numbers array: all values must be unique positive integers.
// Returns null when the array is missing or structurally invalid.
function normalizeNumbers(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const seen = new Set<number>();
  const result: number[] = [];

  for (const item of value) {
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 1) return null;
    if (seen.has(item)) return null; // duplicates indicate corruption
    seen.add(item);
    result.push(item);
  }

  return result;
}

function normalizeFocusGridState(parsed: Record<string, unknown>): FocusGridState | null {
  const numbers = normalizeNumbers(parsed.numbers);
  // Without a valid grid there is nothing to restore.
  if (numbers === null) return null;

  const phase = typeof parsed.phase === 'string' && VALID_PHASES.has(parsed.phase)
    ? (parsed.phase as FocusGridState['phase'])
    : null;
  if (phase === null) return null;

  // sessionSeed is required to reproduce the shuffled grid if needed.
  const sessionSeed = normalizeOptionalSeed(parsed.sessionSeed);
  if (!sessionSeed) return null;

  const correctTaps = normalizeNonNegativeInt(parsed.correctTaps);
  const totalTaps = normalizeNonNegativeInt(parsed.totalTaps);
  // nextExpected is a 1-based index into the sorted sequence (1..numbers.length).
  // Allow up to numbers.length + 1 so a just-completed last tap is representable.
  const nextExpected = Math.max(
    1,
    normalizeNonNegativeInt(parsed.nextExpected, 1, numbers.length + 1),
  );

  return {
    startedAtISO:
      typeof parsed.startedAtISO === 'string' && parsed.startedAtISO.length > 0
        ? parsed.startedAtISO
        : new Date().toISOString(),
    numbers,
    nextExpected,
    mistakes: normalizeNonNegativeInt(parsed.mistakes),
    correctTaps,
    // totalTaps must be at least correctTaps.
    totalTaps: Math.max(correctTaps, totalTaps),
    timeLeft: normalizeNonNegativeInt(parsed.timeLeft),
    sessionSeed,
    started: Boolean(parsed.started),
    didFinish: Boolean(parsed.didFinish),
    phase,
    difficulty: normalizeStoredDifficulty(parsed.difficulty, 'avanzado') as Difficulty,
    isDaily: normalizeOptionalBoolean(parsed.isDaily),
    dailyDateISO: normalizeOptionalString(parsed.dailyDateISO),
    seed: normalizeOptionalSeed(parsed.seed),
  };
}

export async function getFocusGridState(): Promise<FocusGridState | null> {
  const parsed = parseStoredObject(await getItem(STORAGE_KEYS.focusGridState));
  if (!parsed) return null;
  return normalizeFocusGridState(parsed);
}

export async function saveFocusGridState(state: FocusGridState) {
  await setItem(STORAGE_KEYS.focusGridState, JSON.stringify({ ...state, storageVersion: STORAGE_VERSION }));
}

export async function clearFocusGridState() {
  await deleteItem(STORAGE_KEYS.focusGridState);
}
