import { Difficulty, GameId } from '../../games/types';
import { getLevelByXp } from './levels';
import { getProfile, updateProfile } from '../storage/profile';
import { computeXp } from '../../core/gamification/economy';

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
  const baseXp = calcXp({
    ...input,
    isDaily: mode === 'daily',
  });
  const profile = await getProfile();
  const earnedXp = baseXp;
  const xpTotal = profile.xpTotal + earnedXp;
  const level = getLevelByXp(xpTotal);

  if (__DEV__) {
    console.log('[XP]', {
      gameId: input.gameId,
      mode,
      difficulty: input.difficulty,
      baseXp,
      earnedXp,
    });
  }

  const updated = await updateProfile({ xpTotal, levelId: level.id });
  return { earnedXp, profile: updated, level };
}