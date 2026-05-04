import { Difficulty, GameId } from '../games/types';

type AnalyticsParamValue = string | number | boolean | null | undefined;
type AnalyticsParams = Record<string, AnalyticsParamValue>;

type GameStartedParams = {
  gameId: GameId;
  mode?: 'normal' | 'daily';
};

type GameFinishedParams = {
  gameId: GameId;
  difficulty?: Difficulty;
  mode?: 'normal' | 'daily';
  won: boolean;
  durationMs?: number;
  mistakes?: number;
  score?: number;
  earnedXp?: number;
  earnedNeuroCoins?: number;
  sessionStreak?: number;
};

type NeuroCoinsEarnedParams = {
  amount: number;
  balance?: number;
  reason?: string;
  gameId?: GameId;
  difficulty?: Difficulty;
  source?: string;
};

type NeuroCoinsSpentParams = {
  amount: number;
  previousBalance?: number;
  newBalance?: number;
  reason?: string;
};

type HelpUsedParams = {
  helpId: string;
  cost?: number;
  gameId?: GameId;
};

type RewardChestOpenedParams = {
  gameId: GameId;
  rewardType: 'neurocoins' | 'xp';
  amount: number;
  cycleGames: number;
};

type StreakBonusParams = {
  gameId: GameId;
  difficulty: Difficulty;
  mode: 'normal' | 'daily';
  sessionStreak: number;
  bonusXp: number;
  bonusNeuroCoins: number;
};

function isDevRuntime(): boolean {
  if (typeof __DEV__ !== 'undefined') {
    return __DEV__;
  }

  return process.env.NODE_ENV === 'development';
}

function shouldSendAnalytics(): boolean {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return false;
  }

  return !isDevRuntime();
}

function devLog(message: string, payload?: unknown): void {
  if (!isDevRuntime()) return;
  console.log('[analytics]', message, payload ?? '');
}

function getAnalyticsInstance(): { logEvent: (name: string, params?: Record<string, string | number>) => Promise<void> } | null {
  if (!shouldSendAnalytics()) {
    return null;
  }

  try {
    const appModule = require('@react-native-firebase/app').default;
    if (typeof appModule === 'function') {
      appModule();
    }

    const analyticsModule = require('@react-native-firebase/analytics').default;
    if (typeof analyticsModule !== 'function') {
      return null;
    }

    return analyticsModule();
  } catch (error) {
    devLog('firebase analytics unavailable', error);
    return null;
  }
}

function sanitizeParams(params?: AnalyticsParams): Record<string, string | number> | undefined {
  if (!params) return undefined;

  const sanitizedEntries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => {
      if (typeof value === 'boolean') {
        return [key, value ? 1 : 0] as const;
      }

      if (typeof value === 'number') {
        return [key, Number.isFinite(value) ? value : 0] as const;
      }

      return [key, String(value).slice(0, 100)] as const;
    });

  if (sanitizedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(sanitizedEntries);
}

export async function trackEvent(name: string, params?: AnalyticsParams): Promise<void> {
  try {
    const analytics = getAnalyticsInstance();
    if (!analytics) {
      devLog(`skip ${name}`, params);
      return;
    }

    await analytics.logEvent(name, sanitizeParams(params));
  } catch (error) {
    devLog(`failed ${name}`, error);
  }
}

export async function trackGameStarted({ gameId, mode = 'normal' }: GameStartedParams): Promise<void> {
  await trackEvent('game_started', {
    game_id: gameId,
    mode,
  });
}

export async function trackGameFinished({
  gameId,
  difficulty,
  mode = 'normal',
  won,
  durationMs,
  mistakes,
  score,
  earnedXp,
  earnedNeuroCoins,
  sessionStreak,
}: GameFinishedParams): Promise<void> {
  await trackEvent('game_finished', {
    game_id: gameId,
    difficulty,
    mode,
    won,
    duration_ms: durationMs,
    mistakes,
    score,
    earned_xp: earnedXp,
    earned_neurocoins: earnedNeuroCoins,
    session_streak: sessionStreak,
  });
}

export async function trackNeuroCoinsEarned({ amount, balance, reason, gameId, difficulty, source }: NeuroCoinsEarnedParams): Promise<void> {
  if (amount <= 0) return;

  await trackEvent('neurocoins_earned', {
    amount,
    balance,
    reason,
    game_id: gameId,
    difficulty,
    source,
  });
}

export async function trackNeuroCoinsSpent({ amount, previousBalance, newBalance, reason }: NeuroCoinsSpentParams): Promise<void> {
  if (amount <= 0) return;

  await trackEvent('neurocoins_spent', {
    amount,
    previous_balance: previousBalance,
    new_balance: newBalance,
    reason,
  });
}

export async function trackHelpUsed({ helpId, cost, gameId }: HelpUsedParams): Promise<void> {
  await trackEvent('help_used', {
    help_id: helpId,
    cost,
    game_id: gameId,
  });
}

export async function trackRewardChestOpened({ gameId, rewardType, amount, cycleGames }: RewardChestOpenedParams): Promise<void> {
  await trackEvent('reward_chest_opened', {
    game_id: gameId,
    reward_type: rewardType,
    amount,
    cycle_games: cycleGames,
  });
}

export async function trackStreakBonus({ gameId, difficulty, mode, sessionStreak, bonusXp, bonusNeuroCoins }: StreakBonusParams): Promise<void> {
  await trackEvent('streak_bonus', {
    game_id: gameId,
    difficulty,
    mode,
    session_streak: sessionStreak,
    bonus_xp: bonusXp,
    bonus_neurocoins: bonusNeuroCoins,
  });
}