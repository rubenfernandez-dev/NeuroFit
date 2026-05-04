import { Difficulty, GameId } from '../../games/types';
import { getLeagueById, League } from './leagues';
import { ensureSeasonCurrent, getProfile, updateProfile } from '../storage/profile';
import { computeSp } from '../../core/gamification/economy';
import { logEvent } from '../../core/telemetry';
import { trackNeuroCoinsEarned } from '../../services/analytics';

type CalcSeasonPointsInput = {
  gameId: GameId;
  difficulty: Difficulty;
  score?: number;
  mistakes?: number;
  durationMs?: number;
  isDaily?: boolean;
  rewardMultiplier?: number;
  // Legacy flag kept for backward compatibility during economy migration.
  // Current SP formula in computeSp does not use this flag yet.
  dailyCompletedAndClaimable?: boolean;
};

type GrantFlatSeasonPointsInput = {
  gameId: GameId;
  difficulty: Difficulty;
  amount: number;
  source?: 'manual' | 'session_streak_bonus';
};

export function calcSeasonPoints({
  difficulty,
  score = 0,
  isDaily,
  rewardMultiplier,
  dailyCompletedAndClaimable,
}: CalcSeasonPointsInput): number {
  // Intentionally ignored to preserve current reward balance and avoid regressions.
  // Intentionally no-op for now to preserve current behavior.
  void dailyCompletedAndClaimable;

  const base = computeSp({
    score: Math.max(0, Math.min(100, Math.floor(score))),
    difficulty,
    isDaily: Boolean(isDaily),
  });

  const multiplier = Math.max(0, Math.min(1, rewardMultiplier ?? 1));
  return Math.max(0, Math.round(base * multiplier));
}

export async function grantSeasonPoints(input: CalcSeasonPointsInput): Promise<{
  earnedSeasonPoints: number;
  seasonPoints: number;
  league: League;
}> {
  await ensureSeasonCurrent();
  const profile = await getProfile();
  const earnedSeasonPoints = calcSeasonPoints(input);
  const nextSeasonPoints = profile.seasonPoints + earnedSeasonPoints;

  const updated = await updateProfile({
    seasonPoints: nextSeasonPoints,
  });

  logEvent('sp_granted', { gameId: input.gameId, difficulty: input.difficulty, isDaily: input.isDaily, earnedSeasonPoints, seasonPoints: updated.seasonPoints });
  void trackNeuroCoinsEarned({
    amount: earnedSeasonPoints,
    balance: updated.seasonPoints,
    reason: input.isDaily ? 'daily_gameplay' : 'gameplay',
    gameId: input.gameId,
    difficulty: input.difficulty,
    source: 'grant_season_points',
  });

  return {
    earnedSeasonPoints,
    seasonPoints: updated.seasonPoints,
    league: getLeagueById(profile.leagueId),
  };
}

export async function grantFlatSeasonPoints(input: GrantFlatSeasonPointsInput): Promise<{
  earnedSeasonPoints: number;
  seasonPoints: number;
  league: League;
}> {
  await ensureSeasonCurrent();
  const profile = await getProfile();
  const earnedSeasonPoints = Math.max(0, Math.floor(input.amount));
  const nextSeasonPoints = profile.seasonPoints + earnedSeasonPoints;

  const updated = await updateProfile({
    seasonPoints: nextSeasonPoints,
  });

  logEvent('sp_granted_flat', {
    gameId: input.gameId,
    difficulty: input.difficulty,
    source: input.source ?? 'manual',
    earnedSeasonPoints,
    seasonPoints: updated.seasonPoints,
  });
  void trackNeuroCoinsEarned({
    amount: earnedSeasonPoints,
    balance: updated.seasonPoints,
    reason: input.source ?? 'manual',
    gameId: input.gameId,
    difficulty: input.difficulty,
    source: 'grant_flat_season_points',
  });

  return {
    earnedSeasonPoints,
    seasonPoints: updated.seasonPoints,
    league: getLeagueById(profile.leagueId),
  };
}
