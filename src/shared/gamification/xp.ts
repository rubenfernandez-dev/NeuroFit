import { Difficulty, GameId } from '../../games/types';
import { getLevelByXp } from './levels';
import { getProfile, updateProfile } from '../storage/profile';
import { computeXp } from '../../core/gamification/economy';
import { logEvent } from '../../core/telemetry';

type CalcXpInput = {
  gameId: GameId;
  difficulty?: Difficulty;
  won?: boolean;
  score?: number;
  durationMs?: number;
  isDaily?: boolean;
};

type GrantXpInput = CalcXpInput & {
  mode?: 'normal' | 'daily';
  rewardMultiplier?: number;
};

type GrantFlatXpInput = {
  gameId: GameId;
  amount: number;
  source?: 'manual' | 'session_streak_bonus';
};

export function calcXp({ difficulty = 'principiante', score = 0, isDaily = false }: CalcXpInput): number {
  return computeXp({
    score: Math.max(0, Math.min(100, Math.floor(score))),
    difficulty,
    isDaily,
  });
}

export async function grantXp(input: GrantXpInput) {
  const mode = input.mode ?? 'normal';
  const rewardMultiplier = Math.max(0, Math.min(1, input.rewardMultiplier ?? 1));
  const baseXp = calcXp({
    ...input,
    isDaily: mode === 'daily',
  });
  const profile = await getProfile();
  const earnedXp = Math.max(0, Math.round(baseXp * rewardMultiplier));
  const xpTotal = profile.xpTotal + earnedXp;
  const xpWeekly = profile.xpWeekly + earnedXp;
  const level = getLevelByXp(xpTotal);

  if (__DEV__) {
    console.log('[XP]', {
      gameId: input.gameId,
      mode,
      difficulty: input.difficulty,
      baseXp,
      rewardMultiplier,
      earnedXp,
    });
  }

  logEvent('xp_granted', { gameId: input.gameId, mode, difficulty: input.difficulty, baseXp, rewardMultiplier, earnedXp });

  const updated = await updateProfile({ xpTotal, xpWeekly, levelId: level.id });
  return { earnedXp, profile: updated, level };
}

export async function grantFlatXp({ gameId, amount, source = 'manual' }: GrantFlatXpInput) {
  const profile = await getProfile();
  const earnedXp = Math.max(0, Math.floor(amount));
  const xpTotal = profile.xpTotal + earnedXp;
  const xpWeekly = profile.xpWeekly + earnedXp;
  const level = getLevelByXp(xpTotal);

  logEvent('xp_granted_flat', { gameId, source, earnedXp });

  const updated = await updateProfile({ xpTotal, xpWeekly, levelId: level.id });
  return { earnedXp, profile: updated, level };
}