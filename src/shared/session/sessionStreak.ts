export const SESSION_STREAK_BONUS_XP = 10;
export const SESSION_STREAK_BONUS_SP = 5;
export const SESSION_STREAK_MILESTONE = 3;

let sessionStreak = 0;
const grantedMilestones = new Set<number>();

export function getSessionStreak(): number {
  return sessionStreak;
}

export function incrementSessionStreak(): number {
  sessionStreak += 1;
  return sessionStreak;
}

export function resetSessionStreak(): number {
  sessionStreak = 0;
  grantedMilestones.clear();
  return sessionStreak;
}

export function shouldGrantSessionBonus(streak: number = sessionStreak): boolean {
  if (streak <= 0) return false;
  if (streak % SESSION_STREAK_MILESTONE !== 0) return false;
  return !grantedMilestones.has(streak);
}

export function markSessionBonusGranted(streak: number = sessionStreak): void {
  if (streak <= 0) return;
  grantedMilestones.add(streak);
}
