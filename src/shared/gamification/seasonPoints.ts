import { Difficulty, GameId } from '../../games/types';
import { getLeagueById, League } from './leagues';
import { ensureSeasonCurrent, getProfile, updateProfile } from '../storage/profile';
import { computeSp } from '../../core/gamification/economy';

type CalcSeasonPointsInput = {
  gameId: GameId;
  difficulty: Difficulty;
  score?: number;
  mistakes?: number;
  durationMs?: number;
  isDaily?: boolean;
  // TODO: Kept for backward compatibility during economy migration.
  // Current SP formula in computeSp does not use this flag yet.
  dailyCompletedAndClaimable?: boolean;
};

export function calcSeasonPoints({
  difficulty,
  score = 0,
  isDaily,
  dailyCompletedAndClaimable,
}: CalcSeasonPointsInput): number {
  // TODO: Revisit whether dailyCompletedAndClaimable should affect SP.
  // Intentionally no-op for now to preserve current behavior.
  void dailyCompletedAndClaimable;

  return computeSp({
    score: Math.max(0, Math.min(100, Math.floor(score))),
    difficulty,
    isDaily: Boolean(isDaily),
  });
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

  return {
    earnedSeasonPoints,
    seasonPoints: updated.seasonPoints,
    league: getLeagueById(profile.leagueId),
  };
}
