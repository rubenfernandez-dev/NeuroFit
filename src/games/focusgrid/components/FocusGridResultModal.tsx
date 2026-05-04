import React from 'react';
import { msToClock } from '../../../shared/utils/time';
import GameResultModal from '../../../shared/feedback/GameResultModal';
import { FocusGridGameResult } from '../types';
import { formatNeuroCoinRewardCompact } from '../../../shared/economy/neuroCoins';
import { RewardChestGrant } from '../../../shared/gamification/rewardChest';

type ResultSummary = {
  elapsedMs: number;
  score: number;
  mistakes: number;
  accuracy: number;
  completionTimeMs: number;
  won: boolean;
  xpGained: number;
  spGained: number;
  performance: number;
  gameResult: FocusGridGameResult;
  sessionStreak: number;
  streakBonusTitle?: string;
  streakBonusLabel?: string;
  rewardChest?: RewardChestGrant;
};

type Props = {
  visible: boolean;
  resultSummary: ResultSummary | null;
  onClose: () => void;
  onNextChallenge: () => void;
  onRestart: () => void;
  onViewLeaderboard: () => void;
  onExit?: () => void;
};

export default function FocusGridResultModal({
  visible,
  resultSummary,
  onClose,
  onNextChallenge,
  onRestart,
  onViewLeaderboard,
  onExit,
}: Props) {
  return (
    <GameResultModal
      visible={visible}
      onRequestClose={onClose}
      variant={resultSummary?.won ? 'victory' : 'defeat'}
      title={resultSummary?.won ? '¡Objetivo completado!' : 'Sesión finalizada'}
      subtitle={resultSummary?.won ? 'Buen ritmo y precisión en Focus Grid.' : 'No pasa nada, vuelve con un mejor ritmo.'}
      metrics={[
        { label: 'Score', value: resultSummary?.score ?? 0 },
        { label: 'Precisión', value: `${resultSummary?.accuracy ?? 0}%` },
        { label: 'Fallos', value: resultSummary?.mistakes ?? 0 },
        { label: 'Tiempo completado', value: msToClock(resultSummary?.completionTimeMs ?? 0) },
        { label: 'Duración', value: msToClock(resultSummary?.elapsedMs ?? 0) },
        { label: 'XP', value: `+${resultSummary?.xpGained ?? 0}` },
        { label: 'NC 🪙', value: formatNeuroCoinRewardCompact(resultSummary?.spGained ?? 0) },
      ]}
      sessionStreak={resultSummary?.sessionStreak ?? 0}
      streakBonusTitle={resultSummary?.streakBonusTitle}
      streakBonusText={resultSummary?.streakBonusLabel}
      rewardChest={resultSummary?.rewardChest}
      primaryAction={{ label: 'Siguiente reto', onPress: onNextChallenge }}
      secondaryAction={{ label: 'Jugar de nuevo', onPress: onRestart, variant: 'secondary' }}
      auxiliaryActions={[
        { label: 'Ver ranking local', onPress: onViewLeaderboard, variant: 'ghost' },
        ...(onExit ? [{ label: 'Salir', onPress: onExit, variant: 'ghost' as const }] : []),
      ]}
    />
  );
}