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

export type SpeedMatchState = {
  previousSymbol: string;
  currentSymbol: string;
  round: number;
  correct: number;
  mistakes: number;
  score: number;
  timeLeft: number;
  sessionSeed: number;
  sessionStarted?: boolean;
  didFinish?: boolean;
  difficulty: Difficulty;
  isDaily?: boolean;
  dailyDateISO?: string;
  seed?: number;
};

function normalizeSpeedMatchState(parsed: Record<string, unknown>): SpeedMatchState | null {
  // Both symbols are required and must be non-empty strings.
  const previousSymbol = typeof parsed.previousSymbol === 'string' && parsed.previousSymbol.length > 0
    ? parsed.previousSymbol
    : null;
  const currentSymbol = typeof parsed.currentSymbol === 'string' && parsed.currentSymbol.length > 0
    ? parsed.currentSymbol
    : null;
  if (previousSymbol === null || currentSymbol === null) return null;

  // sessionSeed is required to reproduce the deterministic symbol sequence.
  const sessionSeed = normalizeOptionalSeed(parsed.sessionSeed);
  if (!sessionSeed) return null;

  const correct = normalizeNonNegativeInt(parsed.correct);
  const mistakes = normalizeNonNegativeInt(parsed.mistakes);

  return {
    previousSymbol,
    currentSymbol,
    round: Math.max(1, normalizeNonNegativeInt(parsed.round, 1)),
    correct,
    mistakes,
    // score must not be negative; allow values greater than correct+mistakes since
    // scoring formulas can produce non-linear results.
    score: normalizeNonNegativeInt(parsed.score),
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

export async function getSpeedMatchState(): Promise<SpeedMatchState | null> {
  const parsed = parseStoredObject(await getItem(STORAGE_KEYS.speedMatchState));
  if (!parsed) return null;
  return normalizeSpeedMatchState(parsed);
}

export async function saveSpeedMatchState(state: SpeedMatchState) {
  await setItem(STORAGE_KEYS.speedMatchState, JSON.stringify({ ...state, storageVersion: STORAGE_VERSION }));
}

export async function clearSpeedMatchState() {
  await deleteItem(STORAGE_KEYS.speedMatchState);
}
