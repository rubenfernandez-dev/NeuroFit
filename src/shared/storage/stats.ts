import { GameId, Difficulty } from '../../games/types';
import { STORAGE_KEYS } from './keys';
import { nowISO } from '../utils/time';
import { deleteItem, getItem, setItem } from './secureStore';

export type GameStats = {
  sessions: number;
  bestScore?: number;
  bestTimeMs?: number;
  bestTimeByDifficulty?: Partial<Record<Difficulty, number>>;
  lastPlayedISO?: string;
  wins?: number;
  plays?: number;
  avgScore?: number;
  avgMistakes?: number;
  bestMaxSequence?: number;
  sudokuPlayed?: number;
  sudokuCompleted?: number;
  sudokuTotalTimeMs?: number;
  sudokuTotalMistakes?: number;
};

export type StatsStore = Partial<Record<GameId, GameStats>>;

const emptyStats: GameStats = {
  sessions: 0,
  wins: 0,
  plays: 0,
  avgScore: 0,
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
  accuracyPct?: number;
  reactionTimeAvgMs?: number;
  maxSequence?: number;
};

type PatternMemoryOutcome = {
  gameId: 'patternmemory';
  score: number;
  maxSequence: number;
  accuracyPct: number;
  reactionTimeAvgMs: number;
  durationMs?: number;
  won?: boolean;
};

type FocusGridOutcome = {
  gameId: 'focusgrid';
  difficulty: Difficulty;
  score: number;
  mistakes: number;
  accuracyPct: number;
  durationMs?: number;
  completed?: boolean;
};

const GAME_IDS: GameId[] = ['sudoku', 'memory', 'mentalmath', 'speedmatch', 'patternmemory', 'focusgrid'];

function normalizeBestTimeByDifficulty(
  input: Partial<Record<Difficulty, number>> | undefined,
): Partial<Record<Difficulty, number>> | undefined {
  if (!input) return undefined;
  const normalized: Partial<Record<Difficulty, number>> = {};
  const difficulties: Difficulty[] = ['principiante', 'avanzado', 'experto', 'maestro', 'gran_maestro'];

  difficulties.forEach((difficulty) => {
    const value = input[difficulty];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      normalized[difficulty] = Math.floor(value);
    }
  });

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeStore(store: StatsStore): StatsStore {
  const normalized: StatsStore = {};
  GAME_IDS.forEach((gameId) => {
    const entry = store[gameId];
    if (!entry) return;
    normalized[gameId] = normalizeStatsEntry(entry);
  });
  return normalized;
}

function normalizeStatsEntry(entry: GameStats | undefined): GameStats {
  return {
    ...emptyStats,
    ...(entry ?? {}),
    sessions: Math.max(0, entry?.sessions ?? 0),
    wins: Math.max(0, entry?.wins ?? 0),
    plays: Math.max(0, entry?.plays ?? entry?.sessions ?? 0),
    avgScore: Math.max(0, Math.min(100, entry?.avgScore ?? 0)),
    avgMistakes: Math.max(0, entry?.avgMistakes ?? 0),
    bestTimeByDifficulty: normalizeBestTimeByDifficulty(entry?.bestTimeByDifficulty),
  };
}

export async function getAllStats(): Promise<StatsStore> {
  const raw = await getItem(STORAGE_KEYS.stats);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as StatsStore;
    const normalized = normalizeStore(parsed);

    if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
      await setItem(STORAGE_KEYS.stats, JSON.stringify(normalized));
    }

    return normalized;
  } catch {
    return {};
  }
}

export async function getGameStats(gameId: GameId): Promise<GameStats> {
  const all = await getAllStats();
  return normalizeStatsEntry(all[gameId]);
}

// Deprecated: superseded by trackSessionStart/trackWin for the current game flows.
export async function recordSession({ gameId, score, durationMs, won }: RecordSessionInput): Promise<GameStats> {
  const all = await getAllStats();
  const current = normalizeStatsEntry(all[gameId]);

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
  const current = normalizeStatsEntry(all[gameId]);

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
  const current = normalizeStatsEntry(all[gameId]);
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
  const current = normalizeStatsEntry(all[gameId]);
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

// Deprecated: retained for compatibility; prefer trackSessionStart({ gameId: 'sudoku' }).
export async function recordSudokuStarted(): Promise<GameStats> {
  return trackSessionStart({ gameId: 'sudoku', mode: 'normal' });
}

// Deprecated: retained for compatibility; prefer trackWin/trackGameOver directly.
export async function recordSudokuOutcome(params: { won: boolean; durationMs?: number; mistakes?: number }): Promise<GameStats> {
  if (params.won) {
    return trackWin({ gameId: 'sudoku', mode: 'normal', durationMs: params.durationMs, mistakes: params.mistakes });
  }
  return trackGameOver({ gameId: 'sudoku', mode: 'normal', durationMs: params.durationMs, mistakes: params.mistakes });
}

export async function trackPatternMemoryResult(input: PatternMemoryOutcome): Promise<GameStats> {
  const all = await getAllStats();
  const current = normalizeStatsEntry(all.patternmemory);
  const safeScore = Math.max(0, Math.min(100, Math.floor(input.score)));
  const safeMaxSequence = Math.max(0, Math.floor(input.maxSequence));
  const safeDuration = typeof input.durationMs === 'number' ? Math.max(0, Math.floor(input.durationMs)) : undefined;
  const nextPlays = (current.plays ?? current.sessions ?? 0) + 1;
  const prevAvg = current.avgScore ?? 0;
  const nextAvg = nextPlays <= 1 ? safeScore : Math.round((prevAvg * (nextPlays - 1) + safeScore) / nextPlays);

  const next: GameStats = {
    ...current,
    plays: nextPlays,
    wins: (current.wins ?? 0) + (input.won ? 1 : 0),
    lastPlayedISO: nowISO(),
    bestScore: Math.max(current.bestScore ?? safeScore, safeScore),
    bestMaxSequence: Math.max(current.bestMaxSequence ?? safeMaxSequence, safeMaxSequence),
    avgScore: Math.max(0, Math.min(100, nextAvg)),
  };

  if (typeof safeDuration === 'number') {
    next.bestTimeMs = Math.min(current.bestTimeMs ?? safeDuration, safeDuration);
  }

  all.patternmemory = next;
  await setItem(STORAGE_KEYS.stats, JSON.stringify(all));
  return next;
}

export async function trackFocusGridResult(input: FocusGridOutcome): Promise<GameStats> {
  const all = await getAllStats();
  const current = normalizeStatsEntry(all.focusgrid);
  const safeScore = Math.max(0, Math.min(100, Math.floor(input.score)));
  const safeMistakes = Math.max(0, Math.floor(input.mistakes));
  const safeDuration = typeof input.durationMs === 'number' ? Math.max(0, Math.floor(input.durationMs)) : undefined;
  const nextPlays = (current.plays ?? current.sessions ?? 0) + 1;
  const prevAvgScore = current.avgScore ?? 0;
  const prevAvgMistakes = current.avgMistakes ?? 0;
  const nextAvgScore = nextPlays <= 1 ? safeScore : Math.round((prevAvgScore * (nextPlays - 1) + safeScore) / nextPlays);
  const nextAvgMistakes =
    nextPlays <= 1
      ? safeMistakes
      : Math.round(((prevAvgMistakes * (nextPlays - 1) + safeMistakes) / nextPlays) * 100) / 100;

  const nextBestByDifficulty: Partial<Record<Difficulty, number>> = {
    ...(current.bestTimeByDifficulty ?? {}),
  };

  if (input.completed && typeof safeDuration === 'number') {
    const currentBest = nextBestByDifficulty[input.difficulty];
    nextBestByDifficulty[input.difficulty] = Math.min(currentBest ?? safeDuration, safeDuration);
  }

  const next: GameStats = {
    ...current,
    plays: nextPlays,
    wins: (current.wins ?? 0) + (input.completed ? 1 : 0),
    lastPlayedISO: nowISO(),
    bestScore: Math.max(current.bestScore ?? safeScore, safeScore),
    avgScore: Math.max(0, Math.min(100, nextAvgScore)),
    avgMistakes: Math.max(0, nextAvgMistakes),
    bestTimeByDifficulty: normalizeBestTimeByDifficulty(nextBestByDifficulty),
  };

  if (input.completed && typeof safeDuration === 'number') {
    next.bestTimeMs = Math.min(current.bestTimeMs ?? safeDuration, safeDuration);
  }

  all.focusgrid = next;
  await setItem(STORAGE_KEYS.stats, JSON.stringify(all));
  return next;
}

export async function resetStats() {
  await deleteItem(STORAGE_KEYS.stats);
}