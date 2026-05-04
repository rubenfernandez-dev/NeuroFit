import { logEvent } from '../../core/telemetry';
import { getProfile, updateProfile } from '../storage/profile';
import { toSafeNeuroCoinAmount } from './neuroCoins';
import { trackHelpUsed, trackNeuroCoinsEarned, trackNeuroCoinsSpent } from '../../services/analytics';

export type NeuroCoinReason =
  | 'focus_grid_reveal_next'
  | 'speed_match_extra_time'
  | 'memory_reveal_cards'
  | 'pattern_memory_repeat_sequence'
  | 'number_match_suggest_move'
  | 'mental_math_extra_time'
  | 'mental_math_skip_question'
  | 'sudoku_recover_mistake'
  | 'reward_manual'
  | 'reward_gameplay'
  | 'unknown';

export type SpendError = 'INSUFFICIENT_FUNDS' | 'UNKNOWN';

export type SpendResult = {
  success: boolean;
  newBalance: number;
  reason?: string;
  error?: SpendError;
};

const HELP_REASONS = new Set<NeuroCoinReason>([
  'focus_grid_reveal_next',
  'speed_match_extra_time',
  'memory_reveal_cards',
  'pattern_memory_repeat_sequence',
  'number_match_suggest_move',
  'mental_math_extra_time',
  'mental_math_skip_question',
  'sudoku_recover_mistake',
]);

export async function getCurrentNeuroCoins(): Promise<number> {
  try {
    const profile = await getProfile();
    return toSafeNeuroCoinAmount(profile.seasonPoints);
  } catch {
    return 0;
  }
}

export async function getNeuroCoinBalance(): Promise<number> {
  return getCurrentNeuroCoins();
}

export async function canSpendNeuroCoins(cost: number): Promise<boolean> {
  const safeCost = toSafeNeuroCoinAmount(cost);
  const balance = await getCurrentNeuroCoins();
  return balance >= safeCost;
}

export async function spendNeuroCoins(cost: number, reason: NeuroCoinReason = 'unknown'): Promise<SpendResult> {
  try {
    const safeCost = toSafeNeuroCoinAmount(cost);
    const profile = await getProfile();
    const currentBalance = toSafeNeuroCoinAmount(profile.seasonPoints);

    if (safeCost <= 0) {
      return {
        success: true,
        newBalance: currentBalance,
        reason,
      };
    }

    if (currentBalance < safeCost) {
      logEvent('neuro_coin_spend_rejected', {
        reason,
        cost: safeCost,
        currentBalance,
        error: 'INSUFFICIENT_FUNDS',
      });
      return {
        success: false,
        newBalance: currentBalance,
        reason,
        error: 'INSUFFICIENT_FUNDS',
      };
    }

    const nextBalance = Math.max(0, currentBalance - safeCost);
    const updated = await updateProfile({ seasonPoints: nextBalance });
    const finalBalance = toSafeNeuroCoinAmount(updated.seasonPoints);

    logEvent('neuro_coin_spent', {
      reason,
      cost: safeCost,
      previousBalance: currentBalance,
      newBalance: finalBalance,
    });
    void trackNeuroCoinsSpent({
      amount: safeCost,
      previousBalance: currentBalance,
      newBalance: finalBalance,
      reason,
    });
    if (HELP_REASONS.has(reason)) {
      void trackHelpUsed({
        helpId: reason,
        cost: safeCost,
      });
    }

    return {
      success: true,
      newBalance: finalBalance,
      reason,
    };
  } catch {
    return {
      success: false,
      newBalance: await getCurrentNeuroCoins(),
      reason,
      error: 'UNKNOWN',
    };
  }
}

export async function addNeuroCoins(amount: number, reason: NeuroCoinReason = 'reward_manual'): Promise<number> {
  const safeAmount = toSafeNeuroCoinAmount(amount);
  if (safeAmount <= 0) {
    return getCurrentNeuroCoins();
  }

  try {
    const profile = await getProfile();
    const currentBalance = toSafeNeuroCoinAmount(profile.seasonPoints);
    const nextBalance = currentBalance + safeAmount;
    const updated = await updateProfile({ seasonPoints: nextBalance });
    const finalBalance = toSafeNeuroCoinAmount(updated.seasonPoints);

    logEvent('neuro_coin_added', {
      reason,
      amount: safeAmount,
      previousBalance: currentBalance,
      newBalance: finalBalance,
    });
    void trackNeuroCoinsEarned({
      amount: safeAmount,
      balance: finalBalance,
      reason,
      source: 'neuro_coin_service',
    });

    return finalBalance;
  } catch {
    return getCurrentNeuroCoins();
  }
}