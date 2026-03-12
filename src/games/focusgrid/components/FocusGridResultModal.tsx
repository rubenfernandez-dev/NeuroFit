import React from 'react';
import { Modal, Text, View } from 'react-native';
import Button from '../../../shared/ui/Button';
import Card from '../../../shared/ui/Card';
import { AppTheme } from '../../../shared/theme/theme';
import { msToClock } from '../../../shared/utils/time';
import { FocusGridGameResult } from '../types';

type ResultSummary = {
  elapsedMs: number;
  score: number;
  mistakes: number;
  accuracy: number;
  completionTimeMs: number;
  xpGained: number;
  spGained: number;
  performance: number;
  gameResult: FocusGridGameResult;
};

type Props = {
  visible: boolean;
  resultSummary: ResultSummary | null;
  theme: AppTheme;
  onClose: () => void;
  onRestart: () => void;
  onViewLeaderboard: () => void;
};

export default function FocusGridResultModal({
  visible,
  resultSummary,
  theme,
  onClose,
  onRestart,
  onViewLeaderboard,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.lg }}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: theme.colors.background,
            opacity: 0.78,
          }}
        />
        <Card>
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Sesión finalizada</Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>Score: {resultSummary?.score ?? 0}</Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>Precisión: {resultSummary?.accuracy ?? 0}%</Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>Fallos: {resultSummary?.mistakes ?? 0}</Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
            Tiempo completado: {msToClock(resultSummary?.completionTimeMs ?? 0)}
          </Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>Duracion: {msToClock(resultSummary?.elapsedMs ?? 0)}</Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>XP: +{resultSummary?.xpGained ?? 0}</Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>SP: +{resultSummary?.spGained ?? 0}</Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <Button title="Jugar de nuevo" onPress={onRestart} style={{ flex: 1 }} />
            <Button title="Ver ranking" variant="secondary" onPress={onViewLeaderboard} style={{ flex: 1 }} />
          </View>
        </Card>
      </View>
    </Modal>
  );
}