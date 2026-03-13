import React, { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllStats } from '../shared/storage/stats';
import { ensureSeasonCurrent } from '../shared/storage/profile';
import { getLevelByXp, getNextLevel } from '../shared/gamification/levels';
import { enabledGames } from '../games/registry';
import Card from '../shared/ui/Card';
import { useAppTheme } from '../shared/theme/theme';
import { getLeagueById } from '../shared/gamification/leagues';
import Screen from '../shared/ui/Screen';
import ProgressBar from '../shared/ui/ProgressBar';
import Pill from '../shared/ui/Pill';
import { isIsoTimestampOnLocalDay } from '../shared/utils/time';
import Button from '../shared/ui/Button';
import { captureException, classifyDataFailure, formatLoadFailureMessage } from '../shared/observability';

type Snapshot = {
  xpTotal: number;
  seasonId: string;
  seasonPoints: number;
  leagueId: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grand_master' | 'legend';
  sessionsTotal: number;
  streakCurrent: number;
  streakBest: number;
  neuro: {
    speed: number;
    memory: number;
    logic: number;
    attention: number;
    updatedAtISO?: string;
  };
  stats: Awaited<ReturnType<typeof getAllStats>>;
};

const GAME_PROGRESS_LABELS = {
  sessions: 'Sesiones',
  bestScore: 'Mejor puntuación',
  bestTime: 'Mejor tiempo',
  avgMistakesSudoku: 'Fallos medios (Sudoku)',
} as const;

export default function ProgressScreen() {
  const { theme } = useAppTheme();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    xpTotal: 0,
    seasonId: '',
    seasonPoints: 0,
    leagueId: 'bronze',
    sessionsTotal: 0,
    streakCurrent: 0,
    streakBest: 0,
    neuro: {
      speed: 50,
      memory: 50,
      logic: 50,
      attention: 50,
    },
    stats: {},
  });

  const reload = useCallback(async () => {
    try {
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
        neuro: profile.neuro,
        stats,
      });
      setLoadError(null);
    } catch (error) {
      const kind = classifyDataFailure(error);
      captureException(error, { area: 'progress.reload', kind });
      setLoadError(formatLoadFailureMessage(kind));
    }
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
  const neuroMetrics = useMemo(
    () => [
      { key: 'speed', title: '⚡ Velocidad mental', value: snapshot.neuro.speed, color: theme.colors.orange },
      { key: 'memory', title: '🧠 Memoria', value: snapshot.neuro.memory, color: theme.colors.pink },
      { key: 'logic', title: '🧩 Lógica', value: snapshot.neuro.logic, color: theme.colors.primary },
      { key: 'attention', title: '🎯 Atención', value: snapshot.neuro.attention, color: theme.colors.cyan },
    ],
    [snapshot.neuro, theme.colors],
  );

  const strongest = useMemo(
    () => neuroMetrics.reduce((best, current) => (current.value > best.value ? current : best), neuroMetrics[0]),
    [neuroMetrics],
  );
  const weakest = useMemo(
    () => neuroMetrics.reduce((min, current) => (current.value < min.value ? current : min), neuroMetrics[0]),
    [neuroMetrics],
  );

  const neuroUpdatedLabel = useMemo(() => {
    if (!snapshot.neuro.updatedAtISO) return 'sin actualizar';
    const day = snapshot.neuro.updatedAtISO.slice(0, 10);
    return isIsoTimestampOnLocalDay(snapshot.neuro.updatedAtISO) ? 'hoy' : day;
  }, [snapshot.neuro.updatedAtISO]);

  const progress = nextLevel
    ? (snapshot.xpTotal - level.minXp) / Math.max(1, nextLevel.minXp - level.minXp)
    : 1;

  return (
    <Screen>
      {loadError ? (
        <Card variant="warning">
          <Text style={[theme.typography.bodySmall, { color: theme.colors.red }]}>{loadError}</Text>
          <View style={{ marginTop: 10 }}>
            <Button title="Reintentar" onPress={reload} variant="secondary" />
          </View>
        </Card>
      ) : null}

      <Card variant="primary">
        <Text style={[theme.typography.h2, { color: theme.colors.text }]}>NeuroScore</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.muted, marginTop: 4 }]}>Actualizado: {neuroUpdatedLabel}</Text>
        <View style={{ marginTop: 12, gap: 10 }}>
          {neuroMetrics.map((metric) => (
            <View key={metric.key} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[theme.typography.bodySmall, { color: theme.colors.text }]}>{metric.title}</Text>
                <Text style={[theme.typography.label, { color: metric.color }]}>{metric.value}</Text>
              </View>
              <ProgressBar value={metric.value / 100} color={metric.color} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Pill label={`Punto fuerte: ${strongest?.title.replace(/^[^ ]+\s/, '') ?? '-'}`} tone="success" />
          <Pill label={`A mejorar: ${weakest?.title.replace(/^[^ ]+\s/, '') ?? '-'}`} tone="warning" />
        </View>
      </Card>

      <Card variant="primary">
        <Text style={[theme.typography.h2, { color: theme.colors.text }]}>XP y nivel</Text>
        <Text style={[theme.typography.title, { color: theme.colors.primary, marginTop: 8 }]}>{snapshot.xpTotal}</Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.muted }]}>XP total · {level.badgeEmoji} {level.name}</Text>
        <View style={{ marginTop: 10 }}>
          <ProgressBar value={progress} label={nextLevel ? `Faltan ${Math.max(0, nextLevel.minXp - snapshot.xpTotal)} XP para ${nextLevel.name}` : 'Nivel máximo'} />
        </View>
      </Card>

      <Card variant="warning">
        <Text style={[theme.typography.h2, { color: theme.colors.text }]}>Liga semanal</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <Pill label={`${league.badgeEmoji} ${league.name}`} tone="default" />
          <Pill label={`${snapshot.seasonPoints} SP`} tone="cyan" />
          <Pill label={`Temp ${snapshot.seasonId || '-'}`} tone="pink" />
        </View>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.muted, marginTop: 10 }]}>Top 10 ascienden • Últimos 10 descienden</Text>
      </Card>

      <Card variant="success">
        <Text style={[theme.typography.h2, { color: theme.colors.text }]}>Estadísticas de Sudoku</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
          <View style={{ width: '48%', backgroundColor: theme.colors.bg0, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: theme.colors.border }}>
            <Text style={[theme.typography.caption, { color: theme.colors.muted }]}>Partidas</Text>
            <Text style={[theme.typography.h2, { color: theme.colors.text, marginTop: 2 }]}>{sudokuPlayed}</Text>
          </View>
          <View style={{ width: '48%', backgroundColor: theme.colors.bg0, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: theme.colors.border }}>
            <Text style={[theme.typography.caption, { color: theme.colors.muted }]}>Completados</Text>
            <Text style={[theme.typography.h2, { color: theme.colors.text, marginTop: 2 }]}>{sudokuCompleted}</Text>
          </View>
          <View style={{ width: '48%', backgroundColor: theme.colors.bg0, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: theme.colors.border }}>
            <Text style={[theme.typography.caption, { color: theme.colors.muted }]}>Tasa de victoria</Text>
            <Text style={[theme.typography.h2, { color: theme.colors.green, marginTop: 2 }]}>{sudokuWinRate}</Text>
          </View>
          <View style={{ width: '48%', backgroundColor: theme.colors.bg0, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: theme.colors.border }}>
            <Text style={[theme.typography.caption, { color: theme.colors.muted }]}>Tiempo medio</Text>
            <Text style={[theme.typography.h2, { color: theme.colors.text, marginTop: 2 }]}>{sudokuAvgTime} ms</Text>
          </View>
        </View>
      </Card>

      {enabledGames().map((game) => {
        const stat = snapshot.stats[game.id];
        return (
          <Card key={game.id}>
            <Text style={[theme.typography.h3, { color: theme.colors.text }]}>
              {game.icon} {game.title}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Pill label={`${GAME_PROGRESS_LABELS.sessions} ${stat?.sessions ?? 0}`} tone="default" />
              <Pill label={`${GAME_PROGRESS_LABELS.bestScore} ${stat?.bestScore ?? '-'}`} tone="pink" />
            </View>
            <Text style={[theme.typography.caption, { color: theme.colors.muted, marginTop: 8 }]}>
              {GAME_PROGRESS_LABELS.bestTime}: {stat?.bestTimeMs ?? '-'} ms
              {game.id === 'sudoku' ? ` · ${GAME_PROGRESS_LABELS.avgMistakesSudoku}: ${sudokuAvgMistakes}` : ''}
            </Text>
          </Card>
        );
      })}
    </Screen>
  );
}