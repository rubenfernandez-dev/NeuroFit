import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { enabledGames } from '../games/registry';
import { getLevelByXp, getNextLevel } from '../shared/gamification/levels';
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
import StreakWidget from '../shared/ui/StreakWidget';
import XPLevelIndicator from '../shared/ui/XPLevelIndicator';

type Snapshot = {
  xpTotal: number;
  levelId: string;
  seasonId: string;
  seasonPoints: number;
  leagueId: LeagueId;
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

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions — derivar insights de datos crudos
// ─────────────────────────────────────────────────────────────────────────────

type NeuroMetric = { key: keyof Omit<Snapshot['neuro'], 'updatedAtISO'>; title: string; value: number; color: string };

function getStrongestSkill(metrics: NeuroMetric[]): NeuroMetric {
  return metrics.reduce((best, current) => (current.value > best.value ? current : best), metrics[0] || metrics[0]);
}

function getWeakestSkill(metrics: NeuroMetric[]): NeuroMetric {
  return metrics.reduce((min, current) => (current.value < min.value ? current : min), metrics[0] || metrics[0]);
}

function getTotalSessions(stats: Snapshot['stats']): number {
  return Object.values(stats).reduce((acc, game) => acc + (game?.sessions ?? 0), 0);
}

function getMostPlayedGame(stats: Snapshot['stats'], games: typeof enabledGames): { id: string; title: string; sessions: number } | null {
  let max = 0;
  let result: { id: string; title: string; sessions: number } | null = null;

  for (const game of games()) {
    const sessions = stats[game.id]?.sessions ?? 0;
    if (sessions > max) {
      max = sessions;
      const title = game.title || game.id;
      result = { id: game.id, title, sessions };
    }
  }

  return result;
}

function getBestGame(stats: Snapshot['stats'], games: typeof enabledGames): { id: string; title: string; bestScore: number } | null {
  let maxScore = -1;
  let result: { id: string; title: string; bestScore: number } | null = null;

  for (const game of games()) {
    const score = stats[game.id]?.bestScore ?? 0;
    if (score > maxScore) {
      maxScore = score;
      const title = game.title || game.id;
      result = { id: game.id, title, bestScore: score };
    }
  }

  return result;
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const { theme } = useAppTheme();
  const categoryColors = getCategoryColors(theme.mode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    xpTotal: 0,
    levelId: 'bronze',
    seasonId: '',
    seasonPoints: 0,
    leagueId: 'bronze',
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
      const profile = await ensureSeasonCurrent();
      const stats = await getAllStats();

      setSnapshot({
        xpTotal: profile.xpTotal,
        levelId: getLevelByXp(profile.xpTotal).id,
        seasonId: profile.seasonId,
        seasonPoints: profile.seasonPoints,
        leagueId: profile.leagueId,
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
  const currentLevel = useMemo(() => getLevelByXp(snapshot.xpTotal), [snapshot.xpTotal]);
  const nextLevel = useMemo(() => getNextLevel(snapshot.xpTotal), [snapshot.xpTotal]);

  const neuroMetrics: NeuroMetric[] = useMemo(
    () => [
      { key: 'speed', title: '⚡ Velocidad', value: snapshot.neuro.speed, color: categoryColors.speed },
      { key: 'memory', title: '🧠 Memoria', value: snapshot.neuro.memory, color: categoryColors.memory },
      { key: 'logic', title: '🧩 Lógica', value: snapshot.neuro.logic, color: categoryColors.logic },
      { key: 'attention', title: '🎯 Atención', value: snapshot.neuro.attention, color: categoryColors.attention },
    ],
    [categoryColors, snapshot.neuro],
  );

  const strongest = useMemo(() => getStrongestSkill(neuroMetrics), [neuroMetrics]);
  const weakest = useMemo(() => getWeakestSkill(neuroMetrics), [neuroMetrics]);
  const totalSessions = useMemo(() => getTotalSessions(snapshot.stats), [snapshot.stats]);
  const mostPlayedGame = useMemo(() => getMostPlayedGame(snapshot.stats, enabledGames), [snapshot.stats]);
  const bestGame = useMemo(() => getBestGame(snapshot.stats, enabledGames), [snapshot.stats]);

  const leagueAccent = getLeagueAccent(snapshot.leagueId);
  const top10GoalSp = league.minSeasonPoints + 1800;
  const distanceToTop10 = Math.max(0, top10GoalSp - snapshot.seasonPoints);
  const top10Progress = top10GoalSp > 0 ? Math.min(1, snapshot.seasonPoints / top10GoalSp) : 1;

  const xpToNextLevel = nextLevel ? nextLevel.minXp - snapshot.xpTotal : 0;
  const xpCurrentLevelStart = currentLevel.minXp;
  const xpCurrentLevelEnd = nextLevel ? nextLevel.minXp : currentLevel.minXp + 50000;
  const xpInCurrentLevel = snapshot.xpTotal - xpCurrentLevelStart;
  const xpCurrentLevelRange = xpCurrentLevelEnd - xpCurrentLevelStart;
  const levelProgress = xpCurrentLevelRange > 0 ? Math.min(1, xpInCurrentLevel / xpCurrentLevelRange) : 1;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        {/* ERROR STATE */}
        {loadError ? (
          <Card variant="warning" style={{ margin: 16 }}>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.red }]}>{loadError}</Text>
            <View style={{ marginTop: 12 }}>
              <Button title="Reintentar" onPress={reload} variant="secondary" />
            </View>
          </Card>
        ) : null}

        {/* A) RESUMEN GENERAL — XP / LEVEL */}
        <Card variant="primary" style={{ margin: 16 }}>
          <Text style={[theme.typography.h2, { color: theme.colors.text }]}>Tu Progreso</Text>

          <View style={{ marginTop: 16 }}>
            <XPLevelIndicator xpTotal={snapshot.xpTotal} />
          </View>

          {nextLevel && (
            <View style={{ marginTop: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted }]}>Hacia siguiente nivel</Text>
                <Text style={[theme.typography.label, { color: theme.colors.textMuted }]}>
                  {xpToNextLevel.toLocaleString()} XP
                </Text>
              </View>
              <AnimatedProgressBar value={levelProgress} color={categoryColors.speed} durationMs={600} height={10} />
            </View>
          )}

          <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
              Total XP acumulado: {snapshot.xpTotal.toLocaleString()}
            </Text>
          </View>
        </Card>

        {/* B) NEUROSCORE */}
        <Card variant="primary" style={{ margin: 16 }}>
          <Text style={[theme.typography.h2, { color: theme.colors.text }]}>NeuroScore</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
            Actualizado: {formatHumanDate(snapshot.neuro.updatedAtISO, { fallback: 'sin actualizar' })}
          </Text>

          <View style={{ marginTop: 14, gap: 12 }}>
            {neuroMetrics.map((metric) => (
              <View key={metric.key}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={[theme.typography.bodySmall, { color: theme.colors.text }]}>{metric.title}</Text>
                  <Text style={[theme.typography.label, { color: metric.color, fontSize: 16, fontWeight: '700' }]}>
                    {metric.value}
                  </Text>
                </View>
                <AnimatedProgressBar value={metric.value / 100} color={metric.color} durationMs={500} height={8} />
              </View>
            ))}
          </View>

          {/* Insights Cards */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <View style={[{ flex: 1, borderRadius: 12, padding: 12, backgroundColor: `${strongest.color}22` }]}>
              <Text style={[theme.typography.caption, { color: strongest.color, fontWeight: '600' }]}>⭐ Punto Fuerte</Text>
              <Text style={[theme.typography.h3, { color: strongest.color, marginTop: 6 }]}>
                {strongest.title.replace(/^[^ ]+\s/, '')}
              </Text>
            </View>
            <View style={[{ flex: 1, borderRadius: 12, padding: 12, backgroundColor: `${weakest.color}22` }]}>
              <Text style={[theme.typography.caption, { color: weakest.color, fontWeight: '600' }]}>🚀 A Mejorar</Text>
              <Text style={[theme.typography.h3, { color: weakest.color, marginTop: 6 }]}>
                {weakest.title.replace(/^[^ ]+\s/, '')}
              </Text>
            </View>
          </View>
        </Card>

        {/* C) STREAK Y DAILY */}
        <View style={{ marginHorizontal: 16, marginTop: 4 }}>
          <StreakWidget current={snapshot.streakCurrent} best={snapshot.streakBest} />
        </View>

        <Card variant="success" style={{ margin: 16, marginTop: 12 }}>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.text }]}>
            {snapshot.streakCurrent > 0
              ? `🔥 ¡Excelente! Llevas ${snapshot.streakCurrent} días de racha consistente.`
              : `Comienza tu racha completando hoy el Daily Challenge.`}
          </Text>
        </Card>

        {/* D) LIGA SEMANAL */}
        <Card
          style={{
            margin: 16,
            borderColor: `${leagueAccent}66`,
            borderWidth: 1,
            backgroundColor: theme.mode === 'dark' ? theme.colors.bg1 : `${leagueAccent}11`,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 36 }}>{getLeagueTrophy(snapshot.leagueId)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.h2, { color: theme.colors.text }]}>Liga </Text>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted, marginTop: 2 }]}>
                Competencia semanal
              </Text>
            </View>
            <Pill label={`${snapshot.seasonPoints.toLocaleString()} SP`} tone="cyan" />
          </View>

          <View style={{ marginTop: 12, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Pill label={`${league.badgeEmoji} ${league.name}`} tone="default" />
            <Pill label={`Temporada ${snapshot.seasonId || '–'}`} tone="pink" />
          </View>

          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Hacia Top 10</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, fontWeight: '600' }]}>
                {distanceToTop10 > 0 ? `Faltan ${distanceToTop10}` : 'Objetivo alcanzado'}
              </Text>
            </View>
            <AnimatedProgressBar
              value={top10Progress}
              color={leagueAccent}
              durationMs={600}
              height={12}
            />
          </View>

          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textMuted, marginTop: 10, fontStyle: 'italic' },
            ]}
          >
            Top 10 ascienden • Últimos 10 descienden
          </Text>
        </Card>

        {/* E) ESTADÍSTICAS GENERALES */}
        {totalSessions > 0 ? (
          <Card variant="primary" style={{ margin: 16 }}>
            <Text style={[theme.typography.h2, { color: theme.colors.text }]}>Estadísticas Generales</Text>

            <View style={{ marginTop: 12, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted }]}>Partidas totales</Text>
                <Text style={[theme.typography.h3, { color: theme.colors.text }]}>{totalSessions}</Text>
              </View>

              {mostPlayedGame && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted }]}>Juego más usado</Text>
                  <Text style={[theme.typography.bodySmall, { color: theme.colors.text, fontWeight: '600' }]}>
                    {mostPlayedGame.title} ({mostPlayedGame.sessions})
                  </Text>
                </View>
              )}

              {bestGame && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted }]}>Mejor puntuación</Text>
                  <Text style={[theme.typography.bodySmall, { color: theme.colors.text, fontWeight: '600' }]}>
                    {bestGame.title}: {bestGame.bestScore}
                  </Text>
                </View>
              )}
            </View>
          </Card>
        ) : (
          <Card variant="warning" style={{ margin: 16 }}>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.text }]}>
              🎮 Aún no hay datos de progreso. Juega unas partidas para ver tus estadísticas aquí.
            </Text>
          </Card>
        )}

        {/* F) DETALLE POR JUEGO */}
        {totalSessions > 0 && (
          <>
            <Text
              style={[
                theme.typography.h3,
                { color: theme.colors.text, marginHorizontal: 16, marginTop: 20, marginBottom: 12 },
              ]}
            >
              Progreso por Juego
            </Text>

            {enabledGames().map((game) => {
              const stat = snapshot.stats[game.id];
              const sessions = stat?.sessions ?? 0;

              // Skip games with no sessions
              if (sessions === 0) return null;

              const category = game.category ?? GAME_CATEGORIES[game.id] ?? 'logic';
              const accent = categoryColors[category];
              const bestScore = stat?.bestScore ?? '-';
              const bestTimeSeconds = stat?.bestTimeMs ? formatDurationMsToSeconds(stat.bestTimeMs, 1) : '-';
              const avgScore = stat?.avgScore ? Math.round(stat.avgScore) : '-';
              const wins = stat?.wins ?? 0;
              const winRate = sessions > 0 ? Math.round((wins / sessions) * 100) : 0;

              return (
                <Card key={game.id} style={{ margin: 16, borderLeftWidth: 4, borderLeftColor: accent }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[theme.typography.h3, { color: theme.colors.text }]}>
                      {game.icon} {game.title}
                    </Text>
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        backgroundColor: `${accent}22`,
                      }}
                    >
                      <Text style={[theme.typography.caption, { color: accent, fontWeight: '600' }]}>
                        {CATEGORY_LABELS[category]}
                      </Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 12, flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                    <View
                      style={{
                        flex: 1,
                        minWidth: 90,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        borderRadius: 10,
                        padding: 10,
                      }}
                    >
                      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Sesiones</Text>
                      <Text style={[theme.typography.h3, { color: theme.colors.text, marginTop: 6 }]}>{sessions}</Text>
                    </View>

                    <View
                      style={{
                        flex: 1,
                        minWidth: 90,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        borderRadius: 10,
                        padding: 10,
                      }}
                    >
                      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Mejor</Text>
                      <Text style={[theme.typography.h3, { color: accent, marginTop: 6 }]}>{bestScore}</Text>
                    </View>

                    <View
                      style={{
                        flex: 1,
                        minWidth: 90,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        borderRadius: 10,
                        padding: 10,
                      }}
                    >
                      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Promedio</Text>
                      <Text style={[theme.typography.h3, { color: theme.colors.text, marginTop: 6 }]}>{avgScore}</Text>
                    </View>

                    {winRate > 0 && (
                      <View
                        style={{
                          flex: 1,
                          minWidth: 90,
                          borderWidth: 1,
                          borderColor: theme.colors.border,
                          borderRadius: 10,
                          padding: 10,
                        }}
                      >
                        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Acierto</Text>
                        <Text style={[theme.typography.h3, { color: theme.colors.text, marginTop: 6 }]}>{winRate}%</Text>
                      </View>
                    )}
                  </View>

                  {bestTimeSeconds !== '-' && (
                    <View style={{ marginTop: 12 }}>
                      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                        Mejor tiempo: {bestTimeSeconds}
                      </Text>
                    </View>
                  )}

                  <View style={{ marginTop: 12 }}>
                    <AnimatedProgressBar
                      value={Math.min(1, sessions / 30)}
                      color={accent}
                      label="Ritmo de actividad"
                      durationMs={450}
                      height={8}
                    />
                  </View>
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
