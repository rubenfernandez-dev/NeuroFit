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

const difficultyBonus: Record<Difficulty, number> = {
  easy: 0,
  medium: 20,
  hard: 40,
  expert: 70,
};

export function calcXp({ difficulty = 'easy', won, score = 0, durationMs }: CalcXpInput): number {
  const base = 50;
  const winBonus = won ? 30 : 0;
  const performanceBonus = Math.min(40, Math.max(0, Math.floor(score / 2)));

  let speedBonus = 0;
  if (typeof durationMs === 'number') {
    if (durationMs < 60000) speedBonus = 30;
    else if (durationMs < 120000) speedBonus = 20;
    else if (durationMs < 240000) speedBonus = 10;
  }

  return base + difficultyBonus[difficulty] + winBonus + performanceBonus + speedBonus;
}

export async function grantXp(input: CalcXpInput) {
  const earnedXp = calcXp(input);
  const profile = await getProfile();
  const xpTotal = profile.xpTotal + earnedXp;
  const level = getLevelByXp(xpTotal);
  const updated = await updateProfile({ xpTotal, levelId: level.id });
  return { earnedXp, profile: updated, level };
}