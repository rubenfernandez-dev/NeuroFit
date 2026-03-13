import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../app/routes';
import { useAppTheme } from '../shared/theme/theme';
import Button from '../shared/ui/Button';
import Card from '../shared/ui/Card';
import { ensureSeasonCurrent, markLastWeekResultShown, Profile } from '../shared/storage/profile';
import { getLevelByXp, getNextLevel } from '../shared/gamification/levels';
import Pill from '../shared/ui/Pill';
import { getLeagueById } from '../shared/gamification/leagues';
import Screen from '../shared/ui/Screen';
import PrimaryButton from '../shared/ui/PrimaryButton';
import ProgressBar from '../shared/ui/ProgressBar';
import { ensureDailyToday, getDailyProgress } from '../shared/storage/daily';
import { generateWeeklyLeaderboard } from '../shared/leaderboard/leaderboard';
import { captureException, classifyDataFailure, formatLoadFailureMessage } from '../shared/observability';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [xpTotal, setXpTotal] = useState(0);
  const [seasonPoints, setSeasonPoints] = useState(0);
  const [leagueId, setLeagueId] = useState<'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grand_master' | 'legend'>('bronze');
  const [streakCurrent, setStreakCurrent] = useState(0);
  const [streakBest, setStreakBest] = useState(0);
  const [weeklyResult, setWeeklyResult] = useState<Profile['lastWeekResult'] | null>(null);
  const [dailyCompleted, setDailyCompleted] = useState(false);
  const [dailyProgress, setDailyProgress] = useState('0/3');
  const [userRank, setUserRank] = useState(50);
  const [spToTop10, setSpToTop10] = useState(0);
  const [spToSafety, setSpToSafety] = useState(0);
  const [neuroScore, setNeuroScore] = useState({ speed: 0, memory: 0, logic: 0, attention: 0 });

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const profile = await ensureSeasonCurrent();
          const [daily, board] = await Promise.all([
            ensureDailyToday(),
            generateWeeklyLeaderboard({
              seasonId: profile.seasonId,
              leagueId: profile.leagueId,
              userSeasonPoints: profile.seasonPoints,
              userName: 'Tú',
              size: 50,
            }),
          ]);

          const progress = getDailyProgress(daily);
          const me = board.find((entry) => entry.isUser);
          const top10Cut = board.find((entry) => entry.rank === 10)?.seasonPoints ?? profile.seasonPoints;
          const safetyCut = board.find((entry) => entry.rank === 40)?.seasonPoints ?? profile.seasonPoints;

          setDailyCompleted(daily.completed);
          setDailyProgress(`${progress.completedStages}/${progress.totalStages}`);
          setUserRank(me?.rank ?? 50);
          setSpToTop10(Math.max(0, top10Cut - profile.seasonPoints + 1));
          setSpToSafety(Math.max(0, safetyCut - profile.seasonPoints + 1));
          setNeuroScore(profile.neuro);

          setXpTotal(profile.xpTotal);
          setSeasonPoints(profile.seasonPoints);
          setLeagueId(profile.leagueId);
          setStreakCurrent(profile.streakCurrent);
          setStreakBest(profile.streakBest);

          if (
            profile.lastWeekResult &&
            profile.lastWeekResultShownSeasonId !== profile.lastWeekResult.seasonIdPrev
          ) {
            setWeeklyResult(profile.lastWeekResult);
          }

          setLoadError(null);
        } catch (error) {
          const kind = classifyDataFailure(error);
          captureException(error, { area: 'home.load', kind });
          setLoadError(formatLoadFailureMessage(kind));
        }
      };

      load();
    }, [reloadNonce]),
  );

  const level = getLevelByXp(xpTotal);
  const nextLevel = getNextLevel(xpTotal);
  const league = getLeagueById(leagueId);
  const progress = nextLevel
    ? (xpTotal - level.minXp) / Math.max(1, nextLevel.minXp - level.minXp)
    : 1;

  const closeWeeklyResult = async () => {
    if (!weeklyResult) return;
    await markLastWeekResultShown(weeklyResult.seasonIdPrev);
    setWeeklyResult(null);
  };

  const weeklyStatusText =
    weeklyResult && weeklyResult.leagueAfter !== weeklyResult.leagueBefore
      ? weeklyResult.leagueAfter === leagueId
        ? '¡Cambio de liga aplicado!'
        : 'Resultado semanal actualizado'
      : 'Te mantienes en tu liga';

  const metrics = useMemo(
    () => [
      { key: 'speed', title: '⚡ Velocidad mental', value: neuroScore.speed, color: theme.colors.orange },
      { key: 'memory', title: '🧠 Memoria', value: neuroScore.memory, color: theme.colors.pink },
      { key: 'logic', title: '🧩 Lógica', value: neuroScore.logic, color: theme.colors.primary },
      { key: 'attention', title: '🎯 Atención', value: neuroScore.attention, color: theme.colors.cyan },
    ],
    [neuroScore, theme.colors],
  );

  return (
    <>
      <Screen>
        <Text style={[theme.typography.title, { color: theme.colors.text }]}>NeuroFit</Text>
        <Text style={[theme.typography.body, { color: theme.colors.muted }]}>Entrena tu mente</Text>
        {loadError ? (
          <Card variant="warning">
            <Text style={[theme.typography.bodySmall, { color: theme.colors.red }]}>{loadError}</Text>
            <View style={{ marginTop: 10 }}>
              <Button title="Reintentar carga" onPress={() => setReloadNonce((current) => current + 1)} variant="secondary" />
            </View>
          </Card>
        ) : null}
        <Pill label={`🔥 Racha ${streakCurrent} · Mejor ${streakBest}`} tone="warning" />

        <Card variant="primary">
          <Text style={[theme.typography.h2, { color: theme.colors.text }]}>NeuroScore</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.muted, marginTop: 4 }]}>Calculado con tus partidas</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
            {metrics.map((metric) => (
              <View
                key={metric.key}
                style={{
                  width: '48%',
                  backgroundColor: theme.colors.bg0,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: 14,
                  padding: 10,
                  gap: 8,
                }}
              >
                <Text style={[theme.typography.caption, { color: theme.colors.text }]}>{metric.title}</Text>
                <Text style={[theme.typography.h2, { color: metric.color }]}>{metric.value}</Text>
                <ProgressBar value={metric.value / 100} color={metric.color} />
              </View>
            ))}
          </View>
        </Card>

        <PrimaryButton title="Jugar ahora" onPress={() => navigation.navigate('Games')} />

        <Card variant="success">
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>🎯 Reto diario</Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.muted, marginTop: 6 }]}>
            {dailyCompleted ? `Completado por hoy (${dailyProgress}). ¡Gran trabajo!` : `Progreso ${dailyProgress}. Completa el circuito para reclamar XP extra.`}
          </Text>
          <View style={{ marginTop: 12 }}>
            <Button title={dailyCompleted ? '✅ Completado' : 'Iniciar reto diario'} variant="secondary" onPress={() => navigation.navigate('DailyChallenge')} />
          </View>
        </Card>

        <Card variant="warning">
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>🏆 Liga semanal</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <Pill label={`${league.badgeEmoji} ${league.name}`} tone="default" />
            <Pill label={`${seasonPoints} SP`} tone="cyan" />
            <Pill label={`Puesto #${userRank}`} tone={userRank <= 10 ? 'success' : userRank >= 41 ? 'danger' : 'default'} />
          </View>
          <Text style={[theme.typography.caption, { color: theme.colors.muted, marginTop: 10 }]}>Top 10 ascienden • Últimos 10 descienden</Text>
          {userRank > 10 ? (
            <Text style={[theme.typography.bodySmall, { color: theme.colors.orange, marginTop: 6 }]}>Te faltan {spToTop10} SP para Top 10</Text>
          ) : null}
          {userRank >= 41 ? (
            <Text style={[theme.typography.bodySmall, { color: theme.colors.red, marginTop: 4 }]}>Te faltan {spToSafety} SP para salir de descenso</Text>
          ) : null}
        </Card>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => navigation.navigate('Leaderboard')} style={{ flex: 1 }}>
            <Card>
              <Text style={{ fontSize: 20 }}>🥇</Text>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.text, marginTop: 6 }]}>Ranking local</Text>
            </Card>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Progress')} style={{ flex: 1 }}>
            <Card>
              <Text style={{ fontSize: 20 }}>📈</Text>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.text, marginTop: 6 }]}>Progreso</Text>
            </Card>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Settings')} style={{ flex: 1 }}>
            <Card>
              <Text style={{ fontSize: 20 }}>⚙️</Text>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.text, marginTop: 6 }]}>Ajustes</Text>
            </Card>
          </Pressable>
        </View>

        <Card>
          <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Nivel actual</Text>
          <Text style={[theme.typography.body, { color: theme.colors.muted, marginTop: 6 }]}>
            {level.badgeEmoji} {level.name} · {xpTotal} XP
          </Text>
          <View style={{ marginTop: 10 }}>
            <ProgressBar value={progress} />
          </View>
          <Text style={[theme.typography.caption, { color: theme.colors.muted, marginTop: 6 }]}>
            {nextLevel ? `Siguiente: ${nextLevel.name} (${nextLevel.minXp} XP)` : 'Nivel máximo alcanzado'}
          </Text>
        </Card>
      </Screen>

      <Modal visible={!!weeklyResult} transparent animationType="fade" onRequestClose={closeWeeklyResult}>
        <View style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.lg }}>
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: theme.colors.bg0,
              opacity: 0.78,
            }}
          />
          <Card>
            <Text style={[theme.typography.h3, { color: theme.colors.text }]}>Resultado semanal</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>{weeklyStatusText}</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
              Liga: {weeklyResult ? getLeagueById(weeklyResult.leagueBefore).name : '-'} → {weeklyResult ? getLeagueById(weeklyResult.leagueAfter).name : '-'}
            </Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
              Puesto final: {weeklyResult?.finalRank ?? '-'} / 50
            </Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
              SP semana: {weeklyResult?.spFinal ?? 0}
            </Text>
            <View style={{ marginTop: 12 }}>
              <Button title="Continuar" onPress={closeWeeklyResult} />
            </View>
          </Card>
        </View>
      </Modal>
    </>
  );
}