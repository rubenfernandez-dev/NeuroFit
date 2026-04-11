function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export type MemoryRoundScoreState = {
  score: number;
  streak: number;
  bestStreak: number;
  matches: number;
  mismatches: number;
  attempts: number;
};

export function createMemoryRoundScoreState(): MemoryRoundScoreState {
  return {
    score: 0,
    streak: 0,
    bestStreak: 0,
    matches: 0,
    mismatches: 0,
    attempts: 0,
  };
}

export function applyMemoryAttempt(state: MemoryRoundScoreState, wasMatch: boolean): MemoryRoundScoreState {
  const attempts = state.attempts + 1;

  if (wasMatch) {
    const nextStreak = state.streak + 1;
    const streakBonus = nextStreak > 1 ? Math.min(12, (nextStreak - 1) * 2) : 0;
    return {
      score: state.score + 12 + streakBonus,
      streak: nextStreak,
      bestStreak: Math.max(state.bestStreak, nextStreak),
      matches: state.matches + 1,
      mismatches: state.mismatches,
      attempts,
    };
  }

  return {
    score: Math.max(0, state.score - 7),
    streak: 0,
    bestStreak: state.bestStreak,
    matches: state.matches,
    mismatches: state.mismatches + 1,
    attempts,
  };
}

export function computeMemoryRewardScore(input: {
  totalPairs: number;
  attempts: number;
  matches: number;
  bestStreak: number;
  rawScore: number;
}): number {
  const safePairs = Math.max(1, input.totalPairs);
  const safeAttempts = Math.max(1, input.attempts);

  const completionFactor = clamp((input.matches / safePairs) * 100, 0, 100);
  const efficiencyFactor = clamp((input.matches / safeAttempts) * 100, 0, 100);
  const streakTarget = Math.max(3, Math.floor(safePairs * 0.45));
  const streakFactor = clamp((input.bestStreak / streakTarget) * 100, 0, 100);
  const rawScoreFactor = clamp((input.rawScore / (safePairs * 20)) * 100, 0, 100);

  const weighted =
    completionFactor * 0.35 +
    efficiencyFactor * 0.3 +
    streakFactor * 0.2 +
    rawScoreFactor * 0.15;

  return clamp(Math.round(weighted), 0, 100);
}
