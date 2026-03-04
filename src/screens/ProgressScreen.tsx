import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllStats } from '../shared/storage/stats';
import { ensureSeasonCurrent } from '../shared/storage/profile';
import { getLevelByXp, getNextLevel } from '../shared/gamification/levels';
import { enabledGames } from '../games/registry';
import Card from '../shared/ui/Card';
import StatRow from '../shared/ui/StatRow';
import { useAppTheme } from '../shared/theme/theme';
import { getLeagueById } from '../shared/gamification/leagues';

type Snapshot = {
  xpTotal: number;
  seasonId: string;
  seasonPoints: number;
  leagueId: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grand_master' | 'legend';
  sessionsTotal: number;
  streakCurrent: number;
  streakBest: number;
  stats: Awaited<ReturnType<typeof getAllStats>>;
};

export default function ProgressScreen() {
  const { theme } = useAppTheme();
  const [snapshot, setSnapshot] = useState<Snapshot>({
    xpTotal: 0,
    seasonId: '',
    seasonPoints: 0,
    leagueId: 'bronze',
    sessionsTotal: 0,
    streakCurrent: 0,
    streakBest: 0,
    stats: {},
  });

  const reload = useCallback(async () => {
    const [profile, stats] = await Promise.all([ensureSeasonCurrent(), getAllStats()]);
    const sessionsTotal = Object.values(stats).reduce((acc, game) => acc + (game?.sessions ?? 0), 0);
    setSnapshot({
      xpTotal: profile.xpTotal,
      seasonId: profile.seasonId,
      seasonPoints: profile.seasonPoints,
      leagueId: profile.leagueId,
      sessionsTotal,
      streakCurrent: profile.streakCurrent,
      streakBest: profile.streakBest,
      stats,
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const level = useMemo(() => getLevelByXp(snapshot.xpTotal), [snapshot.xpTotal]);
  const nextLevel = useMemo(() => getNextLevel(snapshot.xpTotal), [snapshot.xpTotal]);
  const league = useMemo(() => getLeagueById(snapshot.leagueId), [snapshot.leagueId]);
  const sudokuStats = snapshot.stats.sudoku;
  const sudokuPlayed = sudokuStats?.sudokuPlayed ?? 0;
  const sudokuCompleted = sudokuStats?.sudokuCompleted ?? 0;
  const sudokuAvgTime = sudokuCompleted > 0 ? Math.round((sudokuStats?.sudokuTotalTimeMs ?? 0) / sudokuCompleted) : 0;
  const sudokuAvgMistakes = sudokuPlayed > 0 ? ((sudokuStats?.sudokuTotalMistakes ?? 0) / sudokuPlayed).toFixed(2) : '0.00';
  const sudokuWinRate = sudokuPlayed > 0 ? `${Math.round((sudokuCompleted / sudokuPlayed) * 100)}%` : '0%';

  const progress = nextLevel
    ? (snapshot.xpTotal - level.minXp) / Math.max(1, nextLevel.minXp - level.minXp)
    : 1;

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <Card>
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Resumen general</Text>
        <StatRow label="Sesiones totales" value={String(snapshot.sessionsTotal)} />
        <StatRow label="XP total (permanente)" value={String(snapshot.xpTotal)} />
        <StatRow label="Nivel XP" value={`${level.badgeEmoji} ${level.name}`} />
        <StatRow label="SP temporada" value={`${snapshot.seasonPoints} SP`} />
        <StatRow label="Liga semanal" value={`${league.badgeEmoji} ${league.name}`} />
        <StatRow label="Temporada" value={snapshot.seasonId || '-'} />
        <StatRow label="Objetivo liga" value="Top 10 para ascender" />
        <StatRow label="Racha actual" value={`${snapshot.streakCurrent} días`} />
        <StatRow label="Mejor racha" value={`${snapshot.streakBest} días`} />
        <View style={[styles.progressTrack, { backgroundColor: theme.colors.border, marginTop: 8 }]}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: theme.colors.primary }]} />
        </View>
        <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
          {nextLevel ? `Faltan ${nextLevel.minXp - snapshot.xpTotal} XP para ${nextLevel.name}` : 'Nivel máximo'}
        </Text>
      </Card>

      <Card>
        <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Sudoku</Text>
        <StatRow label="Partidas jugadas" value={String(sudokuPlayed)} />
        <StatRow label="Completados" value={String(sudokuCompleted)} />
        <StatRow label="Win rate" value={sudokuWinRate} />
        <StatRow label="Mejor tiempo (ms)" value={String(sudokuStats?.bestTimeMs ?? '-')} />
        <StatRow label="Tiempo medio (ms)" value={String(sudokuAvgTime)} />
        <StatRow label="Fallos medios" value={sudokuAvgMistakes} />
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