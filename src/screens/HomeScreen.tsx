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
  const [xpWeekly, setXpWeekly] = useState(0);
  const [neuroCoins, setNeuroCoins] = useState(0);
  const [leagueId, setLeagueId] = useState<'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grand_master' | 'legend'>('bronze');
  const [streakCurrent, setStreakCurrent] = useState(0);
  const [streakBest, setStreakBest] = useState(0);
  const [weeklyResult, setWeeklyResult] = useState<Profile['lastWeekResult'] | null>(null);
  const [dailyCompleted, setDailyCompleted] = useState(false);
  const [dailyProgress, setDailyProgress] = useState('0/3');
  const [userRank, setUserRank] = useState(50);
  const [xpToTop10, setXpToTop10] = useState(0);
  const [xpToSafety, setXpToSafety] = useState(0);
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
              userSeasonPoints: profile.xpWeekly,
              userName: 'Tú',
              size: 50,
            }),
          ]);

          const progress = getDailyProgress(daily);
          const me = board.find((entry) => entry.isUser);
          const top10Cut = board.find((entry) => entry.rank === 10)?.seasonPoints ?? profile.xpWeekly;
          const safetyCut = board.find((entry) => entry.rank === 40)?.seasonPoints ?? profile.xpWeekly;

          setDailyCompleted(daily.completed);
          setDailyProgress(`${progress.completedStages}/${progress.totalStages}`);
          setUserRank(me?.rank ?? 50);
          setXpToTop10(Math.max(0, top10Cut - profile.xpWeekly + 1));
          setXpToSafety(Math.max(0, safetyCut - profile.xpWeekly + 1));
          setNeuroScore(profile.neuro);

          setXpTotal(profile.xpTotal);
          setXpWeekly(profile.xpWeekly);
          setNeuroCoins(profile.seasonPoints);
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
  const top10Progress = xpToTop10 > 0 ? Math.max(0, Math.min(1, xpWeekly / (xpWeekly + xpToTop10))) : 1;

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
          neuroCoins={neuroCoins}
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
          style={{
            borderColor: theme.colors.primary,
            borderWidth: 2,
            backgroundColor: theme.colors.primary,
            shadowColor: theme.colors.primary,
            shadowOpacity: 0.22,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 8 },
            elevation: 4,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Text style={[theme.typography.h3, { color: '#FFFFFF' }]}>{dailyCompleted ? '✅ Reto diario' : '🎯 Reto diario'}</Text>
            <Pill label={`Racha ${streakCurrent} · Max ${streakBest}`} tone="warning" />
          </View>
          <Text style={[theme.typography.bodySmall, { color: '#FFFFFF', marginTop: 6 }]}>
            {dailyCompleted
              ? `Completado por hoy (${dailyProgress}). ¡Gran trabajo!`
              : `Progreso ${dailyProgress}. Completa el circuito para reclamar XP extra.`}
          </Text>
          <View style={{ marginTop: 10 }}>
            <Text style={[theme.typography.caption, { color: '#DBEAFE' }]}>Ranking semanal actual: #{userRank}</Text>
            <Text style={[theme.typography.caption, { color: '#DBEAFE', marginTop: 2 }]}>Te faltan {xpToTop10} XP para Top 10 · {xpToSafety} XP para zona segura</Text>
          </View>
          <View style={{ marginTop: 10 }}>
            <ProgressBar value={top10Progress} color="#FDBA74" />
          </View>
          <View style={{ marginTop: 12 }}>
            <Button
              title={dailyCompleted ? '✅ Completado' : 'Iniciar reto diario'}
              variant={dailyCompleted ? 'secondary' : 'primary'}
              onPress={() => navigation.navigate('DailyChallenge')}
              style={
                dailyCompleted
                  ? { borderColor: '#FDBA74' }
                  : { backgroundColor: '#F97316', borderColor: '#EA580C' }
              }
            />
          </View>
        </Card>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Pressable onPress={() => navigation.navigate('Leaderboard')} style={({ pressed }) => [{ width: '48%', transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
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
              <Text style={[theme.typography.bodySmall, { color: theme.colors.text, marginTop: 8, fontWeight: '800' }]}>Ranking semanal</Text>
            </Card>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('HistoricalLeaderboard')} style={({ pressed }) => [{ width: '48%', transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            <Card
              style={{
                minHeight: 118,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: 'rgba(245,158,11,0.55)',
                backgroundColor: theme.mode === 'dark' ? 'rgba(120,53,15,0.35)' : 'rgba(255,237,213,0.88)',
              }}
            >
              <Text style={{ fontSize: 24 }}>🏛️</Text>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.text, marginTop: 8, fontWeight: '800' }]}>Ranking historico</Text>
            </Card>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Progress')} style={({ pressed }) => [{ width: '48%', transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
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
          <Pressable onPress={() => navigation.navigate('Settings')} style={({ pressed }) => [{ width: '48%', transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
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
          { label: 'XP semanal final', value: formatNeuroCoins(weeklyResult?.xpWeeklyFinal ?? weeklyResult?.spFinal ?? 0) },
        ]}
        primaryAction={{ label: 'Continuar', onPress: closeWeeklyResult }}
        leaguePromotion={weeklyLeagueOutcome === 'promotion'}
      />
    </>
  );
}