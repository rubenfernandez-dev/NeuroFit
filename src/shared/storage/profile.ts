import { STORAGE_KEYS } from './keys';
import { getLevelByXp } from '../gamification/levels';
import { nowISO } from '../utils/time';
import { deleteItem, getItem, setItem } from './secureStore';
import { currentSeasonId, getLeagueRank, getNextLeague, getPrevLeague, LeagueId } from '../gamification/leagues';
import { getUserRankInWeeklyLeaderboard } from '../leaderboard/leaderboard';
import { Difficulty, GameId, normalizeDifficulty } from '../../games/types';

export type ThemePreference = 'system' | 'light' | 'dark';

export type NeuroMetrics = {
  speed: number;
  memory: number;
  logic: number;
  attention: number;
  updatedAtISO?: string;
};

export type Profile = {
  themePreference: ThemePreference;
  xpTotal: number;
  levelId: string;
  lastActiveISO: string;
  streakCurrent: number;
  streakBest: number;
  lastDailyCompletedISO?: string;
  seasonId: string;
  seasonPoints: number;
  leagueId: LeagueId;
  bestLeagueId?: LeagueId;
  lastSeasonUpdateISO?: string;
  lastWeekResult?: {
    seasonIdPrev: string;
    finalRank: number;
    leagueBefore: LeagueId;
    leagueAfter: LeagueId;
    spFinal: number;
  };
  lastWeekResultShownSeasonId?: string;
  preferredDifficultyByGame: Record<GameId, Difficulty>;
  neuro: NeuroMetrics;
};

const VALID_LEAGUES: LeagueId[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grand_master', 'legend'];

function normalizeLeagueId(value: unknown, fallback: LeagueId): LeagueId {
  if (typeof value !== 'string') return fallback;
  return VALID_LEAGUES.includes(value as LeagueId) ? (value as LeagueId) : fallback;
}

const defaultProfile: Profile = {
  themePreference: 'system',
  xpTotal: 0,
  levelId: getLevelByXp(0).id,
  lastActiveISO: nowISO(),
  streakCurrent: 0,
  streakBest: 0,
  seasonId: currentSeasonId(),
  seasonPoints: 0,
  leagueId: 'bronze',
  bestLeagueId: 'bronze',
  lastSeasonUpdateISO: nowISO(),
  preferredDifficultyByGame: {
    sudoku: 'avanzado',
    memory: 'principiante',
    mentalmath: 'avanzado',
    speedmatch: 'avanzado',
  },
  neuro: {
    speed: 50,
    memory: 50,
    logic: 50,
    attention: 50,
  },
};

export async function getProfile(): Promise<Profile> {
  const raw = await getItem(STORAGE_KEYS.profile);
  if (!raw) return defaultProfile;
  try {
    const parsed = JSON.parse(raw) as Partial<Profile>;
    const neuro = {
      speed: typeof parsed.neuro?.speed === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.neuro.speed))) : defaultProfile.neuro.speed,
      memory: typeof parsed.neuro?.memory === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.neuro.memory))) : defaultProfile.neuro.memory,
      logic: typeof parsed.neuro?.logic === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.neuro.logic))) : defaultProfile.neuro.logic,
      attention: typeof parsed.neuro?.attention === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.neuro.attention))) : defaultProfile.neuro.attention,
      updatedAtISO: typeof parsed.neuro?.updatedAtISO === 'string' ? parsed.neuro.updatedAtISO : undefined,
    };

    const normalized: Profile = {
      ...defaultProfile,
      ...parsed,
      seasonId: typeof parsed.seasonId === 'string' ? parsed.seasonId : defaultProfile.seasonId,
      seasonPoints: typeof parsed.seasonPoints === 'number' ? Math.max(0, Math.floor(parsed.seasonPoints)) : 0,
      leagueId: normalizeLeagueId(parsed.leagueId, defaultProfile.leagueId),
      bestLeagueId: normalizeLeagueId(parsed.bestLeagueId, normalizeLeagueId(parsed.leagueId, defaultProfile.leagueId)),
      preferredDifficultyByGame: {
        sudoku: normalizeDifficulty(parsed.preferredDifficultyByGame?.sudoku, defaultProfile.preferredDifficultyByGame.sudoku),
        memory: normalizeDifficulty(parsed.preferredDifficultyByGame?.memory, defaultProfile.preferredDifficultyByGame.memory),
        mentalmath: normalizeDifficulty(parsed.preferredDifficultyByGame?.mentalmath, defaultProfile.preferredDifficultyByGame.mentalmath),
        speedmatch: normalizeDifficulty(parsed.preferredDifficultyByGame?.speedmatch, defaultProfile.preferredDifficultyByGame.speedmatch),
      },
      neuro,
    };

    if (!parsed.neuro) {
      await setItem(STORAGE_KEYS.profile, JSON.stringify(normalized));
    }

    return normalized;
  } catch {
    return defaultProfile;
  }
}

export async function ensureSeasonCurrent(): Promise<Profile> {
  const profile = await getProfile();
  const season = currentSeasonId();
  if (profile.seasonId === season) {
    return profile;
  }

  const finalRank = await getUserRankInWeeklyLeaderboard({
    seasonId: profile.seasonId,
    leagueId: profile.leagueId,
    userSeasonPoints: profile.seasonPoints,
  });

  let leagueAfter = profile.leagueId;
  if (finalRank <= 10) {
    leagueAfter = getNextLeague(profile.leagueId)?.id ?? profile.leagueId;
  } else if (finalRank >= 41) {
    leagueAfter = getPrevLeague(profile.leagueId)?.id ?? profile.leagueId;
  }

  const bestLeagueId =
    profile.bestLeagueId && getLeagueRank(profile.bestLeagueId) > getLeagueRank(leagueAfter)
      ? profile.bestLeagueId
      : leagueAfter;

  const lastWeekResult = {
    seasonIdPrev: profile.seasonId,
    finalRank,
    leagueBefore: profile.leagueId,
    leagueAfter,
    spFinal: profile.seasonPoints,
  };

  return updateProfile({
    seasonId: season,
    seasonPoints: 0,
    leagueId: leagueAfter,
    bestLeagueId,
    lastWeekResult,
    lastSeasonUpdateISO: nowISO(),
  });
}

export async function markLastWeekResultShown(seasonIdPrev: string): Promise<Profile> {
  return updateProfile({
    lastWeekResultShownSeasonId: seasonIdPrev,
  });
}

export async function resetSeasonProgress(): Promise<Profile> {
  return updateProfile({
    seasonId: currentSeasonId(),
    seasonPoints: 0,
    leagueId: 'bronze',
    lastWeekResult: undefined,
    lastWeekResultShownSeasonId: undefined,
    lastSeasonUpdateISO: nowISO(),
  });
}

export async function updateProfile(partial: Partial<Profile>): Promise<Profile> {
  const current = await getProfile();
  const next = { ...current, ...partial, lastActiveISO: nowISO() };
  await setItem(STORAGE_KEYS.profile, JSON.stringify(next));
  return next;
}

export async function resetProfile() {
  await deleteItem(STORAGE_KEYS.profile);
}

export async function getPreferredDifficulty(gameId: GameId): Promise<Difficulty> {
  const profile = await getProfile();
  return normalizeDifficulty(profile.preferredDifficultyByGame?.[gameId], defaultProfile.preferredDifficultyByGame[gameId]);
}

export async function setPreferredDifficulty(gameId: GameId, difficulty: Difficulty): Promise<Profile> {
  const profile = await getProfile();
  return updateProfile({
    preferredDifficultyByGame: {
      ...profile.preferredDifficultyByGame,
      [gameId]: normalizeDifficulty(difficulty, profile.preferredDifficultyByGame[gameId]),
    },
  });
}