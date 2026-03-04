import { Difficulty, GameId } from '../../games/types';
import { getLevelByXp } from './levels';
import { getProfile, updateProfile } from '../storage/profile';

type CalcXpInput = {
  gameId: GameId;
  difficulty?: Difficulty;
  won?: boolean;
  score?: number;
  durationMs?: number;
};

type GrantXpInput = CalcXpInput & {
  mode?: 'normal' | 'daily';
  streakCurrent?: number;
};

const difficultyBonus: Record<Difficulty, number> = {
  principiante: 0,
  avanzado: 20,
  experto: 40,
  maestro: 65,
  gran_maestro: 90,
};

export function calcXp({ difficulty = 'principiante', won, score = 0, durationMs }: CalcXpInput): number {
  const base = 50;
  const winBonus = won ? 30 : 0;
  const normalizedScore = Math.max(0, Math.min(100, Math.floor(score)));
  const performanceBonus = Math.min(40, Math.max(0, Math.floor(normalizedScore / 2)));

  let speedBonus = 0;
  if (typeof durationMs === 'number') {
    if (durationMs < 60000) speedBonus = 30;
    else if (durationMs < 120000) speedBonus = 20;
    else if (durationMs < 240000) speedBonus = 10;
  }

  return base + difficultyBonus[difficulty] + winBonus + performanceBonus + speedBonus;
}

export function getStreakMultiplier(streakCurrent: number): number {
  if (streakCurrent >= 15) return 1.5;
  if (streakCurrent >= 8) return 1.25;
  if (streakCurrent >= 4) return 1.1;
  return 1.0;
}

export function calcDailyXp(baseXp: number, streakCurrent: number): number {
  return Math.round(baseXp * getStreakMultiplier(streakCurrent));
}

export async function grantXp(input: GrantXpInput) {
  const baseXp = calcXp(input);
  const profile = await getProfile();
  const mode = input.mode ?? 'normal';
  const streakCurrent = input.streakCurrent ?? profile.streakCurrent;
  const earnedXp = mode === 'daily' ? calcDailyXp(baseXp, streakCurrent) : baseXp;
  const xpTotal = profile.xpTotal + earnedXp;
  const level = getLevelByXp(xpTotal);

  if (__DEV__) {
    console.log('[XP]', {
      gameId: input.gameId,
      mode,
      difficulty: input.difficulty,
      baseXp,
      earnedXp,
      streakCurrent,
    });
  }

  const updated = await updateProfile({ xpTotal, levelId: level.id });
  return { earnedXp, profile: updated, level };
}