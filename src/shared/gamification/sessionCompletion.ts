import { Difficulty, GameId } from '../../games/types';
import { updateNeuroAfterGame } from '../../core/gamification/neuroscore';
import { claimDailyReward, completeDailyStage, getDailyProgress } from '../storage/daily';
import { getProfile } from '../storage/profile';
import { grantXp } from './xp';
import { grantSeasonPoints } from './seasonPoints';

export type SessionMode = 'normal' | 'daily';

export type SessionMetrics = {
  durationMs?: number;
  mistakes?: number;
  score?: number;
};

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
  stageIndex?: number;
  // Some games intentionally use a different score signal for NeuroScore updates.
  neuroScoreOverride?: number;
};

export type CompleteGameSessionResult = {
  earnedXp: number;
  earnedSp: number;
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

  return {
    earnedXp,
    earnedSp,
    dailyCompletion: {
      kind: stageResult.circuitCompletedNow ? 'final' : 'stage',
      stageIndex: completedStageIndex,
      earnedXp,
      earnedSp,
      result: savedResult,
      progress: getDailyProgress(stageResult.daily),
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

    const completionPromise = completeDailyGameSession(input).finally(() => {
      dailyCompletionInFlight.delete(key);
    });
    dailyCompletionInFlight.set(key, completionPromise);
    return completionPromise;
  }

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
  });
  const earnedXp = xpResult.earnedXp;

  const spResult = await grantSeasonPoints({
    gameId,
    difficulty,
    score: rewardScore,
    mistakes: metrics.mistakes,
    durationMs: metrics.durationMs,
    isDaily: false,
  });
  const earnedSp = spResult.earnedSeasonPoints;

  return { earnedXp, earnedSp };
}