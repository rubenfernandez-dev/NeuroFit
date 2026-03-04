import { Difficulty, GameId, normalizeDifficulty } from '../../games/types';
import { STORAGE_KEYS } from './keys';
import { enabledGames } from '../../games/registry';
import { todayISODate } from '../utils/time';
import { createSeededRng, pickOne } from '../utils/random';
import { getDailySeed } from '../utils/seed';
import { deleteItem, getItem, setItem } from './secureStore';
import { getProfile, updateProfile } from './profile';
import { applyDailyCompletionToStreak } from '../gamification/streak';

export type DailyState = {
  lastDailyDateISO: string;
  completed: boolean;
  rewardClaimed: boolean;
  dailyGameId: GameId;
  dailyDifficulty: Difficulty;
  dailySeed: number;
};

const defaultDaily = (dateISO: string): DailyState => {
  const seed = getDailySeed(dateISO);
  const rng = createSeededRng(seed);

  const games = enabledGames();
  let dailyGameId: GameId = 'sudoku';
  let dailyDifficulty: Difficulty = 'principiante';

  if (games.length > 0) {
    const game = pickOne(games, rng);
    if (game && game.difficulties.length > 0) {
      dailyGameId = game.id;
      dailyDifficulty = pickOne(game.difficulties, rng);
    }
  }

  return {
    lastDailyDateISO: dateISO,
    completed: false,
    rewardClaimed: false,
    dailyGameId,
    dailyDifficulty,
    dailySeed: seed,
  };
};

export async function getDaily(): Promise<DailyState | null> {
  const raw = await getItem(STORAGE_KEYS.daily);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DailyState>;
    if (!parsed.lastDailyDateISO || !parsed.dailyGameId || !parsed.dailyDifficulty || typeof parsed.dailySeed !== 'number') {
      return null;
    }

    return {
      lastDailyDateISO: parsed.lastDailyDateISO,
      completed: !!parsed.completed,
      rewardClaimed: !!parsed.rewardClaimed,
      dailyGameId: parsed.dailyGameId,
      dailyDifficulty: normalizeDifficulty(parsed.dailyDifficulty, 'principiante'),
      dailySeed: parsed.dailySeed,
    } as DailyState;
  } catch {
    return null;
  }
}

export async function ensureDailyToday(): Promise<DailyState> {
  const current = await getDaily();
  const todayISO = todayISODate();
  if (current && current.lastDailyDateISO === todayISO) {
    if (typeof current.rewardClaimed !== 'boolean') {
      const normalized = { ...current, rewardClaimed: false };
      await setItem(STORAGE_KEYS.daily, JSON.stringify(normalized));
      return normalized;
    }
    return current;
  }
  const fresh = defaultDaily(todayISO);
  await setItem(STORAGE_KEYS.daily, JSON.stringify(fresh));
  return fresh;
}

export async function markDailyCompleted(): Promise<DailyState> {
  const current = (await ensureDailyToday()) as DailyState;
  if (current.completed) {
    return current;
  }

  const todayISO = current.lastDailyDateISO;
  const next = { ...current, completed: true, lastDailyDateISO: todayISO };
  await setItem(STORAGE_KEYS.daily, JSON.stringify(next));

  const profile = await getProfile();
  const streaked = applyDailyCompletionToStreak(profile, todayISO);
  await updateProfile({
    streakCurrent: streaked.streakCurrent,
    streakBest: streaked.streakBest,
    lastDailyCompletedISO: streaked.lastDailyCompletedISO,
  });

  return next;
}

export async function claimDailyReward(): Promise<{ daily: DailyState; alreadyClaimed: boolean }> {
  const daily = await ensureDailyToday();

  if (!daily.completed) {
    return { daily, alreadyClaimed: false };
  }

  if (daily.rewardClaimed) {
    return { daily, alreadyClaimed: true };
  }

  const claimed: DailyState = { ...daily, rewardClaimed: true };
  await setItem(STORAGE_KEYS.daily, JSON.stringify(claimed));
  return { daily: claimed, alreadyClaimed: false };
}

export async function resetDaily() {
  await deleteItem(STORAGE_KEYS.daily);
}