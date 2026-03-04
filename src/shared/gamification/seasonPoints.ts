import { Difficulty, GameId } from '../../games/types';
import { getLeagueById, League } from './leagues';
import { ensureSeasonCurrent, getProfile, updateProfile } from '../storage/profile';

type CalcSeasonPointsInput = {
  gameId: GameId;
  difficulty: Difficulty;
  mistakes?: number;
  durationMs?: number;
  isDaily?: boolean;
  dailyCompletedAndClaimable?: boolean;
};

const difficultySeasonPoints: Record<Difficulty, number> = {
  principiante: 40,
  avanzado: 70,
  experto: 120,
  maestro: 200,
  gran_maestro: 350,
};

export function calcSeasonPoints({
  difficulty,
  mistakes = 0,
  durationMs,
  isDaily,
  dailyCompletedAndClaimable,
}: CalcSeasonPointsInput): number {
  let points = difficultySeasonPoints[difficulty];

  if (mistakes === 0) {
    points += 20;
  }

  if (typeof durationMs === 'number' && durationMs > 0) {
    if (durationMs <= 90_000) points += 30;
    else if (durationMs <= 180_000) points += 20;
    else if (durationMs <= 300_000) points += 10;
  }

  if (isDaily && dailyCompletedAndClaimable) {
    points += 50;
  }

  return Math.max(0, points);
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
