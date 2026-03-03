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

export async function resetStats() {
  await deleteItem(STORAGE_KEYS.stats);
}