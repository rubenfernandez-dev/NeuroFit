import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DailyStage } from '../storage/daily';
import { GAME_CATEGORIES, getCategoryColors } from '../theme/categoryColors';
import { useAppTheme } from '../theme/theme';
import { formatDurationMsToSeconds } from '../utils/dateFormatter';
import Card from './Card';
import DifficultyBadge from './DifficultyBadge';
import Pill from './Pill';

type DailyChallengeStageCardProps = {
  stage: DailyStage;
  index: number;
  title: string;
  isCurrent: boolean;
};

export default function DailyChallengeStageCard({
  stage,
  index,
  title,
  isCurrent,
}: DailyChallengeStageCardProps) {
  const { theme } = useAppTheme();
  const colors = getCategoryColors(theme.mode);
  const category = GAME_CATEGORIES[stage.gameId];
  const accent = colors[category] ?? theme.colors.primary;
  const isPending = !stage.completed && !isCurrent;

  return (
    <Card
      style={{
        ...styles.card,
        borderLeftColor: accent,
        borderColor: isPending ? theme.colors.orange : theme.colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[theme.typography.body, { color: theme.colors.text }]}>Etapa {index + 1}: {title}</Text>
        <DifficultyBadge difficulty={stage.difficulty} compact />
      </View>

      <View style={{ marginTop: 8 }}>
        <Pill
          label={stage.completed ? '✅ Completado' : isCurrent ? '▶ Actual' : '⏳ Pendiente'}
          tone={stage.completed ? 'success' : isCurrent ? 'cyan' : 'warning'}
        />
      </View>

      {stage.result ? (
        <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <View style={[styles.metric, { borderColor: theme.colors.border, backgroundColor: theme.colors.bg0 }]}>
            <Text style={[styles.metricText, { color: theme.colors.text }]}>Puntuacion {stage.result.score ?? '-'}</Text>
          </View>
          <View style={[styles.metric, { borderColor: theme.colors.border, backgroundColor: theme.colors.bg0 }]}>
            <Text style={[styles.metricText, { color: theme.colors.text }]}>Tiempo {formatDurationMsToSeconds(stage.result.durationMs)}</Text>
          </View>
          <View style={[styles.metric, { borderColor: theme.colors.border, backgroundColor: theme.colors.bg0 }]}>
            <Text style={[styles.metricText, { color: theme.colors.text }]}>Fallos {stage.result.mistakes ?? '-'}</Text>
          </View>
        </View>
      ) : null}

      {isPending ? (
        <Text style={[theme.typography.caption, { color: theme.colors.orange, marginTop: 8 }]}>Pendiente: completa la etapa actual para desbloquearla</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderLeftWidth: 4,
    borderRadius: 16,
  },
  metric: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metricText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
