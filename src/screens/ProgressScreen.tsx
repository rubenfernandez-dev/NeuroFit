import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllStats } from '../shared/storage/stats';
import { getProfile } from '../shared/storage/profile';
import { getLevelByXp, getNextLevel } from '../shared/gamification/levels';
import { enabledGames } from '../games/registry';
import Card from '../shared/ui/Card';
import StatRow from '../shared/ui/StatRow';
import { useAppTheme } from '../shared/theme/theme';

type Snapshot = {
  xpTotal: number;
  sessionsTotal: number;
  stats: Awaited<ReturnType<typeof getAllStats>>;
};

export default function ProgressScreen() {
  const { theme } = useAppTheme();
  const [snapshot, setSnapshot] = useState<Snapshot>({ xpTotal: 0, sessionsTotal: 0, stats: {} });

  const reload = useCallback(async () => {
    const [profile, stats] = await Promise.all([getProfile(), getAllStats()]);
    const sessionsTotal = Object.values(stats).reduce((acc, game) => acc + (game?.sessions ?? 0), 0);
    setSnapshot({ xpTotal: profile.xpTotal, sessionsTotal, stats });
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const level = useMemo(() => getLevelByXp(snapshot.xpTotal), [snapshot.xpTotal]);
  const nextLevel = useMemo(() => getNextLevel(snapshot.xpTotal), [snapshot.xpTotal]);

  const progress = nextLevel
    ? (snapshot.xpTotal - level.minXp) / Math.max(1, nextLevel.minXp - level.minXp)
    : 1;

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <Card>
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Resumen general</Text>
        <StatRow label="Sesiones totales" value={String(snapshot.sessionsTotal)} />
        <StatRow label="XP total" value={String(snapshot.xpTotal)} />
        <StatRow label="Nivel" value={`${level.badgeEmoji} ${level.name}`} />
        <View style={[styles.progressTrack, { backgroundColor: theme.colors.border, marginTop: 8 }]}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: theme.colors.primary }]} />
        </View>
        <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
          {nextLevel ? `Faltan ${nextLevel.minXp - snapshot.xpTotal} XP para ${nextLevel.name}` : 'Nivel máximo'}
        </Text>
      </Card>

      {enabledGames().map((game) => {
        const stat = snapshot.stats[game.id];
        return (
          <Card key={game.id}>
            <Text style={[theme.typography.h3, { color: theme.colors.text }]}>
              {game.icon} {game.title}
            </Text>
            <StatRow label="Sesiones" value={String(stat?.sessions ?? 0)} />
            <StatRow label="Best score" value={String(stat?.bestScore ?? '-')} />
            <StatRow label="Best time (ms)" value={String(stat?.bestTimeMs ?? '-')} />
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
});