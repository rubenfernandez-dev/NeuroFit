import React, { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { enabledGames } from '../games/registry';
import { getLeagueById, LeagueId } from '../shared/gamification/leagues';
import { ensureSeasonCurrent } from '../shared/storage/profile';
import { getAllStats } from '../shared/storage/stats';
import { captureException, classifyDataFailure, formatLoadFailureMessage } from '../shared/observability';
import { CATEGORY_LABELS, GAME_CATEGORIES, getCategoryColors } from '../shared/theme/categoryColors';
import { useAppTheme } from '../shared/theme/theme';
import { formatDurationMsToSeconds, formatHumanDate } from '../shared/utils/dateFormatter';
import AnimatedProgressBar from '../shared/ui/AnimatedProgressBar';
import Button from '../shared/ui/Button';
import Card from '../shared/ui/Card';
import Pill from '../shared/ui/Pill';
import Screen from '../shared/ui/Screen';
import XPLevelIndicator from '../shared/ui/XPLevelIndicator';

type Snapshot = {
  xpTotal: number;
  seasonId: string;
  seasonPoints: number;
  leagueId: LeagueId;
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

function getLeagueAccent(leagueId: LeagueId): string {
  if (leagueId === 'bronze') return '#CD7F32';
  if (leagueId === 'silver') return '#94A3B8';
  if (leagueId === 'gold') return '#F59E0B';
  if (leagueId === 'platinum') return '#06B6D4';
  if (leagueId === 'diamond') return '#60A5FA';
  if (leagueId === 'master') return '#EC4899';
  if (leagueId === 'grand_master') return '#F97316';
  return '#A78BFA';
}

function getLeagueTrophy(leagueId: LeagueId): string {
  if (leagueId === 'bronze') return '🥉';
  if (leagueId === 'silver') return '🥈';
  if (leagueId === 'gold') return '🥇';
  if (leagueId === 'platinum') return '🏆';
  if (leagueId === 'diamond') return '💎';
  if (leagueId === 'master') return '🧠';
  if (leagueId === 'grand_master') return '🔥';
  return '👑';
}

export default function ProgressScreen() {
  const { theme } = useAppTheme();
  const categoryColors = getCategoryColors(theme.mode);
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

  const league = useMemo(() => getLeagueById(snapshot.leagueId), [snapshot.leagueId]);

  const neuroMetrics = useMemo(
    () => [
      { key: 'speed', title: '⚡ Velocidad', value: snapshot.neuro.speed, color: categoryColors.speed },
      { key: 'memory', title: '🧠 Memoria', value: snapshot.neuro.memory, color: categoryColors.memory },
      { key: 'logic', title: '🧩 Lógica', value: snapshot.neuro.logic, color: categoryColors.logic },
      { key: 'attention', title: '🎯 Atención', value: snapshot.neuro.attention, color: categoryColors.attention },
    ],
    [categoryColors, snapshot.neuro],
  );

  const strongest = useMemo(
    () => neuroMetrics.reduce((best, current) => (current.value > best.value ? current : best), neuroMetrics[0]),
    [neuroMetrics],
  );

  const weakest = useMemo(
    () => neuroMetrics.reduce((min, current) => (current.value < min.value ? current : min), neuroMetrics[0]),
    [neuroMetrics],
  );

  const leagueAccent = getLeagueAccent(snapshot.leagueId);
  const top10GoalSp = league.minSeasonPoints + 1800;
  const distanceToTop10 = Math.max(0, top10GoalSp - snapshot.seasonPoints);
  const top10Progress = top10GoalSp > 0 ? Math.min(1, snapshot.seasonPoints / top10GoalSp) : 1;

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
        <Text style={[theme.typography.caption, { color: theme.colors.muted, marginTop: 4 }]}>Actualizado: {formatHumanDate(snapshot.neuro.updatedAtISO, { fallback: 'sin actualizar' })}</Text>

        <View style={{ marginTop: 12, gap: 10 }}>
          {neuroMetrics.map((metric) => (
            <View key={metric.key} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[theme.typography.bodySmall, { color: theme.colors.text }]}>{metric.title}</Text>
                <Text style={[theme.typography.label, { color: metric.color }]}>{metric.value}</Text>
              </View>
              <AnimatedProgressBar value={metric.value / 100} color={metric.color} durationMs={480} />
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <View style={[{ flex: 1, borderRadius: 12, padding: 10, backgroundColor: `${strongest.color}22` }]}>
            <Text style={[theme.typography.caption, { color: strongest.color }]}>Punto fuerte</Text>
            <Text style={[theme.typography.h3, { color: strongest.color, marginTop: 4 }]}>
              {strongest.title.replace(/^[^ ]+\s/, '')}
            </Text>
          </View>
          <View style={[{ flex: 1, borderRadius: 12, padding: 10, backgroundColor: `${weakest.color}22` }]}>
            <Text style={[theme.typography.caption, { color: weakest.color }]}>A mejorar</Text>
            <Text style={[theme.typography.h3, { color: weakest.color, marginTop: 4 }]}>
              {weakest.title.replace(/^[^ ]+\s/, '')}
            </Text>
          </View>
        </View>
      </Card>

      <XPLevelIndicator xpTotal={snapshot.xpTotal} />

      <Card
        style={{
          borderColor: `${leagueAccent}66`,
          borderWidth: 1,
          backgroundColor: theme.mode === 'dark' ? theme.colors.bg1 : `${leagueAccent}11`,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 30 }}>{getLeagueTrophy(snapshot.leagueId)}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.h2, { color: theme.colors.text }]}>Liga semanal</Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted }]}>Progreso de temporada</Text>
          </View>
          <Pill label={`${snapshot.seasonPoints} SP`} tone="cyan" />
        </View>

        <View style={{ marginTop: 10, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Pill label={`${league.badgeEmoji} ${league.name}`} tone="default" />
          <Pill label={`Temporada ${snapshot.seasonId || '-'}`} tone="pink" />
        </View>

        <View style={{ marginTop: 12 }}>
          <AnimatedProgressBar
            value={top10Progress}
            color={leagueAccent}
            label={distanceToTop10 > 0 ? `Te faltan ${distanceToTop10} SP para objetivo Top 10` : 'Objetivo Top 10 alcanzado'}
            durationMs={520}
            height={12}
          />
        </View>

        <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 8 }]}>Top 10 ascienden • Últimos 10 descienden</Text>
      </Card>

      <Card variant="success">
        <Text style={[theme.typography.h2, { color: theme.colors.text }]}>Estadísticas por juego</Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted, marginTop: 4 }]}>Sesiones totales: {snapshot.sessionsTotal}</Text>
      </Card>

      {enabledGames().map((game) => {
        const stat = snapshot.stats[game.id];
        const category = game.category ?? GAME_CATEGORIES[game.id] ?? 'logic';
        const accent = categoryColors[category];
        const sessions = stat?.sessions ?? 0;
        const bestScore = stat?.bestScore ?? '-';
        const bestTimeSeconds = formatDurationMsToSeconds(stat?.bestTimeMs, 2);

        return (
          <Card key={game.id} style={{ borderLeftWidth: 4, borderLeftColor: accent }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[theme.typography.h3, { color: theme.colors.text }]}>
                {game.icon} {game.title}
              </Text>
              <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: `${accent}22` }}>
                <Text style={[theme.typography.caption, { color: accent }]}>{CATEGORY_LABELS[category]}</Text>
              </View>
            </View>

            <View style={{ marginTop: 10, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <View style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 10, minWidth: 92 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Sesiones</Text>
                <Text style={[theme.typography.h3, { color: theme.colors.text, marginTop: 4 }]}>{sessions}</Text>
              </View>

              <View style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 10, minWidth: 110 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Mejor puntuacion</Text>
                <Text style={[theme.typography.h3, { color: theme.colors.text, marginTop: 4 }]}>{bestScore}</Text>
              </View>

              <View style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 10, minWidth: 110 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Mejor tiempo</Text>
                <Text style={[theme.typography.h3, { color: theme.colors.text, marginTop: 4 }]}>{bestTimeSeconds}</Text>
              </View>
            </View>

            <View style={{ marginTop: 10 }}>
              <AnimatedProgressBar
                value={Math.min(1, sessions / 40)}
                color={accent}
                label="Ritmo de actividad"
                durationMs={450}
                height={8}
              />
            </View>

            <View
              style={{
                marginTop: 12,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: theme.colors.border,
                borderRadius: 10,
                padding: 10,
              }}
            >
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Espacio reservado para gráfico de evolución</Text>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
