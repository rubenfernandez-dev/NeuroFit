import { Difficulty, GameId } from '../../games/types';
import { updateNeuroAfterGame } from '../../core/gamification/neuroscore';
import { logEvent } from '../../core/telemetry';
import { claimDailyReward, completeDailyStage, getDailyProgress } from '../storage/daily';
import { grantFlatXp, grantXp } from './xp';
import { grantFlatSeasonPoints, grantSeasonPoints } from './seasonPoints';
import {
  getSessionStreak,
  incrementSessionStreak,
  markSessionBonusGranted,
  resetSessionStreak,
  SESSION_STREAK_BONUS_SP,
  SESSION_STREAK_BONUS_XP,
  shouldGrantSessionBonus,
} from '../session/sessionStreak';
import { RewardChestGrant, progressRewardChest } from './rewardChest';
import { trackGameFinished, trackStreakBonus } from '../../services/analytics';

export type SessionMode = 'normal' | 'daily';

export type SessionMetrics = {
  durationMs?: number;
  mistakes?: number;
  score?: number;
};

export type SessionStreakPolicy = 'increment' | 'keep' | 'reset';

export type DailyCompletionData = {
  kind: 'stage' | 'final';
  stageIndex: number;
  earnedXp: number;
  earnedSp: number;
  result?: {
    durationMs?: number;
    mistakes?: number;
    score?: number;
  };
  progress: {
    completedStages: number;
    totalStages: number;
  };
};

export type CompleteGameSessionInput = {
  gameId: GameId;
  difficulty: Difficulty;
  mode: SessionMode;
  won: boolean;
  metrics: SessionMetrics;
  rewardMultiplier?: number;
  streakPolicy?: SessionStreakPolicy;
  stageIndex?: number;
  // Some games intentionally use a different score signal for NeuroScore updates.
  neuroScoreOverride?: number;
};

export type CompleteGameSessionResult = {
  earnedXp: number;
  earnedSp: number;
  rewardChest?: RewardChestGrant;
  sessionStreak: number;
  streakBonus: {
    granted: boolean;
    xp: number;
    sp: number;
    milestone?: number;
  };
  dailyCompletion?: DailyCompletionData;
};

const dailyCompletionInFlight = new Map<string, Promise<CompleteGameSessionResult>>();

function getDailyCompletionKey(input: CompleteGameSessionInput): string {
  const stageKey = typeof input.stageIndex === 'number' ? Math.max(0, Math.min(2, Math.floor(input.stageIndex))) : 'current';
  return `${input.gameId}:${stageKey}:${input.difficulty}`;
}

async function completeDailyGameSession(input: CompleteGameSessionInput): Promise<CompleteGameSessionResult> {
  const {
    gameId,
    difficulty,
    won,
    metrics,
    stageIndex,
    neuroScoreOverride,
  } = input;

  const rewardScore = typeof metrics.score === 'number' ? metrics.score : 0;
  const neuroScore = typeof neuroScoreOverride === 'number' ? neuroScoreOverride : rewardScore;

  const stageResult = await completeDailyStage({
    stageIndex,
    gameId,
    difficulty,
    result: {
      durationMs: metrics.durationMs,
      mistakes: metrics.mistakes,
      score: rewardScore,
    },
  });

  if (stageResult.stageCompletedNow) {
    await updateNeuroAfterGame({
      gameId,
      difficulty,
      won,
      durationMs: metrics.durationMs,
      score: neuroScore,
      mistakes: metrics.mistakes,
      mode: 'daily',
    });
  }

  let earnedXp = 0;
  let earnedSp = 0;

  if (stageResult.circuitCompletedNow) {
    const { alreadyClaimed } = await claimDailyReward();
    if (!alreadyClaimed) {
      const xpResult = await grantXp({
        gameId,
        difficulty,
        won,
        durationMs: metrics.durationMs,
        score: rewardScore,
        mode: 'daily',
      });
      earnedXp = xpResult.earnedXp;

      const spResult = await grantSeasonPoints({
        gameId,
        difficulty,
        score: rewardScore,
        mistakes: metrics.mistakes,
        durationMs: metrics.durationMs,
        isDaily: true,
        dailyCompletedAndClaimable: true,
      });
      earnedSp = spResult.earnedSeasonPoints;
    }
  }

  const completedStageIndex =
    typeof stageIndex === 'number' ? stageIndex : Math.max(0, stageResult.daily.currentStageIndex - 1);
  const savedResult = stageResult.daily.stages[completedStageIndex]?.result;

  const dailyCompletion: DailyCompletionData = {
    kind: stageResult.circuitCompletedNow ? 'final' : 'stage',
    stageIndex: completedStageIndex,
    earnedXp,
    earnedSp,
    result: savedResult,
    progress: getDailyProgress(stageResult.daily),
  };

  logEvent('game_session_completed', {
    gameId,
    difficulty,
    mode: 'daily',
    won,
    earnedXp,
    earnedSp,
    stageIndex: completedStageIndex,
    circuitCompleted: stageResult.circuitCompletedNow,
  });

  return {
    earnedXp,
    earnedSp,
    rewardChest: undefined,
    dailyCompletion,
    sessionStreak: getSessionStreak(),
    streakBonus: {
      granted: false,
      xp: 0,
      sp: 0,
    },
  };
}

export async function completeGameSession(input: CompleteGameSessionInput): Promise<CompleteGameSessionResult> {
  const {
    gameId,
    difficulty,
    mode,
    won,
    metrics,
    rewardMultiplier,
    streakPolicy,
    stageIndex,
    neuroScoreOverride,
  } = input;

  const rewardScore = typeof metrics.score === 'number' ? metrics.score : 0;
  const neuroScore = typeof neuroScoreOverride === 'number' ? neuroScoreOverride : rewardScore;

  if (mode === 'daily') {
    const key = getDailyCompletionKey(input);
    const inFlight = dailyCompletionInFlight.get(key);
    if (inFlight) {
      return inFlight;
    }

    const completionPromise = (async () => {
      const result = await completeDailyGameSession(input);
      const rewardChest = await progressRewardChest(gameId);
      const finalResult = !rewardChest
        ? result
        : {
            ...result,
            earnedXp: result.earnedXp + (rewardChest.rewardType === 'xp' ? rewardChest.amount : 0),
            earnedSp: result.earnedSp + (rewardChest.rewardType === 'neurocoins' ? rewardChest.amount : 0),
            rewardChest,
          };

      void trackGameFinished({
        gameId,
        difficulty,
        mode,
        won,
        durationMs: metrics.durationMs,
        mistakes: metrics.mistakes,
        score: rewardScore,
        earnedXp: finalResult.earnedXp,
        earnedNeuroCoins: finalResult.earnedSp,
        sessionStreak: finalResult.sessionStreak,
      });

      return finalResult;
    })().finally(() => {
      dailyCompletionInFlight.delete(key);
    });

    dailyCompletionInFlight.set(key, completionPromise);
    return completionPromise;
  }

  const safeRewardMultiplier = Math.max(0, Math.min(1, rewardMultiplier ?? (won ? 1 : 0.5)));
  const resolvedStreakPolicy: SessionStreakPolicy = streakPolicy ?? (won ? 'increment' : 'keep');

  await updateNeuroAfterGame({
    gameId,
    difficulty,
    won,
    durationMs: metrics.durationMs,
    score: neuroScore,
    mistakes: metrics.mistakes,
    mode: 'normal',
  });

  const xpResult = await grantXp({
    gameId,
    difficulty,
    won,
    durationMs: metrics.durationMs,
    score: rewardScore,
    mode: 'normal',
    rewardMultiplier: safeRewardMultiplier,
  });
  const earnedXp = xpResult.earnedXp;

  const spResult = await grantSeasonPoints({
    gameId,
    difficulty,
    score: rewardScore,
    mistakes: metrics.mistakes,
    durationMs: metrics.durationMs,
    isDaily: false,
    rewardMultiplier: safeRewardMultiplier,
  });
  let earnedSp = spResult.earnedSeasonPoints;

  let sessionStreak = getSessionStreak();
  if (resolvedStreakPolicy === 'increment') {
    sessionStreak = incrementSessionStreak();
  } else if (resolvedStreakPolicy === 'reset') {
    sessionStreak = resetSessionStreak();
  }

  let streakBonus = {
    granted: false,
    xp: 0,
    sp: 0,
    milestone: undefined as number | undefined,
  };

  if (resolvedStreakPolicy === 'increment' && shouldGrantSessionBonus(sessionStreak)) {
    await grantFlatXp({ gameId, amount: SESSION_STREAK_BONUS_XP, source: 'session_streak_bonus' });
    await grantFlatSeasonPoints({ gameId, difficulty, amount: SESSION_STREAK_BONUS_SP, source: 'session_streak_bonus' });
    markSessionBonusGranted(sessionStreak);

    earnedSp += SESSION_STREAK_BONUS_SP;
    const earnedXpWithBonus = earnedXp + SESSION_STREAK_BONUS_XP;
    streakBonus = {
      granted: true,
      xp: SESSION_STREAK_BONUS_XP,
      sp: SESSION_STREAK_BONUS_SP,
      milestone: sessionStreak,
    };

    logEvent('session_streak_bonus_granted', {
      gameId,
      difficulty,
      mode,
      sessionStreak,
      bonusXp: SESSION_STREAK_BONUS_XP,
      bonusSp: SESSION_STREAK_BONUS_SP,
    });
    void trackStreakBonus({
      gameId,
      difficulty,
      mode,
      sessionStreak,
      bonusXp: SESSION_STREAK_BONUS_XP,
      bonusNeuroCoins: SESSION_STREAK_BONUS_SP,
    });

    const rewardChest = await progressRewardChest(gameId);
    const totalEarnedXp = earnedXpWithBonus + (rewardChest?.rewardType === 'xp' ? rewardChest.amount : 0);
    const totalEarnedSp = earnedSp + (rewardChest?.rewardType === 'neurocoins' ? rewardChest.amount : 0);

    logEvent('game_session_completed', {
      gameId,
      difficulty,
      mode,
      won,
      rewardMultiplier: safeRewardMultiplier,
      streakPolicy: resolvedStreakPolicy,
      earnedXp: totalEarnedXp,
      earnedSp: totalEarnedSp,
      sessionStreak,
      streakBonusGranted: true,
    });
    void trackGameFinished({
      gameId,
      difficulty,
      mode,
      won,
      durationMs: metrics.durationMs,
      mistakes: metrics.mistakes,
      score: rewardScore,
      earnedXp: totalEarnedXp,
      earnedNeuroCoins: totalEarnedSp,
      sessionStreak,
    });
    return { earnedXp: totalEarnedXp, earnedSp: totalEarnedSp, rewardChest, sessionStreak, streakBonus };
  }

  const rewardChest = await progressRewardChest(gameId);
  const totalEarnedXp = earnedXp + (rewardChest?.rewardType === 'xp' ? rewardChest.amount : 0);
  const totalEarnedSp = earnedSp + (rewardChest?.rewardType === 'neurocoins' ? rewardChest.amount : 0);

  logEvent('game_session_completed', {
    gameId,
    difficulty,
    mode,
    won,
    rewardMultiplier: safeRewardMultiplier,
    streakPolicy: resolvedStreakPolicy,
    earnedXp: totalEarnedXp,
    earnedSp: totalEarnedSp,
    sessionStreak,
    streakBonusGranted: false,
  });
  void trackGameFinished({
    gameId,
    difficulty,
    mode,
    won,
    durationMs: metrics.durationMs,
    mistakes: metrics.mistakes,
    score: rewardScore,
    earnedXp: totalEarnedXp,
    earnedNeuroCoins: totalEarnedSp,
    sessionStreak,
  });
  return { earnedXp: totalEarnedXp, earnedSp: totalEarnedSp, rewardChest, sessionStreak, streakBonus };
}