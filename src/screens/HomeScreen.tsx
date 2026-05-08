import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../app/routes';
import { useAppTheme } from '../shared/theme/theme';
import Button from '../shared/ui/Button';
import Card from '../shared/ui/Card';
import { ensureSeasonCurrent, markLastWeekResultShown, Profile } from '../shared/storage/profile';
import Pill from '../shared/ui/Pill';
import { getLeagueById } from '../shared/gamification/leagues';
import Screen from '../shared/ui/Screen';
import PrimaryButton from '../shared/ui/PrimaryButton';
import ProgressBar from '../shared/ui/ProgressBar';
import { ensureDailyToday, getDailyProgress } from '../shared/storage/daily';
import { generateWeeklyLeaderboard } from '../shared/leaderboard/leaderboard';
import { captureException, classifyDataFailure, formatLoadFailureMessage } from '../shared/observability';
import { getCategoryColors } from '../shared/theme/categoryColors';
import StreakWidget from '../shared/ui/StreakWidget';
import AnimatedProgressBar from '../shared/ui/AnimatedProgressBar';
import { formatNeuroCoins } from '../shared/economy/neuroCoins';
import PlayerEconomyBar from '../shared/economy/PlayerEconomyBar';
import GameResultModal from '../shared/feedback/GameResultModal';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type WeeklyLeagueOutcome = 'promotion' | 'demotion' | 'stay';

export default function HomeScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const categoryColors = getCategoryColors(theme.mode);
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
          setSpToTop10(Math.max(0, top10Cut - profile.xpTotal + 1));
          setSpToSafety(Math.max(0, safetyCut - profile.xpTotal + 1));
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

  const league = getLeagueById(leagueId);
  const leagueAccent =
    leagueId === 'bronze'
      ? '#CD7F32'
      : leagueId === 'silver'
        ? '#94A3B8'
        : leagueId === 'gold'
          ? '#F59E0B'
          : leagueId === 'platinum'
            ? '#06B6D4'
            : leagueId === 'diamond'
              ? '#60A5FA'
              : leagueId === 'master'
                ? '#EC4899'
                : leagueId === 'grand_master'
                  ? '#F97316'
                  : '#A78BFA';
  const top10Progress = spToTop10 > 0 ? Math.max(0, Math.min(1, seasonPoints / (seasonPoints + spToTop10))) : 1;

  const closeWeeklyResult = async () => {
    if (!weeklyResult) return;
    await markLastWeekResultShown(weeklyResult.seasonIdPrev);
    setWeeklyResult(null);
  };

  const weeklyLeagueOutcome = useMemo<WeeklyLeagueOutcome>(() => {
    if (!weeklyResult) return 'stay';
    const previousLeagueRank = getLeagueById(weeklyResult.leagueBefore).minSeasonPoints;
    const currentLeagueRank = getLeagueById(weeklyResult.leagueAfter).minSeasonPoints;
    if (currentLeagueRank > previousLeagueRank) return 'promotion';
    if (currentLeagueRank < previousLeagueRank) return 'demotion';
    return 'stay';
  }, [weeklyResult]);

  const weeklyStatusText =
    weeklyLeagueOutcome === 'promotion'
      ? '¡Ascenso de liga esta semana!'
      : weeklyLeagueOutcome === 'demotion'
        ? 'Puedes recuperar tu liga completando retos diarios'
        : 'Te mantienes en tu liga esta semana';

  const metrics = useMemo(
    () => [
      { key: 'speed', title: '⚡ Velocidad mental', value: neuroScore.speed, color: categoryColors.speed },
      { key: 'memory', title: '🧠 Memoria', value: neuroScore.memory, color: categoryColors.memory },
      { key: 'logic', title: '🧩 Lógica', value: neuroScore.logic, color: categoryColors.logic },
      { key: 'attention', title: '🎯 Atención', value: neuroScore.attention, color: categoryColors.attention },
    ],
    [categoryColors, neuroScore],
  );

  return (
    <>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 }}>
          <Image
            source={require('../../assets/icon-foreground.png')}
            style={{ width: 112, height: 112 }}
            resizeMode="contain"
          />
          <View style={{ flexShrink: 1 }}>
            <Text style={[theme.typography.title, { color: theme.colors.text }]}>NeuroFit</Text>
            <Text style={[theme.typography.body, { color: theme.colors.muted }]}>Entrena tu mente</Text>
          </View>
        </View>

        <PlayerEconomyBar
          xp={xpTotal}
          neuroCoins={seasonPoints}
          middleLabel={`${league.badgeEmoji} ${league.name}`}
          middleColor={leagueAccent}
        />

        {loadError ? (
          <Card variant="warning">
            <Text style={[theme.typography.bodySmall, { color: theme.colors.red }]}>{loadError}</Text>
            <View style={{ marginTop: 10 }}>
              <Button title="Reintentar carga" onPress={() => setReloadNonce((current) => current + 1)} variant="secondary" />
            </View>
          </Card>
        ) : null}
        <StreakWidget current={streakCurrent} best={streakBest} />

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

        <Card
          variant="success"
          style={{
            borderColor: dailyCompleted ? `${theme.colors.green}AA` : `${theme.colors.pink}AA`,
            borderWidth: 2,
            backgroundColor: theme.mode === 'dark' ? theme.colors.bg1 : dailyCompleted ? `${theme.colors.green}12` : `${theme.colors.pink}12`,
            shadowColor: dailyCompleted ? theme.colors.green : theme.colors.pink,
            shadowOpacity: 0.18,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 8 },
            elevation: 4,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Text style={[theme.typography.h3, { color: theme.colors.text }]}>{dailyCompleted ? '✅ Reto diario' : '🎯 Reto diario'}</Text>
            <Pill label={dailyCompleted ? 'Completado' : 'Destacado'} tone={dailyCompleted ? 'success' : 'pink'} />
          </View>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.muted, marginTop: 6 }]}>
            {dailyCompleted
              ? `Completado por hoy (${dailyProgress}). ¡Gran trabajo!`
              : `Progreso ${dailyProgress}. Completa el circuito para reclamar XP extra.`}
          </Text>
          <View style={{ marginTop: 12 }}>
            <Button
              title={dailyCompleted ? '✅ Completado' : 'Iniciar reto diario'}
              variant={dailyCompleted ? 'secondary' : 'primary'}
              onPress={() => navigation.navigate('DailyChallenge')}
              style={dailyCompleted ? { borderColor: theme.colors.green } : undefined}
            />
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => navigation.navigate('Leaderboard')} style={({ pressed }) => [{ flex: 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            <Card
              style={{
                minHeight: 118,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: 'rgba(34,211,238,0.55)',
                backgroundColor: theme.mode === 'dark' ? 'rgba(8,47,73,0.34)' : 'rgba(224,242,254,0.78)',
              }}
            >
              <Text style={{ fontSize: 24 }}>🥇</Text>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.text, marginTop: 8, fontWeight: '800' }]}>Ranking</Text>
            </Card>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Progress')} style={({ pressed }) => [{ flex: 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            <Card
              style={{
                minHeight: 118,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: 'rgba(129,140,248,0.55)',
                backgroundColor: theme.mode === 'dark' ? 'rgba(49,46,129,0.32)' : 'rgba(224,231,255,0.78)',
              }}
            >
              <Text style={{ fontSize: 24 }}>📈</Text>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.text, marginTop: 8, fontWeight: '800' }]}>Progreso</Text>
            </Card>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Settings')} style={({ pressed }) => [{ flex: 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            <Card
              style={{
                minHeight: 118,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: 'rgba(52,211,153,0.55)',
                backgroundColor: theme.mode === 'dark' ? 'rgba(6,78,59,0.30)' : 'rgba(209,250,229,0.75)',
              }}
            >
              <Text style={{ fontSize: 24 }}>⚙️</Text>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.text, marginTop: 8, fontWeight: '800' }]}>Ajustes</Text>
            </Card>
          </Pressable>
        </View>

      </Screen>

      <GameResultModal
        visible={!!weeklyResult}
        onRequestClose={closeWeeklyResult}
        variant={weeklyLeagueOutcome === 'promotion' ? 'victory' : 'neutral'}
        title="Resultado semanal"
        subtitle={weeklyStatusText}
        metrics={[
          {
            label: 'Liga',
            value: `${weeklyResult ? getLeagueById(weeklyResult.leagueBefore).name : '-'} → ${weeklyResult ? getLeagueById(weeklyResult.leagueAfter).name : '-'}`,
          },
          { label: 'Puesto final', value: `${weeklyResult?.finalRank ?? '-'} / 50` },
          { label: 'NeuroCoins de la semana', value: formatNeuroCoins(weeklyResult?.spFinal ?? 0) },
        ]}
        primaryAction={{ label: 'Continuar', onPress: closeWeeklyResult }}
        leaguePromotion={weeklyLeagueOutcome === 'promotion'}
      />
    </>
  );
}