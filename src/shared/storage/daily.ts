import { Difficulty, GameId } from '../../games/types';
import { STORAGE_KEYS } from './keys';
import { enabledGames } from '../../games/registry';
import { todayISODate } from '../utils/time';
import { createSeededRng, pickOne } from '../utils/random';
import { getDailySeed } from '../utils/seed';
import { deleteItem, getItem, setItem } from './secureStore';

export type DailyState = {
  lastDailyDateISO: string;
  completed: boolean;
  dailyGameId: GameId;
  dailyDifficulty: Difficulty;
  dailySeed: number;
};

const defaultDaily = (): DailyState => {
  const date = todayISODate();
  const seed = getDailySeed(date);
  const rng = createSeededRng(seed);
  const game = pickOne(enabledGames(), rng);
  const difficulty = pickOne(game.difficulties, rng);
  return {
    lastDailyDateISO: date,
    completed: false,
    dailyGameId: game.id,
    dailyDifficulty: difficulty,
    dailySeed: seed,
  };
};

export async function getDaily(): Promise<DailyState | null> {
  const raw = await getItem(STORAGE_KEYS.daily);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DailyState;
  } catch {
    return null;
  }
}

export async function ensureDailyToday(): Promise<DailyState> {
  const current = await getDaily();
  const today = todayISODate();
  if (current && current.lastDailyDateISO === today) {
    return current;
  }
  const fresh = defaultDaily();
  await setItem(STORAGE_KEYS.daily, JSON.stringify(fresh));
  return fresh;
}

export async function markDailyCompleted(): Promise<DailyState> {
  const current = (await ensureDailyToday()) as DailyState;
  const next = { ...current, completed: true };
  await setItem(STORAGE_KEYS.daily, JSON.stringify(next));
  return next;
}

export async function resetDaily() {
  await deleteItem(STORAGE_KEYS.daily);
}