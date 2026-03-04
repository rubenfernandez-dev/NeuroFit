import { GameId, Difficulty } from '../../games/types';
import { STORAGE_KEYS } from './keys';
import { nowISO } from '../utils/time';
import { deleteItem, getItem, setItem } from './secureStore';

export type GameStats = {
  sessions: number;
  bestScore?: number;
  bestTimeMs?: number;
  lastPlayedISO?: string;
  wins?: number;
  sudokuPlayed?: number;
  sudokuCompleted?: number;
  sudokuTotalTimeMs?: number;
  sudokuTotalMistakes?: number;
};

export type StatsStore = Partial<Record<GameId, GameStats>>;

const emptyStats: GameStats = {
  sessions: 0,
  wins: 0,
};

type RecordSessionInput = {
  gameId: GameId;
  difficulty?: Difficulty;
  score?: number;
  durationMs?: number;
  won?: boolean;
};

type TrackContext = {
  gameId: GameId;
  mode?: 'normal' | 'daily';
};

type TrackOutcome = TrackContext & {
  durationMs?: number;
  mistakes?: number;
  difficulty?: Difficulty;
  score?: number;
};

export async function getAllStats(): Promise<StatsStore> {
  const raw = await getItem(STORAGE_KEYS.stats);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as StatsStore;
  } catch {
    return {};
  }
}

export async function getGameStats(gameId: GameId): Promise<GameStats> {
  const all = await getAllStats();
  return all[gameId] ?? emptyStats;
}

export async function recordSession({ gameId, score, durationMs, won }: RecordSessionInput): Promise<GameStats> {
  const all = await getAllStats();
  const current = all[gameId] ?? emptyStats;

  const next: GameStats = {
    ...current,
    sessions: current.sessions + 1,
    wins: (current.wins ?? 0) + (won ? 1 : 0),
    lastPlayedISO: nowISO(),
  };

  if (typeof score === 'number') {
    next.bestScore = Math.max(current.bestScore ?? score, score);
  }

  if (typeof durationMs === 'number') {
    next.bestTimeMs = Math.min(current.bestTimeMs ?? durationMs, durationMs);
  }

  all[gameId] = next;
  await setItem(STORAGE_KEYS.stats, JSON.stringify(all));
  return next;
}

export async function trackSessionStart({ gameId }: TrackContext): Promise<GameStats> {
  const all = await getAllStats();
  const current = all[gameId] ?? emptyStats;

  const next: GameStats = {
    ...current,
    sessions: (current.sessions ?? 0) + 1,
    lastPlayedISO: nowISO(),
  };

  if (gameId === 'sudoku') {
    next.sudokuPlayed = (current.sudokuPlayed ?? 0) + 1;
  }

  all[gameId] = next;
  await setItem(STORAGE_KEYS.stats, JSON.stringify(all));
  return next;
}

export async function trackWin({ gameId, durationMs, mistakes = 0, score }: TrackOutcome): Promise<GameStats> {
  const all = await getAllStats();
  const current = all[gameId] ?? emptyStats;
  const safeDuration = typeof durationMs === 'number' ? Math.max(0, Math.floor(durationMs)) : undefined;
  const safeMistakes = Math.max(0, Math.floor(mistakes));

  const next: GameStats = {
    ...current,
    wins: (current.wins ?? 0) + 1,
    lastPlayedISO: nowISO(),
  };

  if (typeof score === 'number') {
    next.bestScore = Math.max(current.bestScore ?? score, score);
  }

  if (typeof safeDuration === 'number') {
    next.bestTimeMs = Math.min(current.bestTimeMs ?? safeDuration, safeDuration);
  }

  if (gameId === 'sudoku') {
    next.sudokuCompleted = (current.sudokuCompleted ?? 0) + 1;
    next.sudokuTotalTimeMs = (current.sudokuTotalTimeMs ?? 0) + (safeDuration ?? 0);
    next.sudokuTotalMistakes = (current.sudokuTotalMistakes ?? 0) + safeMistakes;
  }

  all[gameId] = next;
  await setItem(STORAGE_KEYS.stats, JSON.stringify(all));
  return next;
}

export async function trackGameOver({ gameId, durationMs, mistakes = 0 }: TrackOutcome): Promise<GameStats> {
  const all = await getAllStats();
  const current = all[gameId] ?? emptyStats;
  const safeDuration = typeof durationMs === 'number' ? Math.max(0, Math.floor(durationMs)) : undefined;
  const safeMistakes = Math.max(0, Math.floor(mistakes));

  const next: GameStats = {
    ...current,
    lastPlayedISO: nowISO(),
  };

  if (gameId === 'sudoku') {
    next.sudokuTotalTimeMs = (current.sudokuTotalTimeMs ?? 0) + (safeDuration ?? 0);
    next.sudokuTotalMistakes = (current.sudokuTotalMistakes ?? 0) + safeMistakes;
  }

  all[gameId] = next;
  await setItem(STORAGE_KEYS.stats, JSON.stringify(all));
  return next;
}

export async function recordSudokuStarted(): Promise<GameStats> {
  return trackSessionStart({ gameId: 'sudoku', mode: 'normal' });
}

export async function recordSudokuOutcome(params: { won: boolean; durationMs?: number; mistakes?: number }): Promise<GameStats> {
  if (params.won) {
    return trackWin({ gameId: 'sudoku', mode: 'normal', durationMs: params.durationMs, mistakes: params.mistakes });
  }
  return trackGameOver({ gameId: 'sudoku', mode: 'normal', durationMs: params.durationMs, mistakes: params.mistakes });
}

export async function resetStats() {
  await deleteItem(STORAGE_KEYS.stats);
}