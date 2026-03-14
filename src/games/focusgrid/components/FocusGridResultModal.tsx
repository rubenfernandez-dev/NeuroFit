import React from 'react';
import { msToClock } from '../../../shared/utils/time';
import GameResultModal from '../../../shared/feedback/GameResultModal';
import { FocusGridGameResult } from '../types';

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
};

type Props = {
  visible: boolean;
  resultSummary: ResultSummary | null;
  onClose: () => void;
  onRestart: () => void;
  onViewLeaderboard: () => void;
};

export default function FocusGridResultModal({
  visible,
  resultSummary,
  onClose,
  onRestart,
  onViewLeaderboard,
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
        { label: 'SP', value: `+${resultSummary?.spGained ?? 0}` },
      ]}
      primaryAction={{ label: 'Jugar de nuevo', onPress: onRestart }}
      secondaryAction={{ label: 'Ver ranking local', onPress: onViewLeaderboard, variant: 'secondary' }}
    />
  );
}