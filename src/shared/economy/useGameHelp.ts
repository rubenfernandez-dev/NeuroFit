import { useCallback, useState } from 'react';
import { NeuroCoinReason, SpendResult, spendNeuroCoins } from './neuroCoinService';
import { useNeuroCoinFeedback } from './useNeuroCoinFeedback';

type HelpAvailability = boolean | (() => boolean);

export type GameHelpEffectContext = {
  cost: number;
  newBalance: number;
  spendResult: SpendResult;
  uses: number;
};

type UseGameHelpParams = {
  helpId: NeuroCoinReason;
  cost: number;
  maxUses: number;
  performEffect: (context: GameHelpEffectContext) => void | Promise<void>;
  isAvailable?: HelpAvailability;
  insufficientFundsMessage?: string;
};

function resolveAvailability(isAvailable?: HelpAvailability) {
  if (typeof isAvailable === 'function') {
    return isAvailable();
  }

  return isAvailable ?? true;
}

export default function useGameHelp({
  helpId,
  cost,
  maxUses,
  performEffect,
  isAvailable,
  insufficientFundsMessage = 'No tienes suficientes NeuroCoins',
}: UseGameHelpParams) {
  const [uses, setUses] = useState(0);
  const {
    message,
    clearFeedback,
    showNeuroCoinError,
    showNeuroCoinSpendFeedback,
  } = useNeuroCoinFeedback();

  const resetHelp = useCallback(() => {
    setUses(0);
    clearFeedback();
  }, [clearFeedback]);

  const executeHelp = useCallback(async () => {
    if (!resolveAvailability(isAvailable) || uses >= maxUses) {
      return false;
    }

    const spendResult = await spendNeuroCoins(cost, helpId);
    if (!spendResult.success) {
      showNeuroCoinError(insufficientFundsMessage);
      return false;
    }

    const nextUses = uses + 1;
    setUses(nextUses);
    showNeuroCoinSpendFeedback(cost);
    await performEffect({
      cost,
      newBalance: spendResult.newBalance,
      spendResult,
      uses: nextUses,
    });
    return true;
  }, [cost, helpId, insufficientFundsMessage, isAvailable, maxUses, performEffect, showNeuroCoinError, showNeuroCoinSpendFeedback, uses]);

  const usesLeft = Math.max(0, maxUses - uses);

  return {
    message,
    uses,
    usesLeft,
    canUse: resolveAvailability(isAvailable) && usesLeft > 0,
    clearFeedback,
    resetHelp,
    executeHelp,
  };
}