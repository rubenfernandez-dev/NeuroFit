import { STORAGE_KEYS } from '../../shared/storage/keys';
import { Difficulty } from '../types';
import { deleteItem, getItem, setItem } from '../../shared/storage/secureStore';
import {
  normalizeNonNegativeInt,
  normalizeOptionalBoolean,
  normalizeOptionalSeed,
  normalizeOptionalString,
  normalizeStoredDifficulty,
  parseStoredObject,
} from '../storage/persistence';

const STORAGE_VERSION = 1;

const VALID_PHASES = new Set<string>(['idle', 'playing', 'finished']);

export type NumberMatchState = {
  startedAtISO: string;
  board: Array<number | null>;
  selectedIndex: number | null;
  score: number;
  validMatches: number;
  invalidMatches: number;
  combo: number;
  bestCombo: number;
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

function normalizeBoard(value: unknown): Array<number | null> | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const board: Array<number | null> = [];
  for (const item of value) {
    if (item === null) {
      board.push(null);
      continue;
    }
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 1 || item > 9) return null;
    board.push(item);
  }
  return board;
}

function normalizeNumberMatchState(parsed: Record<string, unknown>): NumberMatchState | null {
  const board = normalizeBoard(parsed.board);
  if (!board) return null;

  const phase = typeof parsed.phase === 'string' && VALID_PHASES.has(parsed.phase)
    ? (parsed.phase as NumberMatchState['phase'])
    : null;
  if (!phase) return null;

  const sessionSeed = normalizeOptionalSeed(parsed.sessionSeed);
  if (!sessionSeed) return null;

  const selectedRaw = parsed.selectedIndex;
  const selectedIndex = typeof selectedRaw === 'number' && Number.isInteger(selectedRaw)
    ? Math.max(0, Math.min(board.length - 1, selectedRaw))
    : null;

  return {
    startedAtISO: typeof parsed.startedAtISO === 'string' ? parsed.startedAtISO : new Date().toISOString(),
    board,
    selectedIndex,
    score: normalizeNonNegativeInt(parsed.score),
    validMatches: normalizeNonNegativeInt(parsed.validMatches),
    invalidMatches: normalizeNonNegativeInt(parsed.invalidMatches),
    combo: normalizeNonNegativeInt(parsed.combo),
    bestCombo: normalizeNonNegativeInt(parsed.bestCombo),
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

export async function getNumberMatchState(): Promise<NumberMatchState | null> {
  const parsed = parseStoredObject(await getItem(STORAGE_KEYS.numberMatchState));
  if (!parsed) return null;
  return normalizeNumberMatchState(parsed);
}

export async function saveNumberMatchState(state: NumberMatchState) {
  await setItem(STORAGE_KEYS.numberMatchState, JSON.stringify({ ...state, storageVersion: STORAGE_VERSION }));
}

export async function clearNumberMatchState() {
  await deleteItem(STORAGE_KEYS.numberMatchState);
}
